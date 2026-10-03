// Optional workerd/D1 integration gate: node tests/match-delta-d1.cjs
// Uses ephemeral Miniflare storage; never opens the application's local/live database.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { leagueApp } = require('./helpers/league-app.cjs');
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare');

async function main() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("test"); } };',
    compatibilityDate: '2026-05-15',
    d1Databases: { DB: 'match-delta-test' },
  });
  try {
    const db = await mf.getD1Database('DB');
    const a = leagueApp(db);
    for (const row of a.db.prepare("SELECT sql FROM sqlite_schema WHERE type='table'").all())
      await db.prepare(row.sql).run();
    // Reuse the test session issued in the SQLite helper, without a real login secret.
    for (const row of a.db.prepare('SELECT * FROM sessions').all())
      await db
        .prepare('INSERT INTO sessions VALUES (?,?,?)')
        .bind(row.token, row.scope, row.expires)
        .run();
    const level = a.tennis.makeLevel('D1 test', 4);
    for (const [index, match] of level.matches.entries()) {
      Object.assign(match, { court: String(index + 1), date: '2026-10-03', time: '10:00' });
      if (index < 2) match.players = ['A' + index, 'B' + index];
      await db
        .prepare('INSERT INTO match_rows VALUES (?,?,?,0)')
        .bind('main', match.id, JSON.stringify(match))
        .run();
    }
    await db
      .prepare('INSERT INTO boards VALUES (?,?,1)')
      .bind('main', JSON.stringify({ levels: [level] }))
      .run();
    const id = level.matches[0].id;
    const start = await a.post('start', { matchId: id, matchRevision: 0 });
    assert.equal(start.status, 200, JSON.stringify(start.data));
    assert.equal(start.data.matches[0].matchRevision, 1);
    const scores = await Promise.all([
      a.post('add', { matchId: id, matchRevision: 1, player: 0 }),
      a.post('add', { matchId: id, matchRevision: 1, player: 0 }),
    ]);
    assert.deepEqual(scores.map((r) => r.status).sort(), [200, 409]);
    const row = await db
      .prepare("SELECT data,revision FROM match_rows WHERE board_id='main' AND id=?")
      .bind(id)
      .first();
    assert.equal(row.revision, 2);
    assert.deepEqual(JSON.parse(row.data).sets, [[1, 0]]);
    const board = await db.prepare("SELECT data FROM boards WHERE id='main'").first();
    assert.deepEqual(JSON.parse(board.data).levels[0].matches[0].sets, [[1, 0]]);
    const get = await a.get();
    assert.equal(get.status, 200);
    assert.equal(get.data.levels[0].matches[0].matchRevision, 2);
    console.log(
      'PASS workerd/D1: JSON patch, atomic batch/changes() chain, RETURNING revisions, concurrent same-match conflict, compatible full read.',
    );
  } finally {
    await mf.dispose();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
