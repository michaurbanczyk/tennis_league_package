import { discardLegacyScoreHistory } from './legacy-score-data';
import { validateCourtGroups } from './court-config';
import { normalizeLevelName, levelNameKey, MAX_LEVELS } from './level-settings';
import { z } from 'zod';
import { database } from '@/db/raw';
import { SITE_LEAGUE, LEAGUE_FEATURES } from './site-league';
import {
  validateLevelSeeds,
  propagatePlayers,
  initialBoard,
  courtNumber,
  levelsForTheme,
  type Board,
} from './tennis';
import { normalizeYoutubeUrl } from './youtube';
import { heroBannerSchema } from './hero-banner';

export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const date = z
  .string()
  .refine(
    (s) =>
      !s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s + 'T12:00:00Z')) &&
        new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s),
  );
const time = z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/);
const identifier = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_-]+$/);
const pair = z.array(z.number().int().min(0).max(100000)).length(2);
const score = z.object({
  sets: z.array(pair).min(1).max(3),
  status: z.enum(['scheduled', 'live', 'finished', 'unfinished']),
  startedAt: z.string().datetime().nullable().optional(),
  actualStartedAt: z.string().datetime().nullable().optional(),
  finishedAt: z.string().datetime().nullable().optional(),
  unfinishedAt: z.string().datetime().nullable().optional(),
  winner: z.union([z.literal(0), z.literal(1), z.null()]),
  finishedTime: time.nullable().optional(),
  points: pair.optional(),
  tieBreaks: z.record(z.enum(['0', '1', '2']), pair).optional(),
});
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const match = score.extend({
  id: identifier,
  stage: z.string().min(1).max(80),
  format: z.enum(['super', 'classic']).optional(),
  roundSize: z
    .union([
      z.literal(0),
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(16),
      ...(LEAGUE_FEATURES.bracketEditor ? [z.literal(32)] : []),
    ])
    .optional(),
  sources: z
    .array(z.object({ matchId: identifier, outcome: z.enum(['winner', 'loser']) }))
    .length(2)
    .optional(),
  players: z.array(z.string().max(150)).length(2),
  seeds: z
    .array(
      z
        .number()
        .int()
        .min(1)
        .max(LEAGUE_FEATURES.bracketEditor ? 32 : 16)
        .nullable(),
    )
    .length(2)
    .optional(),
  court: z.string().max(120),
  date: date.optional(),
  time,
  youtubeUrl: z
    .string()
    .max(500)
    .refine((s) => {
      try {
        return !s || !!normalizeYoutubeUrl(s);
      } catch {
        return false;
      }
    })
    .optional(),
  codeHash: hash.optional(),
  savedCode: z.string().min(5).max(64).optional(),
  codeFormat: z.literal('pin5').optional(),
  configured: z.boolean().optional(),
  updated: z.string().max(40).optional(),
  refereeEnabled: z.boolean().optional(),
  refereeCodeHash: hash.optional(),
  refereeSavedCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  refereeToken: identifier.optional(),
});
const boardSchema = z.object({
  theme: z.literal(SITE_LEAGUE).optional(),
  season: z.string().max(60).nullable().optional(),
  heroBanner: heroBannerSchema.optional(),
  finalsDates: z
    .array(date)
    .max(LEAGUE_FEATURES.bracketEditor ? 31 : 4)
    .optional(),
  courtGroups: z
    .array(z.object({ id: z.string(), name: z.string(), courts: z.array(z.string()) }))
    .optional(),
  editionId: identifier.optional(),
  archivedAt: z.string().datetime().optional(),
  levels: z
    .array(
      z.object({
        id: identifier,
        name: z.string().refine((n) => {
          try {
            return normalizeLevelName(n) === n;
          } catch {
            return false;
          }
        }),
        doubles: z.boolean().optional(),
        bracketConfigured: z.boolean().optional(),
        startSize: z
          .union([
            z.literal(2),
            z.literal(4),
            z.literal(8),
            z.literal(16),
            ...(LEAGUE_FEATURES.bracketEditor ? [z.literal(32)] : []),
          ])
          .optional(),
        format: z.enum(['super', 'classic']),
        matches: z
          .array(match)
          .min(1)
          .max(LEAGUE_FEATURES.bracketEditor ? 32 : 16),
      }),
    )
    .max(MAX_LEVELS),
});
const recordSchema = z.object({
  id: z.string().regex(/^main$|^archive:[a-f0-9-]{36}$/),
  data: boardSchema,
});
const backupSchema = z.object({
  format: z.literal('tennis-league-backup'),
  version: LEAGUE_FEATURES.bracketEditor
    ? z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    : z.literal(1),
  league: z.literal(SITE_LEAGUE),
  createdAt: z.string().datetime(),
  records: z.array(recordSchema).min(1).max(201),
});
export type LeagueBackup = z.infer<typeof backupSchema>;

