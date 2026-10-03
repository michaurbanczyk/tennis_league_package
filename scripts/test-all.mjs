import { spawnSync } from 'node:child_process';

const tests = [
  'tests/match-delta.cjs',
  'tests/referee.cjs',
  'tests/schedule-backups.cjs',
  'tests/reset-league.cjs',
  'tests/level-management.cjs',
  'tests/live-duration.cjs',
  'tests/horizontal-bracket.cjs',
  'tests/tie-break-display.cjs',
  'tests/bracket-pdf.cjs',
  'tests/live-courts.mjs',
];

for (const test of tests) {
  console.log(`\n${test}`);
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
