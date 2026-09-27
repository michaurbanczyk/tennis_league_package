const { createRequire } = require('node:module'),
  { readFileSync, writeFileSync } = require('node:fs'),
  { DatabaseSync } = require('node:sqlite'),
  assert = require('node:assert/strict');
const projectRoot = require('node:path').resolve(__dirname, '..');
const ts = createRequire(projectRoot + '/package.json')('typescript');
function app(root) {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE boards(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL); CREATE TABLE sessions(token TEXT PRIMARY KEY,scope TEXT,expires INTEGER); CREATE TABLE attempts(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);',
  );
  const adapter = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return db.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        async run() {
          const r = db.prepare(sql).run(...args);
          return { meta: { changes: Number(r.changes) } };
        },
      };
    },
    async batch(statements) {
      if (adapter.beforeBatch) {
        const fn = adapter.beforeBatch;
        delete adapter.beforeBatch;
        fn();
      }
      db.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) {
          if (adapter.failAt === result.length) {
            delete adapter.failAt;
            throw Error('simulated database failure');
          }
          result.push(await statement.run());
        }
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  const modules = {};
  function load(file) {
    if (modules[file]) return modules[file];
    const code = ts.transpileModule(readFileSync(root + '/' + file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      m = { exports: {} };
    const req = (id) =>
      id === '@/db/raw'
        ? { database: () => adapter, adminCode: () => 'SULEK' }
        : id.startsWith('@/')
          ? load('src/' + id.slice(2) + '.ts')
          : id.startsWith('./')
            ? load(file.slice(0, file.lastIndexOf('/') + 1) + id.slice(2) + '.ts')
            : createRequire(root + '/package.json')(id);
    new Function('require', 'module', 'exports', code)(req, m, m.exports);
    return (modules[file] = m.exports);
  }
  const api = load('src/app/api/league/route.ts'),
    tennis = load('src/lib/tennis.ts');
  let cookie = '';
  const stored = () => db.prepare('SELECT data FROM boards WHERE id=?').get('main')?.data;
  const board = () => JSON.parse(stored());
  async function get(archive = '', overrideCookie = cookie) {
    const r = await api.GET(
      new Request('https://example.test/api/league' + (archive ? '?' + archive : ''), {
        headers: { cookie: overrideCookie },
      }),
    );
    return { status: r.status, data: await r.json() };
  }
  async function post(action, extra = {}, overrideCookie = cookie) {
    const revision =
      db.prepare('SELECT revision FROM boards WHERE id=?').get('main')?.revision || 0;
    const r = await api.POST(
      new Request(
        'https://example.test/api/league' + (action === 'restore_backup' ? '?restore=1' : ''),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: overrideCookie },
          body: JSON.stringify({ action, revision, ...extra }),
        },
      ),
    );
    const c = r.headers.get('set-cookie');
    if (c && action === 'login') cookie = c.split(';')[0];
    return { status: r.status, data: await r.json() };
  }
  return { db, adapter, tennis, post, get, board, stored, cookie: () => cookie };
}

