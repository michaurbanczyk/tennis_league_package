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
          if (adapter.beforeRun) {
            const fn = adapter.beforeRun;
            delete adapter.beforeRun;
            fn();
          }
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
    t = a.tennis,
    HOUR = 3600000;
  // 23:00 Warsaw -> 01:00 next day: still live, regardless of planned date.
  const start = Date.parse('2026-09-22T21:00:00Z'),
    b = t.initialBoard(),
    m = b.levels[0].matches[0];
  m.players = ['A', 'B'];
  m.court = '1';
  m.date = '2026-09-21';
  m.time = '10:00';
  t.startMatch(m, start);
  assert.equal(m.startedAt, '2026-09-22T21:00:00.000Z');
  t.addScore(m, 0, 'super');
  m.updated = new Date(start + 11 * HOUR).toISOString();
  assert.equal(t.normalizeLiveMatches(b, start + 2 * HOUR), false);
  assert.equal(t.liveCourts(b, '2026-09-23')[0].live[0].m.id, m.id);
  t.normalizeLiveMatches(b, start + 12 * HOUR - 1);
  assert.equal(m.status, 'live');
  t.normalizeLiveMatches(b, start + 12 * HOUR);
  assert.equal(m.status, 'unfinished');
  assert.deepEqual(m.sets, [[1, 0]]);
  assert.equal(m.winner, null);
  assert.equal(t.liveCourts(b, '2026-09-23')[0].live.length, 0);
  assert.equal(m.unfinishedAt, new Date(start + 12 * HOUR).toISOString());
  assert.equal(t.normalizeLiveMatches(b, start + 13 * HOUR), false);
  t.propagatePlayers(b.levels[0]);
  assert.deepEqual(b.levels[0].matches[2].players, ['', '']);
  assert.throws(() => t.addScore(m, 0, 'super'));
  t.undoScore(m);
  t.normalizeLiveMatches(b, start + 13 * HOUR);
  assert.equal(m.status, 'unfinished');
  t.startMatch(m, start + 14 * HOUR);
  assert.equal(m.status, 'live');
  t.undoScore(m);
  assert.equal(m.status, 'unfinished');
  assert.equal(m.startedAt, new Date(start).toISOString());
  const beforeStart = t.makeLevel('Test').matches[0];
  beforeStart.players = ['A', 'B'];
  t.startMatch(beforeStart, start);
  t.undoScore(beforeStart);
  assert.equal(beforeStart.status, 'scheduled');
  assert.equal(beforeStart.startedAt, null);
  // Absolute elapsed time also survives the Warsaw daylight-saving change.
  const dst = t.initialBoard(),
    dm = dst.levels[0].matches[0];
  dm.players = ['A', 'B'];
  const dstStart = Date.parse('2026-10-24T21:00:00Z');
  t.startMatch(dm, dstStart);
  t.normalizeLiveMatches(dst, dstStart + 12 * HOUR - 1);
  assert.equal(dm.status, 'live');
  t.normalizeLiveMatches(dst, dstStart + 12 * HOUR);
  assert.equal(dm.status, 'unfinished');
  // Exercise the real route and SQL through the existing in-memory D1 adapter.
  await ok(a.post('login', { code: 'sulek' }));
  const admin = a.cookie();
  const board = t.initialBoard(),
    match = board.levels[0].matches[0];
  match.players = ['A', 'B'];
  match.court = '1';
  match.date = '2026-09-01';
  match.time = '10:00';
  match.refereeEnabled = true;
  a.db
    .prepare('INSERT INTO boards (id,data,revision) VALUES (?,?,1)')
    .run('main', JSON.stringify(board));
  await ok(a.post('start', { matchId: match.id }, admin));
  const actualStart = a.board().levels[0].matches[0].startedAt;
  assert(actualStart);
  await ok(a.post('point', { matchId: match.id, player: 0 }, admin));
  assert.equal(a.board().levels[0].matches[0].startedAt, actualStart);
  const old = a.board(),
    expired = old.levels[0].matches[0];
  expired.startedAt = new Date(Date.now() - 13 * HOUR).toISOString();
  expired.history.forEach((h) => {
    if (h.status === 'live') h.startedAt = expired.startedAt;
  });
  expired.points = [3, 3];
  expired.updated = new Date().toISOString();
  a.db.prepare('UPDATE boards SET data=? WHERE id=?').run(JSON.stringify(old), 'main');
  const archive = 'archive:' + crypto.randomUUID();
  a.db
    .prepare('INSERT INTO boards(id,data,revision) VALUES (?,?,1)')
    .run(archive, JSON.stringify(old));
  const result = await ok(a.get('', ''));
  assert.equal(result.levels[0].matches[0].status, 'unfinished');
  assert.deepEqual(result.levels[0].matches[0].points, [3, 3]);
  assert.equal(a.board().levels[0].matches[0].status, 'unfinished');
  assert.equal(a.board().levels[0].matches[0].winner, null);
  assert.equal((await ok(a.get('archive=' + archive))).levels[0].matches[0].status, 'live');
  const revision = result.revision;
  assert.equal((await ok(a.get('', ''))).revision, revision);
  const backup = await ok(a.get('backup=download', admin));
  await ok(a.post('restore_backup', { backup, confirm: true }, admin));
  assert.deepEqual(
    a.board().levels[0].matches[0],
    expired.status === 'unfinished'
      ? expired
      : {
          ...expired,
          status: 'unfinished',
          winner: null,
          finishedTime: null,
          unfinishedAt: new Date(Date.parse(expired.startedAt) + 12 * HOUR).toISOString(),
        },
  );
  await ok(a.post('start', { matchId: match.id }, admin));
  assert.deepEqual(a.board().levels[0].matches[0].points, [3, 3]);
  assert.equal(a.board().levels[0].matches[0].status, 'live');
  await ok(a.post('undo', { matchId: match.id }, admin));
  assert.equal(a.board().levels[0].matches[0].status, 'unfinished');
  // Concurrent finalization wins over automatic expiry, without lost scores.
  const racing = a.board();
  racing.levels[0].matches[0].status = 'live';
  a.db.prepare('UPDATE boards SET data=? WHERE id=?').run(JSON.stringify(racing), 'main');
  a.adapter.beforeRun = () => {
    const newer = a.board(),
      n = newer.levels[0].matches[0];
    n.status = 'finished';
    n.sets = [
      [6, 0],
      [6, 0],
    ];
    n.winner = 0;
    n.finishedTime = '12:00';
    a.db
      .prepare('UPDATE boards SET data=?,revision=revision+1 WHERE id=?')
      .run(JSON.stringify(newer), 'main');
  };
  const afterRace = await ok(a.get('', ''));
  assert.equal(afterRace.levels[0].matches[0].status, 'finished');
  assert.deepEqual(afterRace.levels[0].matches[0].sets, [
    [6, 0],
    [6, 0],
  ]);
  // Legacy data pins last activity once; no timestamp means no invented live game.
  const legacy = t.initialBoard(),
    [one, two, three] = legacy.levels[0].matches;
  Object.assign(one, { status: 'live', updated: new Date(Date.now() - HOUR).toISOString() });
  Object.assign(two, { status: 'live', updated: new Date(Date.now() - 13 * HOUR).toISOString() });
  three.status = 'live';
  t.normalizeLiveMatches(legacy);
  assert.equal(one.status, 'live');
  assert.equal(one.startedAt, one.updated);
  assert.equal(two.status, 'unfinished');
  assert.equal(three.status, 'unfinished');
  const pinned = one.startedAt;
  one.updated = new Date().toISOString();
  t.normalizeLiveMatches(legacy);
  assert.equal(one.startedAt, pinned);
  console.log(
    'PASS: exact 12h boundary, midnight/DST, scheduled-date independence, preserved points/history, no advancement, undo/resume, backups, legacy matches, persistent expiry, unchanged archives and concurrent finalization.',
  );
}
const log = console.error;
console.error = () => {};
main().catch((e) => {
  console.error = log;
  console.error(e);
  process.exitCode = 1;
});
