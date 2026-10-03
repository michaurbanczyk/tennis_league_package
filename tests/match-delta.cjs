const assert = require('node:assert/strict');
const { leagueApp } = require('./helpers/league-app.cjs');

function seed(a, count = 15) {
  const levels = Array.from({ length: count }, (_, index) => {
    let n = 0;
    const level = a.tennis.makeLevel(
      'Level ' + index,
      32,
      'level-' + index,
      () => `match-${index}-${n++}`,
    );
    for (const match of level.matches) {
      Object.assign(match, {
        date: '2026-10-03',
        time: '10:00',
        court: '1',
        configured: true,
        savedCode: '12345',
        codeHash: 'private-hash',
        codeFormat: 'pin5',
      });
    }
    a.tennis.entryMatches(level).forEach((m, i) => {
      m.players = [`A-${index}-${i}`, `B-${index}-${i}`];
    });
    return level;
  });
  const board = { levels, season: 'Lato 2026', theme: 'relaksmisja' };
  a.db.prepare('INSERT INTO boards VALUES (?,?,?)').run('main', JSON.stringify(board), 1);
  for (const level of levels)
    for (const match of level.matches)
      a.db
        .prepare('INSERT INTO match_rows VALUES (?,?,?,?)')
        .run('main', match.id, JSON.stringify(match), 0);
  return board;
}
function edit(a, id, fn) {
  const board = a.board();
  const match = board.levels.flatMap((l) => l.matches).find((m) => m.id === id);
  fn(match);
  a.db
    .prepare("UPDATE boards SET data=?,revision=revision+1 WHERE id='main'")
    .run(JSON.stringify(board));
  a.db
    .prepare("UPDATE match_rows SET data=?,revision=revision+1 WHERE board_id='main' AND id=?")
    .run(JSON.stringify(match), id);
}
function revision(a, id) {
  return (
    a.db.prepare("SELECT revision FROM match_rows WHERE board_id='main' AND id=?").get(id)
      ?.revision ?? 0
  );
}
function command(a, action, id, extra = {}, cookie) {
  return a.post(action, { matchId: id, matchRevision: revision(a, id), ...extra }, cookie);
}
function ok(result) {
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}
async function main() {
  const a = leagueApp();
  const initial = seed(a);
  const id = initial.levels[0].matches[0].id;
  const other = initial.levels[1].matches[0].id;
  const unaffected = JSON.stringify(initial.levels.slice(1));
  const initialPublic = ok(await a.get());
  a.resetMetrics();
  const started = ok(await command(a, 'start', id));
  assert.equal(started.kind, 'match-delta');
  assert.equal(started.matches.length, 1);
  assert.equal(started.matches[0].matchRevision, 1);
  assert.equal(started.matches[0].status, 'live');
  assert.equal(started.baseRevision, 1);
  assert.equal(started.revision, 2);
  assert.equal(started.levels, undefined);
  assert.equal(JSON.stringify(a.board().levels.slice(1)), unaffected);
  assert(a.metrics().queries.every((sql) => !/SELECT data,revision FROM boards/i.test(sql)));
  assert(
    a.metrics().queries.every((sql) => !/LEFT JOIN match_rows m ON m.board_id=b.id/i.test(sql)),
  );
  const bytes = a.metrics().returnedBytes;
  const responseBytes = Buffer.byteLength(JSON.stringify(started));

  // Extra unrelated brackets must not increase the bytes returned to Worker JS.
  const small = leagueApp();
  seed(small, 1);
  small.resetMetrics();
  const smallStart = ok(await command(small, 'start', id));
  assert.equal(small.metrics().returnedBytes, bytes);
  assert.equal(Buffer.byteLength(JSON.stringify(smallStart)), responseBytes);
  const legacy = leagueApp();
  seed(legacy);
  legacy.resetMetrics();
  const legacyStart = ok(
    await legacy.post('start', {
      response: 'legacy',
      matchId: id,
      matchRevision: 0,
      revision: 1,
    }),
  );
  const legacyInputBytes = legacy.metrics().returnedBytes;
  const legacyResponseBytes = Buffer.byteLength(JSON.stringify(legacyStart));
  assert(bytes < legacyInputBytes / 5);
  assert(responseBytes < legacyResponseBytes / 5);

  // Delta merging must not conceal missed changes or overwrite a newer snapshot.
  const { mergeMatchDelta } = a.load('src/lib/match-delta.ts');
  const merged = mergeMatchDelta(initialPublic, started);
  assert.equal(merged.levels[0].matches[0].status, 'live');
  assert.equal(merged.levels[1], initialPublic.levels[1]);
  assert.equal(mergeMatchDelta({ ...initialPublic, revision: 0 }, started), null);
  const newer = { ...initialPublic, revision: 50 };
  assert.equal(mergeMatchDelta(newer, started), newer);
  assert.equal(mergeMatchDelta(initialPublic, { ...started, levelId: 'missing' }), null);

  // Two writes to different courts survive a shared board-revision conflict.
  const race = await Promise.all([
    command(a, 'add', id, { player: 0 }),
    command(a, 'start', other),
  ]);
  race.forEach(ok);
  assert.deepEqual(a.board().levels[0].matches[0].sets, [[1, 0]]);
  assert.equal(a.board().levels[1].matches[0].status, 'live');
  const current = revision(a, id);
  const duplicate = await Promise.all([
    command(a, 'add', id, { player: 0, matchRevision: current }),
    command(a, 'add', id, { player: 0, matchRevision: current }),
  ]);
  assert.deepEqual(duplicate.map((r) => r.status).sort(), [200, 409]);
  assert.deepEqual(a.board().levels[0].matches[0].sets, [[2, 0]]);

  // An edit that lands immediately before our transaction is preserved.
  a.adapter.beforeBatch = () =>
    edit(a, other, (m) => {
      m.sets = [[3, 0]];
    });
  ok(await command(a, 'add', id, { player: 1 }));
  assert.deepEqual(a.board().levels[1].matches[0].sets, [[3, 0]]);
  a.adapter.beforeBatch = () =>
    edit(a, id, (m) => {
      m.sets = [[4, 2]];
    });
  assert.equal((await command(a, 'add', id, { player: 1 })).status, 409);
  assert.deepEqual(a.board().levels[0].matches[0].sets, [[4, 2]]);

  // All board/match-row writes roll back together if a later statement fails.
  const beforeFailure = a.board();
  const beforeRevision = revision(a, id);
  a.adapter.failAt = 1;
  const log = console.error;
  console.error = () => {};
  try {
    assert.equal((await command(a, 'add', id, { player: 0 })).status, 400);
  } finally {
    console.error = log;
  }
  assert.deepEqual(a.board(), beforeFailure);
  assert.equal(revision(a, id), beforeRevision);

  // Winner and seed advancement; finished scores cannot be undone.
  edit(a, id, (m) => {
    m.sets = [
      [6, 0],
      [6, 0],
    ];
    m.seeds = [1, null];
  });
  const end = new Date();
  const timing = a.load('src/lib/match-timing.ts');
  const finish = ok(
    await command(a, 'finish', id, {
      finishedDate: timing.localMatchDate(end.toISOString()),
      finishedTime: timing.localMatchTime(end.toISOString()),
    }),
  );
  const next = finish.matches.find((m) => m.id !== id && m.sources?.some((s) => s.matchId === id));
  assert(next);
  assert(next.players.includes(initial.levels[0].matches[0].players[0]));
  assert(next.seeds.includes(1));
  assert.equal(next.matchRevision, revision(a, next.id));
  const completedBoard = a.board();
  assert.equal((await command(a, 'undo', id)).status, 400);
  assert.deepEqual(a.board(), completedBoard);
  assert.equal((await command(a, 'add', id, { player: 0 })).status, 400);

  // Access checks and secret stripping are identical for compact responses.
  assert.equal((await command(a, 'add', other, { player: 0 }, '')).status, 401);
  const player = a.session(other);
  assert.equal((await command(a, 'add', id, { player: 0 }, player)).status, 403);
  const publicResult = ok(await command(a, 'add', other, { player: 0 }, player));
  for (const field of [
    'codeHash',
    'savedCode',
    'currentCode',
    'refereeCodeHash',
    'refereeSavedCode',
    'refereeCurrentCode',
    'refereeToken',
    'history',
  ])
    assert.equal(publicResult.matches[0][field], undefined, field);
  edit(a, other, (m) => {
    m.refereeEnabled = true;
    m.refereeToken = 'current';
    m.refereeSavedCode = '54321';
    m.points = [0, 0];
  });
  assert.equal((await command(a, 'point', other, { player: 0 }, player)).status, 403);
  const referee = a.session(`referee:${other}:current`);
  const refereeResult = ok(await command(a, 'point', other, { player: 0 }, referee));
  assert.deepEqual(refereeResult.matches[0].points, [1, 0]);
  assert.equal(refereeResult.matches[0].refereeCurrentCode, undefined);
  edit(a, other, (m) => {
    m.refereeToken = 'rotated';
  });
  assert.equal((await command(a, 'point', other, { player: 0 }, referee)).status, 401);

  // Elapsed time does not stop a match or block scoring.
  edit(a, other, (m) => {
    m.startedAt = new Date(Date.now() - 48 * 3600000).toISOString();
  });
  const longMatch = ok(await command(a, 'point', other, { player: 0 }));
  assert.equal(longMatch.matches[0].status, 'live');
  assert.equal(longMatch.matches[0].history, undefined);
  assert.equal(longMatch.matches[0].canUndo, undefined);

  // A missing row from an interrupted legacy sync can be initialized atomically.
  const fresh = initial.levels[2].matches[0].id;
  a.db.prepare("DELETE FROM match_rows WHERE board_id='main' AND id=?").run(fresh);
  const initialized = ok(await command(a, 'start', fresh));
  assert.equal(initialized.matches[0].matchRevision, 1);
  // A stale existing row requires reconciliation and a new client revision.
  const board = a.board();
  board.levels[2].matches[0].court = '2';
  a.db
    .prepare("UPDATE boards SET data=?,revision=revision+1 WHERE id='main'")
    .run(JSON.stringify(board));
  assert.equal((await command(a, 'add', fresh, { player: 0 })).status, 409);
  ok(await command(a, 'add', fresh, { player: 0 }));
  assert.equal(a.board().levels[2].matches[0].court, '2');

  // Compatibility: a full read observes the same revision and scores after deltas.
  const full = ok(await a.get());
  assert.equal(full.levels[2].matches[0].matchRevision, revision(a, fresh));
  assert.deepEqual(full.levels[2].matches[0].sets, [[1, 0]]);
  console.log(
    `PASS match delta: permissions, atomic rollback, parallel writes, stale revisions, advancement, no undo/expiry, merging and legacy reads. Worker input ${bytes} bytes; response ${responseBytes} bytes for both 1 and 15 brackets. Legacy at 15 brackets: input ${legacyInputBytes} bytes; response ${legacyResponseBytes} bytes.`,
  );
}
const reportError = console.error;
console.error = () => {}; // Expected rejected mutations are asserted above.
main()
  .catch((error) => {
    reportError(error);
    process.exitCode = 1;
  })
  .finally(() => {
    console.error = reportError;
  });
