const { createRequire } = require('node:module'),
  { readFileSync, writeFileSync } = require('node:fs'),
  { DatabaseSync } = require('node:sqlite'),
  assert = require('node:assert/strict');
const projectRoot = require('node:path').resolve(__dirname, '..');
const ts = createRequire(projectRoot + '/package.json')('typescript');
function app(root) {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE boards(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL); CREATE TABLE match_rows(board_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(board_id,id)); CREATE TABLE sessions(token TEXT PRIMARY KEY,scope TEXT,expires INTEGER); CREATE TABLE attempts(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);',
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
    rtl = /SITE_LEAGUE\s*:\s*LeagueTheme\s*=\s*['"]relaksmisja['"]/.test(
      readFileSync(projectRoot + '/src/lib/site-league.ts', 'utf8'),
    ),
    dates = ['2026-09-26', '2026-09-27', ...(rtl ? ['2026-10-03', '2026-10-04'] : [])];
  await ok(a.post('login', { code: 'sulek' }));
  const admin = a.cookie();
  await ok(a.post('season', { season: rtl ? 'Lato 2026' : '2026/1', finalsDates: dates }));
  const original = a.board().levels[0];
  for (const name of ['', '  ', 'x'.repeat(61), 'bad\nname', original.name.toUpperCase()])
    assert.equal(
      (await a.post('add_level', { name, doubles: false, levelId: original.id })).status,
      400,
    );
  const added = await ok(a.post('add_level', { name: '  Masters   Open  ', doubles: true }));
  const custom = added.levels.find((l) => l.name === 'Masters Open');
  assert(custom);
  assert.equal(custom.doubles, true);
  await ok(a.post('add_level', { name: 'Nowy poziom', doubles: false }));
  const players = Array.from({ length: 4 }, (_, i) => `Para numer ${i + 1} ` + 'a'.repeat(80));
  const created = await ok(
    a.post('create', {
      levelId: custom.id,
      name: 'ignored stale label',
      startSize: 4,
      format: 'super',
      players,
      courts: ['1', '2', '3', '4'],
      dates: [dates[0], dates[0], dates[1], dates[1]],
      times: Array(4).fill('10:00'),
      referees: [true, false, false, false],
    }),
  );
  const first = created.levels.find((l) => l.id === custom.id).matches[0];
  await ok(a.post('login', { code: first.refereeCurrentCode }));
  const referee = a.cookie();
  for (const action of ['add_level', 'rename_level', 'delete_level'])
    assert.equal(
      (
        await a.post(
          action,
          {
            name: 'Zmieniony',
            doubles: false,
            levelId: custom.id,
            confirm: true,
            adminPassword: 'sulek',
          },
          referee,
        )
      ).status,
      403,
    );
  await ok(a.post('start', { matchId: first.id }, referee));
  await ok(a.post('point', { matchId: first.id, player: 0 }, referee));
  const matchesBefore = structuredClone(a.board().levels.find((l) => l.id === custom.id).matches);
  await ok(a.post('rename_level', { levelId: custom.id, name: 'Liga Masters' }, admin));
  const renamed = a.board().levels.find((l) => l.id === custom.id);
  assert.equal(renamed.doubles, true);
  assert.deepEqual(renamed.matches, matchesBefore);
  assert.equal(
    (await a.post('rename_level', { levelId: custom.id, name: original.name }, admin)).status,
    400,
  );
  const backup = await ok(a.get('backup=download', admin));
  await ok(a.post('restore_backup', { backup, confirm: true }, admin));
  assert.equal(a.board().levels.find((l) => l.id === custom.id).doubles, true);
  assert.deepEqual(a.board().levels.find((l) => l.id === custom.id).matches, matchesBefore);
  // Reauthenticate after restore and ensure deleting the level revokes its access.
  await ok(a.post('login', { code: first.refereeCurrentCode }));
  const currentReferee = a.cookie();
  const archiveId = 'archive:' + crypto.randomUUID();
  a.db.prepare('INSERT INTO boards (id,data,revision) VALUES (?,?,0)').run(archiveId, a.stored());
  const preserved = () =>
      JSON.stringify(a.db.prepare("SELECT * FROM boards WHERE id<>'main' ORDER BY id").all()),
    archivesBefore = preserved(),
    before = a.stored();
  assert.equal(
    (await a.post('delete_level', { levelId: custom.id, adminPassword: 'sulek' }, admin)).status,
    400,
  );
  assert.equal(
    (
      await a.post(
        'delete_level',
        { levelId: custom.id, confirm: true, adminPassword: 'wrong' },
        admin,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await a.post(
        'delete_level',
        { levelId: custom.id, confirm: true, adminPassword: 'sulek', revision: 0 },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(a.stored(), before);
  const othersBefore = JSON.stringify(a.board().levels.filter((l) => l.id !== custom.id));
  const deleted = await ok(
    a.post('delete_level', { levelId: custom.id, confirm: true, adminPassword: 'sulek' }, admin),
  );
  assert.equal(JSON.stringify(a.board().levels), othersBefore);
  assert.equal(preserved(), archivesBefore);
  assert(!JSON.stringify((await a.get('', '')).data).includes(first.id));
  assert.equal((await a.get('', currentReferee)).data.scope, null);
  assert.equal(
    (await a.post('point', { matchId: first.id, player: 0 }, currentReferee)).status,
    401,
  );
  assert(
    a.tennis
      .courtSchedule(a.board())
      .every((d) => d.courts.every((c) => c.matches.every((x) => x.m.id !== first.id))),
  );
  assert(
    a.tennis.liveCourts(a.board(), dates[0]).every((c) => !c.live.some((x) => x.m.id === first.id)),
  );
  assert.equal(
    (await a.post('create', { name: 'Liga Masters', levelId: custom.id }, admin)).status,
    400,
  );
  const roster = a.board().levels.map((l) => [l.id, l.name]);
  await ok(
    a.post('new_season', { season: rtl ? 'Zima 2026' : '2026/2', finalsDates: dates }, admin),
  );
  assert.deepEqual(
    a.board().levels.map((l) => [l.id, l.name]),
    roster,
  );
  assert(a.board().levels.every((l) => l.matches.every((m) => m.players.every((p) => p === ''))));
  // Deleting all levels is a valid state and permits adding another level.
  for (const l of a.board().levels) {
    a.db.prepare('DELETE FROM attempts').run();
    await ok(
      a.post('delete_level', { levelId: l.id, confirm: true, adminPassword: 'sulek' }, admin),
    );
  }
  assert.equal((await a.get('', admin)).data.levels.length, 0);
  const emptyBackup = await ok(a.get('backup=download', admin));
  await ok(a.post('restore_backup', { backup: emptyBackup, confirm: true }, admin));
  const fresh = await ok(a.post('add_level', { name: 'Od nowa', doubles: false }, admin));
  assert.equal(fresh.levels.length, 1);
  console.log(
    `PASS ${rtl ? 'RTL' : 'Smart'} levels: names/duplicates validation, custom singles/doubles, published rename preserves matches/codes/points, backup roundtrip, admin/password/confirmation requirements, delete removes every current view and access, preserves other levels/archives, custom next-season roster and empty-roster recovery.`,
  );
}
const log = console.error;
console.error = () => {};
main().catch((e) => {
  console.error = log;
  console.error(e);
  process.exitCode = 1;
});
