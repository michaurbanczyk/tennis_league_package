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
    beforeBatch: null,
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
      if (this.beforeBatch) {
        const callback = this.beforeBatch;
        this.beforeBatch = null;
        callback();
      }
      db.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
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
      new Request('https://example.test/api/league' + (archive ? '?archive=' + archive : ''), {
        headers: { cookie: overrideCookie },
      }),
    );
    return { status: r.status, data: await r.json() };
  }
  async function post(action, extra = {}, overrideCookie = cookie) {
    const revision =
      db.prepare('SELECT revision FROM boards WHERE id=?').get('main')?.revision || 0;
    const r = await api.POST(
      new Request('https://example.test/api/league', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: overrideCookie },
        body: JSON.stringify({ action, revision, ...extra }),
      }),
    );
    const c = r.headers.get('set-cookie');
    if (c && action === 'login') cookie = c.split(';')[0];
    return { status: r.status, data: await r.json() };
  }
  return { db, adapter, tennis, post, get, board, stored, cookie: () => cookie };
}

const rtl = app(projectRoot),
  t = rtl.tennis;
const dates = ['2026-09-26', '2026-09-27', '2026-10-03', '2026-10-04'];
async function ok(p) {
  const r = await p;
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
async function main() {
  const oldLog = console.error;
  console.error = () => {};
  await ok(rtl.post('login', { code: 'sulek' }));
  const admin = rtl.cookie();
  await ok(rtl.post('season', { season: 'Lato 2026', finalsDates: dates }));
  const created = await ok(
    rtl.post('create', {
      name: 'Top Pro',
      startSize: 4,
      format: 'super',
      players: ['Piotr Sułkowski', 'Michał Urbańczyk', 'Jan Kowalski', 'Adam Nowak'],
      courts: ['1', '2', '3', '4'],
      dates: [dates[0], dates[0], dates[1], dates[1]],
      times: ['15:00', '15:00', '17:00', '17:00'],
      referees: [true, false, false, false],
    }),
  );
  const [first, second] = created.levels[0].matches,
    id = first.id,
    refCode = first.refereeCurrentCode;
  assert(/^\d{5}$/.test(refCode));
  assert.notEqual(refCode, first.currentCode);
  assert(!second.refereeCurrentCode);
  assert.equal(rtl.board().levels[0].matches.filter((m) => m.refereeEnabled).length, 1);
  await ok(rtl.post('login', { code: first.currentCode }));
  const player = rtl.cookie();
  for (const action of ['start', 'point', 'add', 'undo', 'finish'])
    assert.equal(
      (await rtl.post(action, { matchId: id, player: 0, finishedTime: '18:00' }, player)).status,
      403,
    );
  assert.equal((await rtl.post('referee', { matchId: id, enabled: false }, player)).status, 403);
  assert.equal((await rtl.post('login', { code: first.currentCode, role: 'referee' })).status, 401);
  assert.equal((await rtl.post('login', { code: 'sulek', role: 'referee' })).status, 401);
  await ok(rtl.post('login', { code: refCode, role: 'referee' }));
  let referee = rtl.cookie();
  assert.equal(t.scopeMatchId((await rtl.get()).data.scope), id);
  assert.equal((await rtl.post('start', { matchId: second.id }, referee)).status, 403);
  for (const action of ['referee', 'rotate', 'details'])
    assert.equal((await rtl.post(action, { matchId: id, enabled: false }, referee)).status, 403);
  assert.equal((await rtl.post('point', { matchId: id, player: 0 }, referee)).status, 400);
  await ok(rtl.post('start', { matchId: id }, referee));
  assert.equal((await rtl.post('add', { matchId: id, player: 0 }, admin)).status, 400);
  const m = () => rtl.board().levels[0].matches[0];
  const pt = async (p, c = referee) => ok(rtl.post('point', { matchId: id, player: p }, c));
  for (let n = 0; n < 3; n++) {
    await pt(0);
    await pt(1);
  }
  assert.deepEqual(t.pointLabels(m(), 'super'), ['40', '40']);
  await pt(0);
  assert.deepEqual(t.pointLabels(m(), 'super'), ['AD', '40']);
  await pt(1);
  assert.deepEqual(t.pointLabels(m(), 'super'), ['40', '40']);
  await pt(1);
  await pt(1);
  assert.deepEqual(m().sets, [[0, 1]]);
  assert.deepEqual(m().points, [0, 0]);
  await ok(rtl.post('undo', { matchId: id }, referee));
  assert.deepEqual(m().sets, [[0, 0]]);
  assert.deepEqual(t.pointLabels(m(), 'super'), ['40', 'AD']);
  const snapshot = rtl.stored();
  assert.equal((await rtl.post('referee', { matchId: id, enabled: false }, admin)).status, 400);
  assert.equal(rtl.stored(), snapshot);
  await pt(1);
  await pt(0, admin);
  assert.deepEqual(t.pointLabels(m(), 'super'), ['15', '0']);
  // Rotation revokes both the old PIN and an already issued session, preserving points.
  const rotation = await ok(
    rtl.post('referee', { matchId: id, enabled: true, rotate: true }, admin),
  );
  const refCode2 = rotation.levels[0].matches[0].refereeCurrentCode;
  assert.notEqual(refCode2, refCode);
  assert.deepEqual(t.pointLabels(m(), 'super'), ['15', '0']);
  assert.equal((await rtl.post('point', { matchId: id, player: 0 }, referee)).status, 401);
  assert.equal((await rtl.get('', referee)).data.scope, null);
  assert.equal((await rtl.post('login', { code: refCode })).status, 401);
  await ok(rtl.post('login', { code: refCode2 }));
  referee = rtl.cookie();
  // Public and player responses never contain either secret code or referee token.
  for (const cookie of ['', player, referee]) {
    const data = (await rtl.get('', cookie)).data;
    for (const l of data.levels)
      for (const match of l.matches)
        for (const field of [
          'refereeCodeHash',
          'refereeSavedCode',
          'refereeCurrentCode',
          'refereeToken',
          'codeHash',
          'savedCode',
          'currentCode',
          'history',
        ])
          assert(!(field in match), field);
  }
  const prior = rtl.stored();
  assert.equal(
    (await rtl.post('point', { matchId: id, player: 0, revision: 0 }, referee)).status,
    409,
  );
  assert.equal(rtl.stored(), prior);
  function setPosition(sets, points = [0, 0], format = 'super') {
    const b = rtl.board();
    b.levels[0].format = format;
    Object.assign(b.levels[0].matches[0], {
      sets,
      points,
      status: 'live',
      winner: null,
      history: [],
      tieBreaks: {},
    });
    rtl.db
      .prepare('UPDATE boards SET data=?,revision=revision+1 WHERE id=?')
      .run(JSON.stringify(b), 'main');
  }
  // 7-point tiebreak requires a two-point margin; undo restores the final tiebreak point.
  setPosition([[6, 6]], [6, 6]);
  await pt(0);
  assert.deepEqual(m().sets, [[6, 6]]);
  await pt(0);
  assert.deepEqual(m().sets, [[7, 6]]);
  assert.deepEqual(m().tieBreaks, { 0: [8, 6] });
  await ok(rtl.post('undo', { matchId: id }, referee));
  assert.deepEqual(m().points, [7, 6]);
  assert.deepEqual(m().sets, [[6, 6]]);
  await pt(0);
  await pt(1);
  assert.deepEqual(m().sets, [
    [7, 6],
    [0, 0],
  ]);
  assert.deepEqual(t.pointLabels(m(), 'super'), ['0', '15']);
  // Third-set super tiebreak, match finish and reopening.
  setPosition([
    [6, 4],
    [4, 6],
  ]);
  assert.equal(t.pointMode(m(), 'super'), 'super');
  await pt(0);
  assert.deepEqual(m().sets, [
    [6, 4],
    [4, 6],
    [1, 0],
  ]);
  setPosition([
    [6, 4],
    [4, 6],
    [9, 9],
  ]);
  await pt(1);
  assert.equal(t.matchWinner(m().sets, 'super'), null);
  await pt(1);
  assert.equal(t.matchWinner(m().sets, 'super'), 1);
  assert.equal((await rtl.post('point', { matchId: id, player: 0 }, referee)).status, 400);
  assert.equal((await rtl.post('finish', { matchId: id }, referee)).status, 400);
  const finishedDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const finishedTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
  await ok(rtl.post('finish', { matchId: id, finishedDate, finishedTime }, referee));
  assert.equal(m().status, 'finished');
  assert.equal(m().finishedTime, finishedTime);
  assert(Number.isFinite(Date.parse(m().finishedAt)));
  assert.equal(rtl.board().levels[0].matches[2].players[0], 'Michał Urbańczyk');
  await ok(rtl.post('undo', { matchId: id }, referee));
  assert.equal(m().status, 'live');
  assert.equal(m().finishedAt, null);
  assert.equal(rtl.board().levels[0].matches[2].players[0], '');
  await ok(rtl.post('undo', { matchId: id }, referee));
  assert.deepEqual(m().sets[2], [9, 10]);
  // Classic third set uses tennis games, not super tiebreak points.
  setPosition(
    [
      [6, 4],
      [4, 6],
    ],
    [0, 0],
    'classic',
  );
  assert.equal(t.pointMode(m(), 'classic'), 'game');
  for (let i = 0; i < 4; i++) await pt(0);
  assert.deepEqual(m().sets[2], [1, 0]);
  // Switching off at a game boundary restores the existing player's permission, without losing games.
  await ok(rtl.post('referee', { matchId: id, enabled: false }, admin));
  assert.deepEqual(m().sets[2], [1, 0]);
  assert.equal((await rtl.post('point', { matchId: id, player: 0 }, referee)).status, 401);
  await ok(rtl.post('add', { matchId: id, player: 0 }, player));
  assert.deepEqual(m().sets[2], [2, 0]);
  // Without a referee, 6:6 is still scored point by point and can be undone.
  setPosition([[6, 6]], [6, 6], 'classic');
  assert.equal((await rtl.post('add', { matchId: id, player: 0 }, player)).status, 400);
  await pt(0, player);
  assert.deepEqual(m().sets, [[6, 6]]);
  assert.deepEqual(m().points, [7, 6]);
  await pt(0, player);
  assert.deepEqual(m().sets, [[7, 6]]);
  assert.deepEqual(m().tieBreaks, { 0: [8, 6] });
  await ok(rtl.post('undo', { matchId: id }, player));
  assert.deepEqual(m().sets, [[6, 6]]);
  assert.deepEqual(m().points, [7, 6]);
  setPosition(
    [
      [6, 4],
      [4, 6],
      [2, 0],
    ],
    [0, 0],
    'classic',
  );
  const enabled = await ok(rtl.post('referee', { matchId: id, enabled: true }, admin));
  const code3 = enabled.levels[0].matches[0].refereeCurrentCode;
  assert.notEqual(code3, refCode2);
  await ok(rtl.post('login', { code: code3 }));
  referee = rtl.cookie();
  setPosition(
    [
      [6, 4],
      [3, 2],
    ],
    [2, 2],
  );

  await ok(rtl.post('new_season', { season: 'Zima 2026', finalsDates: dates }, admin));
  assert.equal((await rtl.post('point', { matchId: id, player: 0 }, referee)).status, 401);
  const archive = (await rtl.get('', admin)).data.archives[0];
  const archived = (await rtl.get(archive.id, '')).data;
  assert(archived.levels[0].matches[0].refereeEnabled);
  assert(!JSON.stringify(archived).includes('refereeSavedCode'));
  assert(!JSON.stringify(archived).includes('refereeCurrentCode'));

  const concurrent = app(projectRoot);
  await ok(concurrent.post('login', { code: 'sulek' }));
  const concurrentAdmin = concurrent.cookie();
  await ok(concurrent.post('season', { season: 'Lato 2026', finalsDates: dates }));
  assert.equal(concurrent.db.prepare('SELECT COUNT(*) AS n FROM match_rows').get().n, 0);
  const concurrentBoard = await ok(
    concurrent.post('create', {
      name: 'Top Pro',
      startSize: 4,
      format: 'super',
      players: ['A', 'B', 'C', 'D'],
      courts: ['1', '2', '3', '4'],
      dates: [dates[0], dates[0], dates[1], dates[1]],
      times: ['15:00', '15:00', '17:00', '17:00'],
    }),
  );
  const [left, right] = concurrentBoard.levels[0].matches;
  const staleBoardRevision = concurrentBoard.revision;
  concurrent.adapter.beforeBatch = () =>
    concurrent.db.prepare("UPDATE boards SET revision=revision+1 WHERE id='main'").run();
  const simultaneous = await Promise.all([
    concurrent.post(
      'start',
      { matchId: left.id, revision: staleBoardRevision, matchRevision: 0 },
      concurrentAdmin,
    ),
    concurrent.post(
      'start',
      { matchId: right.id, revision: staleBoardRevision, matchRevision: 0 },
      concurrentAdmin,
    ),
  ]);
  assert.deepEqual(
    simultaneous.map((response) => response.status),
    [200, 200],
  );
  const concurrentResults = (await concurrent.get()).data.levels[0].matches;
  assert.equal(concurrentResults[0].status, 'live');
  assert.equal(concurrentResults[1].status, 'live');
  assert.equal(concurrentResults[0].matchRevision, 1);
  assert.equal(concurrentResults[1].matchRevision, 1);
  const storedMatches = concurrent.db
    .prepare("SELECT id,data,revision FROM match_rows WHERE board_id='main' AND id IN (?,?)")
    .all(left.id, right.id);
  assert.equal(storedMatches.length, 2);
  assert(
    storedMatches.every((row) => row.revision === 1 && JSON.parse(row.data).status === 'live'),
  );
  const sameMatch = await Promise.all([
    concurrent.post('add', { matchId: left.id, player: 0, matchRevision: 1 }, concurrentAdmin),
    concurrent.post('add', { matchId: left.id, player: 0, matchRevision: 1 }, concurrentAdmin),
  ]);
  assert.deepEqual(sameMatch.map((response) => response.status).sort(), [200, 409]);
  assert.deepEqual(concurrent.board().levels[0].matches[0].sets, [[1, 0]]);
  assert.equal(
    (
      await concurrent.post(
        'add',
        { matchId: left.id, player: 0, matchRevision: 0 },
        concurrentAdmin,
      )
    ).status,
    409,
  );
  await ok(
    concurrent.post('add', { matchId: left.id, player: 0, matchRevision: 2 }, concurrentAdmin),
  );
  assert.deepEqual(concurrent.board().levels[0].matches[0].sets, [[2, 0]]);
  assert.deepEqual(concurrent.board().levels[0].matches[1].sets, [[0, 0]]);
  await ok(concurrent.post('rotate', { matchId: left.id }, concurrentAdmin));
  assert.equal(
    (
      await concurrent.post(
        'add',
        { matchId: left.id, player: 0, matchRevision: 3 },
        concurrentAdmin,
      )
    ).status,
    409,
  );
  console.error = oldLog;
  console.log(
    'PASS: optional PIN, referee/admin/player authorization, deuce/advantage, game and set transitions, both tiebreaks, undo, match finish, rotation/session revocation, independent match writes, same-match CAS, public privacy, archival isolation.',
  );
}
main().catch((e) => {
  process.stderr.write(String(e.stack));
  process.exitCode = 1;
});
