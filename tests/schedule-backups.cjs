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
    rtl = /SITE_LEAGUE\s*:\s*LeagueTheme\s*=\s*['"]relaksmisja['"]/.test(
      readFileSync(projectRoot + '/src/lib/site-league.ts', 'utf8'),
    ),
    league = rtl ? 'relaksmisja' : 'smart';
  const dates = ['2026-09-26', '2026-09-27', ...(rtl ? ['2026-10-03', '2026-10-04'] : [])];
  const state = () => JSON.stringify(a.db.prepare('SELECT * FROM boards ORDER BY id').all());
  await ok(a.post('login', { code: 'sulek' }));
  const admin = a.cookie();
  await ok(a.post('season', { season: rtl ? 'Lato 2026' : '2026/1', finalsDates: dates }));
  const names = a.tennis.levelsForTheme(league),
    payload = {
      name: names[0],
      startSize: 4,
      format: 'super',
      players: ['Piotr Sułkowski', 'Michał Urbańczyk', 'Jan Kowalski', 'Adam Nowak'],
      courts: ['1', '2', '3', '4'],
      dates: [dates[0], dates[0], dates[1], dates[1]],
      times: ['15:00', '15:00', '17:00', '17:00'],
      ...(rtl ? { referees: [true, false, false, false] } : {}),
    };
  let before = state();
  const conflict = await a.post('create', { ...payload, courts: ['1', '1', '3', '4'] });
  assert.equal(conflict.status, 400);
  assert.match(conflict.data.error, /26\.09\.2026.*15:00/);
  assert.equal(state(), before);
  const created = await ok(a.post('create', payload)),
    [first, second] = created.levels[0].matches;
  before = state();
  assert.equal((await a.post('create', { ...payload, name: names[1] })).status, 400);
  assert.equal(state(), before);
  const details = {
    matchId: second.id,
    players: second.players,
    court: first.court,
    date: first.date,
    time: first.time,
  };
  assert.equal((await a.post('details', details)).status, 400);
  assert.equal(state(), before);
  await ok(a.post('details', { ...details, time: '15:01' }));
  await ok(a.post('details', { ...details, date: dates[1] }));
  await ok(a.post('details', { ...details, court: '2' }));
  await ok(a.post('details', { ...details, court: '2' })); // Own slot is allowed.
  // A concurrent reservation loses CAS, then the retry detects the occupied slot.
  const oldRevision = (await a.get()).data.revision;
  await ok(a.post('details', { ...details, court: '5' }));
  assert.equal(
    (
      await a.post('details', {
        matchId: first.id,
        players: first.players,
        date: first.date,
        time: first.time,
        court: '5',
        revision: oldRevision,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await a.post('details', {
        matchId: first.id,
        players: first.players,
        date: first.date,
        time: first.time,
        court: '5',
      })
    ).status,
    400,
  );
  if (rtl) await ok(a.post('details', { ...details, court: '7' })); // FAME 1 differs from FLEX 1.
  await ok(a.post('start', { matchId: first.id }));
  await ok(a.post(rtl ? 'point' : 'add', { matchId: first.id, player: 0 }));
  await ok(a.post('login', { code: first.currentCode }));
  const player = a.cookie();
  for (const cookie of ['', player]) {
    assert.equal((await a.get('backup=download', cookie)).status, 403);
    assert.equal((await a.get('backup=recovery', cookie)).status, 403);
    assert.equal((await a.get('backup=info', cookie)).status, 403);
    assert.equal(
      (await a.post('restore_backup', { backup: {}, confirm: true }, cookie)).status,
      403,
    );
  }
  await ok(
    a.post('new_season', { season: rtl ? 'Zima 2026' : '2026/2', finalsDates: dates }, admin),
  );
  await ok(a.post('create', payload, admin));
  const newFirst = a.board().levels[0].matches[0];
  await ok(a.post('login', { code: newFirst.savedCode }));
  const activePlayer = a.cookie();
  const backup = await ok(a.get('backup=download', admin));
  assert.equal(backup.records.length, 2);
  assert.equal(backup.league, league);
  assert.equal(backup.version, rtl ? 4 : 1);
  assert(backup.records[0].data.levels[0].matches[0].savedCode);
  before = state();
  for (const bad of [
    { ...backup, league: rtl ? 'smart' : 'relaksmisja' },
    { ...backup, version: 99 },
    { ...backup, records: [] },
    { ...backup, records: [...backup.records, backup.records[0]] },
    { ...backup, records: [{ id: 'sessions', data: backup.records[0].data }] },
  ]) {
    assert.equal(
      (await a.post('restore_backup', { backup: bad, confirm: true }, admin)).status,
      400,
    );
    assert.equal(state(), before);
  }
  const broken = structuredClone(backup);
  broken.records[0].data.levels[0].matches[0].sources = [
    { matchId: 'missing', outcome: 'winner' },
    { matchId: 'missing', outcome: 'winner' },
  ];
  assert.equal(
    (await a.post('restore_backup', { backup: broken, confirm: true }, admin)).status,
    400,
  );
  assert.equal(state(), before);
  assert.equal((await a.post('restore_backup', { backup }, admin)).status, 400);
  assert.equal(state(), before);
  await ok(a.post('season', { season: rtl ? 'Jesień 2026' : '2026/3', finalsDates: dates }, admin));
  const preRestore = await ok(a.get('backup=download', admin));
  const revision = (await a.get('', admin)).data.revision;
  // Conflict after the initial read must not touch archive, recovery, or sessions.
  a.adapter.beforeBatch = () =>
    a.db.prepare("UPDATE boards SET revision=revision+1 WHERE id='main'").run();
  assert.equal((await a.post('restore_backup', { backup, confirm: true }, admin)).status, 409);
  const afterRace = state();
  assert.equal((await a.get('backup=info', admin)).data.recoveryAvailable, false);
  // A failure in the middle of D1.batch rolls back every operation.
  a.adapter.failAt = 4;
  assert.equal((await a.post('restore_backup', { backup, confirm: true }, admin)).status, 400);
  assert.equal(state(), afterRace);
  const restored = await ok(a.post('restore_backup', { backup, confirm: true }, admin));
  assert.equal(restored.revision, revision + 2);
  assert.equal(restored.season, backup.records.find((r) => r.id === 'main').data.season);
  const full = await ok(a.get('backup=download', admin));
  for (const record of full.records) delete record.data.restoreToken;
  for (const record of backup.records) delete record.data.restoreToken;
  assert.deepEqual(full.records, backup.records);
  const recovery = await ok(a.get('backup=recovery', admin));
  assert.deepEqual(recovery.records, preRestore.records);
  assert.equal((await a.post('start', { matchId: newFirst.id }, activePlayer)).status, 401);
  await ok(a.post('login', { code: newFirst.savedCode }));
  const publicBoard = (await a.get('', '')).data;
  assert(!JSON.stringify(publicBoard).includes('savedCode'));
  assert(!JSON.stringify(publicBoard).includes('refereeToken'));
  await ok(a.post('restore_backup', { backup: recovery, confirm: true }, admin));
  assert.equal(a.board().season, preRestore.records.find((r) => r.id === 'main').data.season);
  // Restore is also usable on an empty installation.
  const fresh = app(projectRoot);
  await ok(fresh.post('login', { code: 'sulek' }));
  await ok(fresh.post('restore_backup', { backup, confirm: true }));
  assert.equal(fresh.board().season, restored.season);
  console.log(
    `PASS ${league}: schedule conflicts, self slot, date/time/court distinctions, concurrent scheduling, admin-only backups, full archive/code/history roundtrip, wrong-league and malformed rejection, stale restore, atomic rollback, recovery, session revocation, public privacy, fresh installation.`,
  );
}
const log = console.error;
console.error = () => {};
main().catch((e) => {
  console.error = log;
  console.error(e);
  process.exitCode = 1;
});
