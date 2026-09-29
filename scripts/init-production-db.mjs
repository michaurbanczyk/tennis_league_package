import './sites-env.mjs';
import { spawnSync } from 'node:child_process';

const common = [
  './node_modules/wrangler/bin/wrangler.js',
  'd1',
  'execute',
  'DB',
  '--remote',
  '--config',
  'wrangler.production.jsonc',
  '--yes',
];

function execute(args) {
  const result = spawnSync(process.execPath, [...common, ...args], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Production D1 command failed (${result.status}).`);
  }
  return result.stdout;
}

const output = execute([
  '--command',
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('attempts','boards','sessions','match_rows')",
  '--json',
]);
const tables = new Set(JSON.parse(output)[0].results.map((row) => row.name));
const baseTables = ['attempts', 'boards', 'sessions'];
const existingBase = baseTables.filter((name) => tables.has(name));

if (existingBase.length > 0 && existingBase.length < baseTables.length)
  throw new Error(`Production D1 schema is incomplete: found ${[...tables].join(', ')}.`);

if (existingBase.length === 0) {
  execute(['--file', 'drizzle/0000_equal_photon.sql']);
  console.log('Created production D1 tables: attempts, boards, sessions.');
}

if (!tables.has('match_rows')) {
  execute(['--file', 'drizzle/0001_yellow_talkback.sql']);
  console.log('Created production D1 table: match_rows.');
} else {
  console.log('Production D1 schema already contains match_rows.');
}