export async function readBackupRequest(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw Error('Brak danych.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw Error(
          limit === BACKUP_MAX_BYTES
            ? 'Plik jest za duży. Maksymalny rozmiar kopii to 10 MB.'
            : 'Za dużo danych.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}

export async function exportBackup(mode: string) {
  const db = database();
  if (mode === 'info') {
    const row = await db.prepare("SELECT id FROM boards WHERE id='recovery:main'").first();
    return Response.json({ recoveryAvailable: !!row }, { headers });
  }
  if (mode !== 'download' && mode !== 'recovery')
    return Response.json({ error: 'Nieznany rodzaj kopii.' }, { status: 400, headers });
  // One SELECT provides a consistent snapshot of the current season and its archive.
  const recovery = mode === 'recovery';
  const rows = await db
    .prepare(
      recovery
        ? "SELECT id,data FROM boards WHERE id LIKE 'recovery:%' ORDER BY id"
        : "SELECT id,data FROM boards WHERE id='main' OR id LIKE 'archive:%' ORDER BY id",
    )
    .all<{ id: string; data: string }>();
  const records = rows.results.map((row) => ({
    id: recovery ? row.id.slice('recovery:'.length) : row.id,
    data: JSON.parse(row.data),
  }));
  if (!records.some((r) => r.id === 'main')) {
    if (recovery)
      return Response.json(
        { error: 'Nie ma jeszcze kopii sprzed przywrócenia.' },
        { status: 404, headers },
      );
    records.push({ id: 'main', data: initialBoard(SITE_LEAGUE) });
  }
  for (const record of records)
    for (const level of record.data.levels)
      for (const match of level.matches) discardLegacyScoreHistory(match);
  const createdAt = new Date().toISOString(),
    backup = {
      format: 'tennis-league-backup',
      version: LEAGUE_FEATURES.bracketEditor ? 4 : 1,
      league: SITE_LEAGUE,
      createdAt,
      records,
    };
  return Response.json(backup, {
    headers: {
      ...headers,
      'Content-Disposition': `attachment; filename="${SITE_LEAGUE}-kopia${recovery ? '-sprzed-przywrocenia' : ''}-${createdAt.replace(/[:.]/g, '-')}.json"`,
    },
  });
}

export function validateBackup(value: unknown): LeagueBackup {
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success)
    throw Error('Nieprawidłowa kopia zapasowa. Wybierz oryginalny plik JSON pobrany z tej ligi.');
  const backup = parsed.data,
    ids = new Set(backup.records.map((r) => r.id));
  if (ids.size !== backup.records.length || !ids.has('main'))
    throw Error('Kopia nie zawiera prawidłowego bieżącego sezonu.');
  for (const { data } of backup.records) {
    if (data.courtGroups) {
      if (!LEAGUE_FEATURES.bracketEditor)
        throw Error('Nieprawidłowa konfiguracja kortów dla tej ligi.');
      data.courtGroups = validateCourtGroups(data.courtGroups);
    }
    const levelIds = new Set<string>(),
      names = new Set<string>(),
      matchIds = new Set<string>();
    for (const l of data.levels) {
      if (
        levelIds.has(l.id) ||
        names.has(levelNameKey(l.name)) ||
        l.matches.length !==
          (l.startSize === 2 && LEAGUE_FEATURES.bracketEditor ? 1 : l.startSize || 4)
      )
        throw Error('Kopia zawiera nieprawidłową drabinkę.');
      validateLevelSeeds(l);
      if (LEAGUE_FEATURES.bracketEditor && l.matches.some((m) => m.seeds)) propagatePlayers(l);
      levelIds.add(l.id);
      names.add(levelNameKey(l.name));
      const earlier = new Set<string>();
      for (const m of l.matches) {
        if (m.court && !courtNumber(m.court, data))
          throw Error('Kopia zawiera nieprawidłowy kort.');
        if (matchIds.has(m.id) || m.sources?.some((s) => !earlier.has(s.matchId)))
          throw Error('Kopia zawiera nieprawidłowe powiązania meczów.');
        if (m.status === 'finished' && m.winner === null)
          throw Error('Kopia zawiera nieprawidłowy wynik meczu.');
        matchIds.add(m.id);
        earlier.add(m.id);
      }
    }
    data.theme = SITE_LEAGUE;
    if (new TextEncoder().encode(JSON.stringify(data)).length > 1900000)
      throw Error('Dane jednego sezonu w kopii są zbyt duże.');
  }
  return backup;
}

export async function restoreBackup(
  value: unknown,
  revision: number,
  exists: boolean,
): Promise<Board | null> {
  const backup = validateBackup(value),
    db = database(),
    token = crypto.randomUUID();
  const next = { ...backup.records.find((r) => r.id === 'main')!.data, restoreToken: token };
  // Every statement is guarded. D1 executes the whole batch atomically; a stale
  // revision cannot replace archives, recovery copies, sessions, or the main board.
  const before = exists
    ? "EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)"
    : "NOT EXISTS (SELECT 1 FROM boards WHERE id='main')";
  const beforeArgs = exists ? [revision] : [];
  const after =
    "EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=? AND json_extract(data,'$.restoreToken')=?)";
  const afterArgs = [revision + 1, token];
  const statements = [
    db.prepare(`DELETE FROM boards WHERE id LIKE 'recovery:%' AND ${before}`).bind(...beforeArgs),
    exists
      ? db
          .prepare(
            `INSERT INTO boards (id,data,revision) SELECT 'recovery:'||id,data,revision FROM boards WHERE (id='main' OR id LIKE 'archive:%') AND ${before}`,
          )
          .bind(...beforeArgs)
      : db
          .prepare(
            `INSERT INTO boards (id,data,revision) SELECT 'recovery:main',?,0 WHERE ${before}`,
          )
          .bind(JSON.stringify(initialBoard(SITE_LEAGUE))),
    exists
      ? db
          .prepare("UPDATE boards SET data=?,revision=revision+1 WHERE id='main' AND revision=?")
          .bind(JSON.stringify(next), revision)
      : db
          .prepare("INSERT OR IGNORE INTO boards (id,data,revision) VALUES ('main',?,1)")
          .bind(JSON.stringify(next)),
    db.prepare(`DELETE FROM boards WHERE id LIKE 'archive:%' AND ${after}`).bind(...afterArgs),
    ...backup.records
      .filter((r) => r.id !== 'main')
      .map((r) =>
        db
          .prepare(`INSERT INTO boards (id,data,revision) SELECT ?,?,0 WHERE ${after}`)
          .bind(r.id, JSON.stringify(r.data), ...afterArgs),
      ),
    db.prepare(`DELETE FROM sessions WHERE scope<>'admin' AND ${after}`).bind(...afterArgs),
  ];
  const result = await db.batch(statements);
  return result[2].meta.changes ? (next as Board) : null;
}
