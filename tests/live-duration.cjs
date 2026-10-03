const assert = require('node:assert/strict');
const { leagueApp } = require('./helpers/league-app.cjs');

async function main() {
  const a = leagueApp();
  const t = a.tennis;
  const timing = a.load('src/lib/match-timing.ts');
  const api = a.load('src/app/api/league/route.ts');
  const board = t.initialBoard(a.load('src/lib/site-league.ts').SITE_LEAGUE);
  const match = board.levels[0].matches[0];
  Object.assign(match, {
    players: ['A', 'B'],
    court: '1',
    date: '2026-10-03',
    time: '10:00',
    refereeEnabled: true,
  });
  const start = Date.now() - 48 * 3600000;
  t.startMatch(match, start);
  assert.equal(match.history, undefined);
  assert.equal(t.undoScore, undefined);
  assert.equal(t.normalizeLiveMatches, undefined);
  assert.equal(t.LIVE_LIMIT_MS, undefined);
  const measuredAt = Date.now();
  assert.equal(timing.matchElapsed(match, measuredAt), measuredAt - start);
  // No snapshots accumulate even through hundreds of referee point updates.
  for (let i = 0; i < 500; i++) t.addPoint(match, i % 2, 'super');
  assert.equal(match.status, 'live');
  assert.equal(match.history, undefined);
  // Accept a legacy record with a history; hide it and discard it on the next save.
  match.history = [{ sets: [[0, 0]], status: 'live', winner: null }];
  match.canUndo = true;
  a.db.prepare('INSERT INTO boards VALUES (?,?,7)').run('main', JSON.stringify(board));
  a.db
    .prepare('INSERT INTO match_rows VALUES (?,?,?,0)')
    .run('main', match.id, JSON.stringify(match));
  const archivedId = 'archive:' + crypto.randomUUID();
  a.db.prepare('INSERT INTO boards VALUES (?,?,7)').run(archivedId, JSON.stringify(board));
  const storedBeforeRead = a.db.prepare("SELECT data,revision FROM boards WHERE id='main'").get();
  a.resetMetrics();
  const view = await a.get('');
  assert.equal(view.status, 200);
  assert.equal(view.data.levels[0].matches[0].status, 'live');
  assert.equal(view.data.levels[0].matches[0].history, undefined);
  assert.equal(view.data.levels[0].matches[0].canUndo, undefined);
  assert.deepEqual(
    a.db.prepare("SELECT data,revision FROM boards WHERE id='main'").get(),
    storedBeforeRead,
  );
  assert(
    a.metrics().queries.every((sql) => !/\b(UPDATE|INSERT|DELETE)\b/i.test(sql)),
    'GET must perform no writes',
  );
  const admin = a.session('admin');
  async function backup(path) {
    const response = await api.GET(
      new Request('https://example.test/api/league?' + path, { headers: { cookie: admin } }),
    );
    assert.equal(response.status, 200);
    return response.json();
  }
  const exported = await backup('backup=download');
  assert(exported.records.every((r) => r.data.levels[0].matches[0].status === 'live'));
  assert(exported.records.every((r) => r.data.levels[0].matches[0].history === undefined));
  const scored = await a.post('point', { matchId: match.id, matchRevision: 0, player: 0 }, admin);
  assert.equal(scored.status, 200, JSON.stringify(scored.data));
  assert.equal(scored.data.matches[0].status, 'live');
  assert.equal(a.board().levels[0].matches[0].history, undefined);
  assert.equal(a.board().levels[0].matches[0].canUndo, undefined);
  const beforeUndo = a.board();
  const undo = await a.post('undo', { matchId: match.id, matchRevision: 1 }, admin);
  assert.equal(undo.status, 400);
  assert.deepEqual(a.board(), beforeUndo);
  // Old backups can be restored, but cannot reintroduce undo history or expiry.
  exported.records[0].data.levels[0].matches[0].history = [
    { sets: [[1, 0]], status: 'live', winner: null },
  ];
  const current = await a.get(admin);
  const restored = await a.post(
    'restore_backup',
    { backup: exported, confirm: true, revision: current.data.revision },
    admin,
  );
  assert.equal(restored.status, 200, JSON.stringify(restored.data));
  assert.equal(a.board().levels[0].matches[0].status, 'live');
  assert.equal(a.board().levels[0].matches[0].history, undefined);
  // Elapsed duration across a Warsaw DST change is still the actual elapsed time.
  const dst = {
    ...match,
    actualStartedAt: '2026-10-24T21:00:00Z',
    startedAt: '2026-10-24T21:00:00Z',
  };
  assert.equal(timing.matchElapsed(dst, Date.parse('2026-10-26T21:00:00Z')), 48 * 3600000);
  // Legacy unfinished matches retain their state until explicitly resumed.
  const legacy = { ...match, status: 'unfinished', actualStartedAt: match.actualStartedAt };
  t.startMatch(legacy);
  assert.equal(legacy.status, 'live');
  assert.equal(legacy.actualStartedAt, match.actualStartedAt);
  console.log(
    'PASS: unlimited live duration, read-only GET, no undo/snapshots, stripped legacy history, long-running score updates, backup/restore, midnight/DST and legacy resume.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
