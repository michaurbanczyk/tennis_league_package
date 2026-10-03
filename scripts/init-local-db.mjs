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
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('attempts','boards','sessions','match_rows')",
  '--json',
]);
const tables = new Set(JSON.parse(output)[0].results.map((row) => row.name));

const baseTables = ['attempts', 'boards', 'sessions'];
const existingBase = baseTables.filter((name) => tables.has(name));
if (existingBase.length > 0 && existingBase.length < baseTables.length) {
  throw new Error(`Local D1 schema is incomplete: found ${[...tables].join(', ')}.`);
}
if (existingBase.length === 0) {
  execute(['--file', 'drizzle/0000_equal_photon.sql', '--yes']);
  console.log('Created local D1 tables: attempts, boards, sessions.');
}
if (!tables.has('match_rows')) {
  execute(['--file', 'drizzle/0001_yellow_talkback.sql', '--yes']);
  console.log('Created local D1 table: match_rows.');
} else {
  console.log('Local D1 match_rows table already exists.');
}
execute(['--file', 'drizzle/0002_backfill_match_rows.sql', '--yes']);
console.log('Backfilled missing local D1 match records from the active league.');
execute(['--file', 'drizzle/0003_level_rows.sql', '--yes']);
console.log('Created local level_rows and backfilled active league levels.');
execute(['--file', 'drizzle/0004_level_matches.sql', '--yes']);
console.log('Created local level_matches and normalized level-to-match links.');
const normalized = execute([
  '--command',
  "SELECT json_type(data,'$.levels') AS embedded_levels,(SELECT COUNT(*) FROM level_rows WHERE board_id='main') AS levels,(SELECT COUNT(*) FROM match_rows WHERE board_id='main') AS matches,(SELECT COUNT(*) FROM level_matches WHERE board_id='main') AS links FROM boards WHERE id='main'",
  '--json',
]);
console.log(`Local normalized league: ${normalized.trim()}`);
