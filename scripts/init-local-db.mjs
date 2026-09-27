import './sites-env.mjs';
import { spawnSync } from 'node:child_process';

const wrangler = './node_modules/wrangler/bin/wrangler.js';
const common = [
  wrangler,
  'd1',
  'execute',
  'DB',
  '--local',
  '--config',
  'wrangler.local.jsonc',
  '--persist-to',
  '.wrangler/state',
];

function execute(args) {
  const result = spawnSync(process.execPath, [...common, ...args], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Local D1 command failed (${result.status}).`);
  return result.stdout;
}

const output = execute([
  '--command',
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('attempts','boards','sessions')",
  '--json',
]);
const tables = new Set(JSON.parse(output)[0].results.map((row) => row.name));

if (tables.size === 3) {
  console.log('Local D1 tables already exist.');
} else if (tables.size > 0) {
  throw new Error(`Local D1 schema is incomplete: found ${[...tables].join(', ')}.`);
} else {
  execute(['--file', 'drizzle/0000_equal_photon.sql', '--yes']);
  console.log('Created local D1 tables: attempts, boards, sessions.');
}