async function ok(p) {
  const r = await p;
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
async function main() {
  const a = app(projectRoot),
    isRtl = /SITE_LEAGUE\s*:\s*LeagueTheme\s*=\s*['"]relaksmisja['"]/.test(
      readFileSync(projectRoot + '/src/lib/site-league.ts', 'utf8'),
    ),
    dates = ['2026-09-26', '2026-09-27', ...(isRtl ? ['2026-10-03', '2026-10-04'] : [])];
  await ok(a.post('login', { code: 'sulek' }));
  const admin = a.cookie();
  await ok(a.post('season', { season: isRtl ? 'Lato 2026' : '2026/1', finalsDates: dates }));
  const created = await ok(
    a.post('create', {
      name: isRtl ? 'Top Pro' : 'Pro',
      startSize: 4,
      players: ['Anna Testowa', 'Jan Testowy', 'Adam Testowy', 'Ewa Testowa'],
      courts: ['1', '2', '3', '4'],
      dates: dates.slice(0, 2).flatMap((d) => [d, d]),
      times: Array(4).fill('10:00'),
      referees: [true, false, false, false],
    }),
  );
  const match = created.levels[0].matches[0];
  await ok(a.post('login', { code: match.currentCode }));
  const player = a.cookie();
  await ok(a.post('login', { code: match.refereeCurrentCode }));
  const referee = a.cookie();
  await ok(a.post('start', { matchId: match.id }, referee));
  await ok(a.post('point', { matchId: match.id, player: 0 }, referee));
  const archiveId = 'archive:' + crypto.randomUUID();
  a.db.prepare('INSERT INTO boards(id,data,revision) VALUES (?,?,0)').run(archiveId, a.stored());
  a.db
    .prepare('INSERT INTO boards(id,data,revision) VALUES (?,?,0)')
    .run('recovery:main', a.stored());
  const preserved = () =>
    JSON.stringify(a.db.prepare("SELECT * FROM boards WHERE id<>'main' ORDER BY id").all());
  const before = a.stored(),
    beforePreserved = preserved(),
    beforeSessions = () =>
      JSON.stringify(a.db.prepare('SELECT * FROM sessions ORDER BY token').all());
  for (const cookie of ['', player, referee])
    assert(
      [401, 403].includes(
        (await a.post('reset_league', { adminPassword: 'sulek', confirm: true }, cookie)).status,
      ),
    );
  assert.equal((await a.post('reset_league', { adminPassword: 'sulek' }, admin)).status, 400);
  for (const password of ['', 'wrong', match.currentCode, match.refereeCurrentCode])
    assert.equal(
      (await a.post('reset_league', { adminPassword: password, confirm: true }, admin)).status,
      401,
    );
  assert.equal(a.stored(), before);
  assert.equal(preserved(), beforePreserved);
  assert.equal(
    (await a.post('reset_league', { adminPassword: 'sulek', confirm: true, revision: 0 }, admin))
      .status,
    409,
  );
  const sessions = beforeSessions();
  // A concurrent result between the read and the batch prevents every reset write.
  a.adapter.beforeBatch = () =>
    a.db.prepare("UPDATE boards SET revision=revision+1 WHERE id='main'").run();
  assert.equal(
    (await a.post('reset_league', { adminPassword: 'sulek', confirm: true }, admin)).status,
    409,
  );
  assert.equal(a.stored(), before);
  assert.equal(beforeSessions(), sessions);
  assert.equal(preserved(), beforePreserved);
  // Failure revoking sessions rolls back the reset itself as well.
  a.adapter.failAt = 1;
  assert.equal(
    (await a.post('reset_league', { adminPassword: 'sulek', confirm: true }, admin)).status,
    400,
  );
  assert.equal(a.stored(), before);
  assert.equal(beforeSessions(), sessions);
  const revision = (await a.get('', admin)).data.revision;
  const reset = await ok(a.post('reset_league', { adminPassword: 'sulek', confirm: true }, admin));
  assert.equal(reset.revision, revision + 1);
  assert.equal(reset.scope, 'admin');
  assert.equal(reset.season, null);
  assert.deepEqual(reset.finalsDates, []);
  assert.equal(reset.levels.length, isRtl ? 15 : 6);
  for (const level of a.board().levels)
    for (const m of level.matches) {
      assert(m.players.every((p) => p === ''));
      assert.equal(m.court, '');
      assert.equal(m.time, '');
      assert(!m.date);
      assert.equal(m.status, 'scheduled');
      assert.deepEqual(m.sets, [[0, 0]]);
      assert(!m.savedCode);
      assert(!m.refereeSavedCode);
      assert(!m.refereeEnabled);
      assert.notEqual(m.id, match.id);
    }
  assert.equal(preserved(), beforePreserved);
  assert.equal(reset.archives.length, 1);
  assert.equal((await a.post('point', { matchId: match.id, player: 0 }, referee)).status, 401);
  assert.equal((await a.post('start', { matchId: match.id }, player)).status, 401);
  assert.equal((await a.get('', admin)).data.scope, 'admin');
  assert.equal((await a.post('login', { code: match.currentCode })).status, 401);
  assert.equal((await a.post('login', { code: match.refereeCurrentCode })).status, 401);
  // Fresh installations can reset too, and repeated bad passwords are throttled.
  const fresh = app(projectRoot);
  await ok(fresh.post('login', { code: 'sulek' }));
  await ok(fresh.post('reset_league', { adminPassword: 'sulek', confirm: true }));
  assert.equal(fresh.db.prepare('SELECT COUNT(*) AS n FROM boards').get().n, 1);
  for (let i = 0; i < 9; i++)
    assert.equal(
      (await fresh.post('reset_league', { adminPassword: 'wrong', confirm: true })).status,
      401,
    );
  assert.equal(
    (await fresh.post('reset_league', { adminPassword: 'sulek', confirm: true })).status,
    429,
  );
  console.log(
    `PASS ${isRtl ? 'RTL' : 'Smart'} reset: admin session and password required, explicit confirmation, throttling, stale requests and race protection, atomic rollback, current data cleared, player/referee sessions revoked, archive/recovery preserved, no backup/archive created.`,
  );
}
const logger = console.error;
console.error = () => {};
main().catch((e) => {
  console.error = logger;
  console.error(e);
  process.exitCode = 1;
});
