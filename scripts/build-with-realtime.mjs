import { spawnSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';

const result = spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build'], {
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

await Promise.all([
  copyFile('build/worker-entry.mjs', 'dist/server/worker-entry.mjs'),
  copyFile('src/realtime-room.mjs', 'dist/server/realtime-room.mjs'),
]);
