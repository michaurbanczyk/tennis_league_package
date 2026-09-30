import './sites-env.mjs';
import { spawnSync } from 'node:child_process';

const config = process.argv[2] ?? 'wrangler.production.jsonc';
if (!['wrangler.production.jsonc', 'wrangler.development.jsonc'].includes(config))
  throw new Error(`Unsupported Wrangler config: ${config}`);

const common = [
  './node_modules/wrangler/bin/wrangler.js',
  'd1',
  'execute',
  'DB',
  '--remote',
  '--config',
  config,
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
    throw new Error(`${config} D1 command failed (${result.status}).`);
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
  throw new Error(`${config} D1 schema is incomplete: found ${[...tables].join(', ')}.`);

if (existingBase.length === 0) {
  execute(['--file', 'drizzle/0000_equal_photon.sql']);
  console.log(`Created D1 tables for ${config}: attempts, boards, sessions.`);
}

if (!tables.has('match_rows')) {
  execute(['--file', 'drizzle/0001_yellow_talkback.sql']);
  console.log(`Created D1 table for ${config}: match_rows.`);
} else {
  console.log(`${config} D1 schema already contains match_rows.`);
}
