import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url),
  wr = createRequire(require.resolve('wrangler'));
const { build } = wr('esbuild');
const bundle = await build({
  entryPoints: ['src/lib/tennis.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { liveCourts, polishDate } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
const { SITE_LEAGUE } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      (
        await build({
          entryPoints: ['src/lib/site-league.ts'],
          bundle: true,
          write: false,
          platform: 'node',
          format: 'esm',
        })
      ).outputFiles[0].text,
    ).toString('base64')
);
const match = (id, court, date, time, status = 'scheduled') => ({
  id,
  court,
  date,
  time,
  status,
  stage: 'Półfinał 1',
  players: ['A', 'B'],
  sets: [[0, 0]],
  winner: null,
});
const board = {
  levels: [
    {
      id: 'pro',
      name: 'Pro',
      format: 'super',
      matches: [
        match('later', '1', '2026-09-26', '19:00'),
        match('tomorrow', '1', '2026-09-27', '17:00'),
        match('live', '1', '2026-09-26', '15:00', 'live'),
        match('next', '1', '2026-09-26', '17:00'),
        match('before', '1', '2026-09-26', '13:00'),
        match('ended', '1', '2026-09-26', '16:00', 'finished'),
        match('today-other', '2', '2026-09-26', '09:00'),
        match('tomorrow-other', '2', '2026-09-27', '10:00'),
        match('undated', '3', '', '10:00'),
      ],
    },
  ],
};
let courts = liveCourts(board, '2026-09-26');
assert.deepEqual(
  courts.map((c) => c.number),
  SITE_LEAGUE === 'relaksmisja' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5],
);
assert.deepEqual(
  courts[0].live.map((e) => e.m.id),
  ['live'],
);
assert.deepEqual(courts[0].live[0].m.sets, [[0, 0]]);
assert.deepEqual(
  courts[0].waiting.map((e) => e.m.id),
  ['next', 'later'],
);
assert.deepEqual(
  courts[1].waiting.map((e) => e.m.id),
  ['today-other'],
);
assert.equal(courts[2].waiting.length, 0);
// A match still in play after midnight retains only its own day's queue.
courts = liveCourts(board, '2026-09-27');
assert.deepEqual(
  courts[0].waiting.map((e) => e.m.id),
  ['next', 'later'],
);
assert.deepEqual(
  courts[1].waiting.map((e) => e.m.id),
  ['tomorrow-other'],
);
board.levels[0].matches.find((m) => m.id === 'live').status = 'finished';
courts = liveCourts(board, '2026-09-27');
assert.ok(courts.every((c) => !c.live.length));
assert.deepEqual(
  courts[0].waiting.map((e) => e.m.id),
  ['tomorrow'],
);
courts = liveCourts(board, '2026-09-28');
assert.ok(courts.every((c) => !c.live.length && !c.waiting.length));
assert.equal(polishDate(new Date('2026-09-26T22:30:00Z')), '2026-09-27');
assert.equal(polishDate(new Date('2026-12-26T23:30:00Z')), '2026-12-27');
console.log(
  'PASS: 0:0 live matches, chronological same-day queues, completed/earlier/undated exclusions, idle courts, empty days and Warsaw midnight.',
);
