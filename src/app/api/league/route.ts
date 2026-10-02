import { finishInstant } from '@/lib/match-timing';
import { validateSiteSeason, finalsDates, validCourt } from '@/lib/league-policy';
import { validateCourtGroups, courtGroups, courtEntries } from '@/lib/court-config';
import { normalizeLevelName, levelNameKey, MAX_LEVELS } from '@/lib/level-settings';
import { assertSlotAvailable } from '@/lib/schedule-conflicts';
import { exportBackup, restoreBackup, readBackupRequest, BACKUP_MAX_BYTES } from '@/lib/backups';
import { SITE_LEAGUE, LEAGUE_FEATURES } from '@/lib/site-league';
import { seasonKey, numberedSeason } from '@/lib/league-theme';
import { normalizeYoutubeUrl } from '@/lib/youtube';
import { heroBannerSchema } from '@/lib/hero-banner';
import { database, adminCode } from '@/db/raw';
import { publishLeagueChange } from '@/lib/league-updates';
import {
  matchFormat,
  hasMatchSchedule,
  MATCH_SCHEDULE_REQUIRED,
  validateLevelSeeds,
  normalizeLiveMatches,
  undoScore,
  initialBoard,
  levelsForTheme,
  makeLevel,
  isDoubles,
  entryMatches,
  matchSources,
  propagatePlayers,
  hasStartedDescendant,
  addScore,
  addPoint,
  scoreSnapshot,
  refereeScope,
  startMatch,
  matchWinner,
  type Board,
  type Match,
  type Level,
} from '@/lib/tennis';
export const dynamic = 'force-dynamic';
const scoreActions = new Set(['start', 'point', 'add', 'finish', 'undo']);
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status < 300 && data && typeof data === 'object' && 'revision' in data
        ? { 'X-League-Revision': String(data.revision) }
        : {}),
      ...headers,
    },
  });
async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
async function randomCode(used: Set<string>) {
  const limit = Math.floor(2 ** 32 / 90000) * 90000;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0];
    if (n >= limit) continue;
    const code = String(10000 + (n % 90000)),
      codeHash = await hash(code);
    if (!used.has(codeHash)) {
      used.add(codeHash);
      return { code, codeHash };
    }
  }
  throw Error('Nie udało się wygenerować kodu. Spróbuj ponownie.');
}
async function read() {
  // Persist elapsed live states on read as well as write, so no open editor or
  // browser timer is required. A revision guard preserves concurrent scores.
  for (let attempt = 0; attempt < 4; attempt++) {
    const db = database(),
      row = await db
        .prepare('SELECT data,revision FROM boards WHERE id=?')
        .bind('main')
        .first<{ data: string; revision: number }>();
    const board = row ? (JSON.parse(row.data) as Board) : initialBoard(SITE_LEAGUE),
      revision = row?.revision ?? 0;
    if (!row || !normalizeLiveMatches(board)) return { board, revision, exists: !!row };
    const saved = await db
      .prepare('UPDATE boards SET data=?,revision=revision+1 WHERE id=? AND revision=?')
      .bind(JSON.stringify(board), 'main', revision)
      .run();
    if (saved.meta.changes) {
      await publishLeagueChange(revision + 1);
      return { board, revision: revision + 1, exists: true };
    }
  }
  throw Error('Dane zmieniają się w tej chwili. Spróbuj ponownie.');
}
async function archives() {
  const rows = await database()
    .prepare(
      "SELECT id,json_extract(data,'$.season') AS season,json_extract(data,'$.archivedAt') AS archivedAt FROM boards WHERE id LIKE 'archive:%' ORDER BY archivedAt DESC, id DESC",
    )
    .all();
  return rows.results;
}

async function scope(req: Request) {
  const token = req.headers.get('cookie')?.match(/(?:^|; )tennis_session=([^;]+)/)?.[1];
  if (!token) return null;
  const row = await database()
    .prepare('SELECT scope FROM sessions WHERE token=? AND expires>?')
    .bind(await hash(token), Date.now())
    .first<{ scope: string }>();
  return row?.scope ?? null;
}
function validAccess(b: Board, access: string | null) {
  if (!access || access === 'admin') return access;
  return b.levels.some((l) =>
    l.matches.some(
      (m) => access === m.id || (m.refereeEnabled && m.refereeToken && access === refereeScope(m)),
    ),
  )
    ? access
    : null;
}
function publicData(b: Board, access: string | null = null) {
  return {
    theme: SITE_LEAGUE,
    season: b.season ?? null,
    ...(b.heroBanner ? { heroBanner: b.heroBanner } : {}),
    finalsDates: b.finalsDates ?? [],
    ...(b.courtGroups ? { courtGroups: b.courtGroups } : {}),
    levels: b.levels.map((l) => ({
      ...l,
      matches: l.matches.map(
        ({
          codeHash,
          savedCode,
          currentCode,
          refereeCodeHash,
          refereeSavedCode,
          refereeCurrentCode,
          refereeToken,
          history,
          ...m
        }) => ({
          ...m,
          ...(access === 'admin' && savedCode ? { currentCode: savedCode } : {}),
          ...(access === 'admin' && m.refereeEnabled && refereeSavedCode
            ? { refereeCurrentCode: refereeSavedCode }
            : {}),
          needsCodeUpgrade: !!codeHash && m.codeFormat !== 'pin5',
          canUndo: !!history?.length,
        }),
      ),
    })),
  };
}
const placeholderFields = new Set([
  'id',
  'stage',
  'roundSize',
  'sources',
  'players',
  'court',
  'time',
  'sets',
  'status',
  'winner',
  'history',
]);
function isPlaceholderMatch(match: Match) {
  return (
    match.status === 'scheduled' &&
    match.winner === null &&
    match.players.length === 2 &&
    match.players.every((player) => !player) &&
    !match.court &&
    !match.time &&
    match.sets.length === 1 &&
    match.sets[0].length === 2 &&
    match.sets[0].every((score) => score === 0) &&
    !match.history?.length &&
    Object.keys(match).every((field) => placeholderFields.has(field))
  );
}
async function published(b: Board, access: string | null, boardRevision: number) {
  const db = database();
  const matches = b.levels
    .flatMap((level) => level.matches)
    .filter((match) => !isPlaceholderMatch(match));
  const existing = await db
    .prepare(
      "SELECT m.id,m.data,m.revision,b.revision AS boardRevision FROM boards b LEFT JOIN match_rows m ON m.board_id=b.id WHERE b.id='main'",
    )
    .all<{
      id: string | null;
      data: string | null;
      revision: number | null;
      boardRevision: number;
    }>();
  const currentBoardRevision = existing.results[0]?.boardRevision ?? boardRevision;
  const current = new Map(existing.results.filter((row) => row.id).map((row) => [row.id, row]));
  const changed =
    currentBoardRevision === boardRevision
      ? matches.filter((match) => current.get(match.id)?.data !== JSON.stringify(match))
      : [];
  const activeIds = new Set(matches.map((match) => match.id));
  const stale =
    currentBoardRevision === boardRevision &&
    existing.results.some((row) => row.id !== null && !activeIds.has(row.id));
  const statements = changed.map((match) =>
    db
      .prepare(
        "INSERT INTO match_rows (board_id,id,data,revision) SELECT 'main',?,?,0 WHERE EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?) ON CONFLICT(board_id,id) DO UPDATE SET data=excluded.data,revision=match_rows.revision+1 WHERE match_rows.data<>excluded.data",
      )
      .bind(match.id, JSON.stringify(match), boardRevision),
  );
  if (stale) {
    const ids = [...activeIds];
    statements.push(
      db
        .prepare(
          `DELETE FROM match_rows WHERE board_id='main' ${ids.length ? `AND id NOT IN (${ids.map(() => '?').join(',')})` : ''} AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)`,
        )
        .bind(...ids, boardRevision),
    );
  }
  if (statements.length) await db.batch(statements);
  const rows = statements.length
    ? await db
        .prepare(
          "SELECT m.id,m.data,m.revision,b.revision AS boardRevision FROM boards b LEFT JOIN match_rows m ON m.board_id=b.id WHERE b.id='main'",
        )
        .all<{
          id: string | null;
          data: string | null;
          revision: number | null;
          boardRevision: number;
        }>()
    : existing;
  const consistent = (rows.results[0]?.boardRevision ?? boardRevision) === boardRevision;
  const revisions = new Map(
    rows.results.filter((row) => row.id).map((row) => [row.id, row.revision]),
  );
  const data = publicData(b, access);
  return {
    ...data,
    levels: data.levels.map((level) => ({
      ...level,
      matches: level.matches.map((match) => ({
        ...match,
        matchRevision: consistent ? (revisions.get(match.id) ?? 0) : -1,
      })),
    })),
  };
}
async function publishedAfterCommit(b: Board, access: string | null, boardRevision: number) {
  try {
    return await published(b, access, boardRevision);
  } catch (error) {
    console.error('match revision sync failed after save', error);
    return publicData(b, access);
  }
}
function validDate(value: unknown) {
  const s = String(value ?? '');
  if (!s) return '';
  const d = new Date(s + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== s
  )
    throw Error('Wpisz prawidłową datę meczu.');
  return s;
}
function validTime(value: unknown) {
  const s = String(value ?? '');
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Error('Wpisz prawidłową godzinę meczu.');
  return s;
}
function startTime(value: unknown) {
  const time = validTime(value);
  if (!time) throw Error('Podaj godzinę rozpoczęcia meczu.');
  return time;
}
function matchDate(value: unknown, board: Board, existingDate?: string) {
  const date = validDate(value);
  if (!date) throw Error('Wybierz datę meczu.');
  if (board.finalsDates?.length && !board.finalsDates.includes(date) && date !== existingDate)
    throw Error('Wybierz jedną z dat finałów ustawionych przez organizatora.');
  return date;
}
export async function GET(req: Request) {
  try {
    const backupMode = new URL(req.url).searchParams.get('backup');
    if (backupMode) {
      if ((await scope(req)) !== 'admin')
        return json({ error: 'Tylko organizator może pobierać kopie zapasowe.' }, 403);
      return await exportBackup(backupMode);
    }
    const archiveId = new URL(req.url).searchParams.get('archive');
    if (archiveId) {
      if (!/^archive:[a-f0-9-]{36}$/.test(archiveId))
        return json({ error: 'Nie znaleziono sezonu w archiwum.' }, 404);
      const row = await database()
        .prepare('SELECT data FROM boards WHERE id=?')
        .bind(archiveId)
        .first<{ data: string }>();
      if (!row) return json({ error: 'Nie znaleziono sezonu w archiwum.' }, 404);
      return json({ ...publicData(JSON.parse(row.data)), archived: true, archiveId, scope: null });
    }
    const { board, revision } = await read();
    const access = validAccess(board, await scope(req));
    return json({
      ...(await published(board, access, revision)),
      archives: await archives(),
      revision,
      scope: access,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    console.error('league read failed', e);
    return json({ error: 'Nie udało się pobrać wyników. Spróbuj ponownie.' }, 503);
  }
}
export async function POST(req: Request) {
  const response = await handlePost(req, 0);
  const revisionHeader = response.headers.get('X-League-Revision');
  if (response.ok && revisionHeader !== null) {
    const revision = Number(revisionHeader);
    if (Number.isSafeInteger(revision)) await publishLeagueChange(revision);
  }
  return response;
}
async function handlePost(req: Request, retry: number): Promise<Response> {
  try {
    if (req.headers.get('sec-fetch-site') === 'cross-site')
      return json({ error: 'Niedozwolone żądanie.' }, 403);
    if (!req.headers.get('content-type')?.includes('application/json'))
      return json({ error: 'Nieprawidłowe dane.' }, 400);
    const restoring = new URL(req.url).searchParams.get('restore') === '1';
    if (restoring && (await scope(req)) !== 'admin')
      return json({ error: 'Tylko organizator może przywracać kopie zapasowe.' }, 403);
    const raw = await readBackupRequest(req, restoring ? BACKUP_MAX_BYTES : 12000);
    const body = JSON.parse(raw);
    const independentScore = scoreActions.has(body.action) && Number.isInteger(body.matchRevision);
    const db = database();
    const { board, revision, exists } = await read();
    if (body.action === 'login') {
      const code = String(body.code ?? '')
        .replace(/[\s-]/g, '')
        .toUpperCase();
      if (code.length < 5 || code.length > 64)
        return json({ error: 'Sprawdź kod i spróbuj ponownie.' }, 401);
      const ip = req.headers.get('cf-connecting-ip') || 'unknown';
      const key = await hash(ip + ':' + Math.floor(Date.now() / 600000));
      const attempt = await db
        .prepare(
          'INSERT INTO attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
        )
        .bind(key, Date.now() + 600000)
        .first<{ count: number }>();
      if ((attempt?.count ?? 99) > 20)
        return json({ error: 'Zbyt wiele prób. Spróbuj ponownie za 10 minut.' }, 429);
      const h = await hash(code);
      const admin = adminCode();
      let access = admin && h === (await hash(admin)) ? 'admin' : null;
      if (!access)
        for (const l of board.levels)
          for (const m of l.matches) {
            if (m.codeHash === h) access = m.id;
            else if (m.refereeEnabled && m.refereeToken && m.refereeCodeHash === h)
              access = refereeScope(m);
          }
      if (body.role === 'referee' && !access?.startsWith('referee:'))
        return json(
          { error: 'Nieprawidłowy kod sędziego. Poproś organizatora o osobny kod sędziego.' },
          401,
        );
      if (!access)
        return json({ error: 'Nieprawidłowy kod. Poproś organizatora o kod do meczu.' }, 401);
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db.batch([
        db.prepare('UPDATE attempts SET count=count-1 WHERE key=?').bind(key),
        db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),
        db.prepare('DELETE FROM attempts WHERE expires<?').bind(Date.now()),
        db
          .prepare('INSERT INTO sessions (token,scope,expires) VALUES (?,?,?)')
          .bind(await hash(token), access, Date.now() + 43200000),
      ]);
      return json({ scope: access }, 200, {
        'Set-Cookie': `tennis_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`,
      });
    }
    const access = validAccess(board, await scope(req));
    if (!access) return json({ error: 'Wpisz kod, aby edytować wyniki.' }, 401);
    if (body.action === 'logout') {
      const token = req.headers.get('cookie')?.match(/(?:^|; )tennis_session=([^;]+)/)?.[1];
      if (token)
        await db
          .prepare('DELETE FROM sessions WHERE token=?')
          .bind(await hash(token))
          .run();
      return json({ ok: true }, 200, {
        'Set-Cookie': 'tennis_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
      });
    }
    if (!independentScore && body.revision !== revision)
      return json(
        {
          error:
            body.action === 'reset_league'
              ? 'Dane zmieniły się od otwarcia potwierdzenia. Zamknij okno, sprawdź bieżącą ligę i ponów zerowanie.'
              : 'Wynik został zmieniony na innym urządzeniu. Odświeżono dane — sprawdź wynik i ponów działanie.',
        },
        409,
      );
    if (body.action === 'delete_archive') {
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może usuwać sezony z archiwum.' }, 403);
      if (body.confirm !== true) throw Error('Potwierdź usunięcie wybranego sezonu z archiwum.');
      const archiveId = String(body.archiveId ?? '');
      if (!/^archive:[a-f0-9-]{36}$/.test(archiveId))
        return json({ error: 'Nie znaleziono sezonu w archiwum.' }, 404);
      if (!(await db.prepare('SELECT id FROM boards WHERE id=?').bind(archiveId).first()))
        return json(
          { error: 'Ten sezon został już usunięty z archiwum. Odśwież listę sezonów.' },
          404,
        );
      const ip = req.headers.get('cf-connecting-ip') || 'unknown',
        key = await hash('delete-archive:' + ip + ':' + Math.floor(Date.now() / 600000));
      const attempt = await db
        .prepare(
          'INSERT INTO attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
        )
        .bind(key, Date.now() + 600000)
        .first<{ count: number }>();
      if ((attempt?.count ?? 99) > 10)
        return json(
          { error: 'Zbyt wiele prób potwierdzenia hasła. Spróbuj ponownie za 10 minut.' },
          429,
        );
      const password = String(body.adminPassword ?? '')
          .replace(/[\s-]/g, '')
          .toUpperCase(),
        secret = adminCode();
      if (
        !secret ||
        password.length < 5 ||
        password.length > 64 ||
        (await hash(password)) !== (await hash(secret))
      )
        return json({ error: 'Nieprawidłowe hasło organizatora. Sezon nie został usunięty.' }, 401);
      // One transaction: advance the shared revision only if the selected archive
      // still exists, then delete only when that guarded update succeeded.
      const saved = await db.batch([
        db
          .prepare(
            "UPDATE boards SET revision=revision+1 WHERE id='main' AND revision=? AND EXISTS (SELECT 1 FROM boards WHERE id=?)",
          )
          .bind(revision, archiveId),
        db.prepare('DELETE FROM boards WHERE id=? AND changes()=1').bind(archiveId),
      ]);
      if (!saved[0].meta.changes)
        return json(
          {
            error:
              'Dane zmieniły się podczas potwierdzania. Zamknij okno, odśwież archiwum i spróbuj ponownie.',
          },
          409,
        );
      return json({
        ...(await publishedAfterCommit(board, access, revision + 1)),
        archives: await archives(),
        revision: revision + 1,
        scope: access,
      });
    }
    if (body.action === 'reset_league') {
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może zerować ustawienia ligi.' }, 403);
      if (body.confirm !== true) throw Error('Potwierdź wyzerowanie ustawień bieżącej ligi.');
      const ip = req.headers.get('cf-connecting-ip') || 'unknown';
      const key = await hash('reset-league:' + ip + ':' + Math.floor(Date.now() / 600000));
      const attempt = await db
        .prepare(
          'INSERT INTO attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
        )
        .bind(key, Date.now() + 600000)
        .first<{ count: number }>();
      if ((attempt?.count ?? 99) > 10)
        return json(
          { error: 'Zbyt wiele prób potwierdzenia hasła. Spróbuj ponownie za 10 minut.' },
          429,
        );
      const password = String(body.adminPassword ?? '')
          .replace(/[\s-]/g, '')
          .toUpperCase(),
        secret = adminCode();
      if (
        !secret ||
        password.length < 5 ||
        password.length > 64 ||
        (await hash(password)) !== (await hash(secret))
      )
        return json(
          { error: 'Nieprawidłowe hasło administratora. Ustawienia ligi nie zostały zmienione.' },
          401,
        );
      const editionId = crypto.randomUUID();
      const next = {
        ...initialBoard(SITE_LEAGUE),
        theme: SITE_LEAGUE,
        season: null,
        finalsDates: [],
        editionId,
      };
      next.levels = next.levels.map((l) => makeLevel(l.name, 4, l.id, () => crypto.randomUUID()));
      // Reset only the current board, without creating a backup or archive.
      // The guarded batch also revokes existing player/referee sessions atomically.
      const saved = await db.batch([
        exists
          ? db
              .prepare(
                "UPDATE boards SET data=?,revision=revision+1 WHERE id='main' AND revision=?",
              )
              .bind(JSON.stringify(next), revision)
          : db
              .prepare("INSERT OR IGNORE INTO boards (id,data,revision) VALUES ('main',?,1)")
              .bind(JSON.stringify(next)),
        db
          .prepare(
            "DELETE FROM sessions WHERE scope<>'admin' AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=? AND json_extract(data,'$.editionId')=?)",
          )
          .bind(revision + 1, editionId),
      ]);
      if (!saved[0].meta.changes)
        return json(
          {
            error:
              'Dane zmieniły się podczas potwierdzania. Zamknij okno, sprawdź bieżącą ligę i ponów zerowanie.',
          },
          409,
        );
      return json({
        ...(await publishedAfterCommit(next, access, revision + 1)),
        archives: await archives(),
        revision: revision + 1,
        scope: access,
      });
    }
    if (body.action === 'restore_backup') {
      if (!restoring || access !== 'admin')
        return json({ error: 'Tylko organizator może przywracać kopie zapasowe.' }, 403);
      if (body.confirm !== true) throw Error('Potwierdź zastąpienie danych kopią zapasową.');
      const restored = await restoreBackup(body.backup, revision, exists);
      if (!restored)
        return json(
          {
            error:
              'Dane zmieniły się podczas przywracania. Pobierz aktualną kopię, sprawdź dane i spróbuj ponownie.',
          },
          409,
        );
      return json({
        ...(await publishedAfterCommit(restored, access, revision + 1)),
        archives: await archives(),
        revision: revision + 1,
        scope: access,
      });
    }
    if (body.action === 'new_season') {
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może rozpocząć nowy sezon.' }, 403);
      if (!exists || !board.season) throw Error('Najpierw zapisz oznaczenie bieżącego sezonu.');
      const season = validateSiteSeason(body.season),
        dates = finalsDates(body.finalsDates, validDate);
      if (seasonKey(season) === seasonKey(board.season))
        throw Error('Wpisz inną nazwę nowego sezonu.');
      if (
        SITE_LEAGUE !== 'relaksmisja' &&
        numberedSeason.test(season) &&
        numberedSeason.test(board.season) &&
        season <= board.season
      )
        throw Error('Wybierz sezon późniejszy niż bieżący.');
      if ((await archives()).some((a: any) => seasonKey(a.season) === seasonKey(season)))
        throw Error('Ten sezon jest już w archiwum.');
      const editionId = crypto.randomUUID(),
        archiveId = 'archive:' + crypto.randomUUID();
      const next = {
        ...initialBoard(SITE_LEAGUE),
        theme: SITE_LEAGUE,
        season,
        finalsDates: dates,
        ...(LEAGUE_FEATURES.bracketEditor
          ? {
              courtGroups:
                body.courtGroups === undefined
                  ? courtGroups(board)
                  : validateCourtGroups(body.courtGroups),
            }
          : {}),
        editionId,
      };
      next.levels = board.levels.map((l) => ({
        ...makeLevel(l.name, 4, l.id, () => crypto.randomUUID()),
        doubles: isDoubles(l),
      }));
      const saved = await db.batch([
        db
          .prepare(
            'INSERT INTO boards (id,data,revision) SELECT ?,?,revision FROM boards WHERE id=? AND revision=?',
          )
          .bind(
            archiveId,
            JSON.stringify({ ...board, archivedAt: new Date().toISOString() }),
            'main',
            revision,
          ),
        db
          .prepare('UPDATE boards SET data=?,revision=revision+1 WHERE id=? AND revision=?')
          .bind(JSON.stringify(next), 'main', revision),
        db
          .prepare(
            "DELETE FROM sessions WHERE scope<>? AND EXISTS (SELECT 1 FROM boards WHERE id=? AND revision=? AND json_extract(data,'$.editionId')=?)",
          )
          .bind('admin', 'main', revision + 1, editionId),
      ]);
      if (!saved[1].meta.changes)
        return json(
          { error: 'Dane zostały zmienione na innym urządzeniu. Sprawdź je i spróbuj ponownie.' },
          409,
        );
      return json({
        ...(await publishedAfterCommit(next, access, revision + 1)),
        archives: await archives(),
        revision: revision + 1,
        scope: access,
      });
    }
    let codes: Record<string, string> | undefined;
    let scoredMatch: Match | null = null;
    const usedCodes = new Set(
      board.levels.flatMap((l) =>
        l.matches.flatMap((m) => [m.codeHash, m.refereeCodeHash]).filter((h): h is string => !!h),
      ),
    );
    if (
      ['create', 'create_bracket', 'details', 'rotate', 'referee', 'upgrade_codes'].includes(
        body.action,
      )
    ) {
      const oldCodes = await db
        .prepare(
          "SELECT DISTINCT j.value AS codeHash FROM boards,json_tree(boards.data) AS j WHERE boards.id LIKE 'archive:%' AND j.key IN ('codeHash','refereeCodeHash')",
        )
        .all<{ codeHash: string }>();
      for (const row of oldCodes.results) usedCodes.add(row.codeHash);
    }
    if (adminCode()) usedCodes.add(await hash(adminCode()!.toUpperCase()));
    if (body.action === 'upgrade_codes') {
      if (access !== 'admin') return json({ error: 'Tylko organizator może zmieniać kody.' }, 403);
      codes = {};
      for (const l of board.levels)
        for (const m of l.matches)
          if (m.codeHash && m.codeFormat !== 'pin5') {
            const generated = await randomCode(usedCodes);
            m.codeHash = generated.codeHash;
            m.savedCode = generated.code;
            m.codeFormat = 'pin5';
            codes[m.id] = generated.code;
          }
      if (!Object.keys(codes).length)
        return json({
          ...(await published(board, access, revision)),
          revision,
          scope: access,
          codes,
        });
    } else if (body.action === 'theme') {
      return json(
        { error: 'Każda liga ma własny adres. Przejdź do wybranej ligi linkiem na dole strony.' },
        400,
      );
    } else if (body.action === 'hero_banner') {
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może zmieniać tekst banera.' }, 403);
      if (SITE_LEAGUE !== 'relaksmisja')
        return json({ error: 'Ta liga nie ma edytowalnego banera.' }, 400);
      const banner = heroBannerSchema.safeParse(body.heroBanner);
      if (!banner.success) return json({ error: 'Sprawdź tekst i rozmiary czcionek banera.' }, 400);
      const bannerSeason = validateSiteSeason(banner.data.season);
      if (
        seasonKey(bannerSeason) !== seasonKey(board.season || '') &&
        (await archives()).some(
          (archive: any) => seasonKey(archive.season) === seasonKey(bannerSeason),
        )
      )
        throw Error('Ten sezon jest już w archiwum.');
      board.season = bannerSeason;
      board.heroBanner = { ...banner.data, season: bannerSeason };
    } else if (body.action === 'season') {
      if (access !== 'admin') return json({ error: 'Tylko organizator może zmieniać sezon.' }, 403);
      const season = validateSiteSeason(body.season);
      if ((await archives()).some((a: any) => seasonKey(a.season) === seasonKey(season)))
        throw Error('Ten sezon jest już w archiwum.');
      if (SITE_LEAGUE === 'relaksmisja' && board.heroBanner) board.heroBanner.season = season;
      board.season = season;
      if (body.finalsDates !== undefined) {
        const dates = finalsDates(body.finalsDates, validDate);
        if (
          LEAGUE_FEATURES.bracketEditor &&
          board.levels.some((l) => l.matches.some((m) => m.date && !dates.includes(m.date)))
        )
          throw Error('Najpierw zmień daty meczów przypisanych do usuwanego dnia.');
        board.finalsDates = dates;
      }
      if (body.courtGroups !== undefined) {
        if (!LEAGUE_FEATURES.bracketEditor) throw Error('Ta liga ma stałą konfigurację kortów.');
        const groups = validateCourtGroups(body.courtGroups),
          oldCourts = courtEntries(board),
          nextCourts = courtEntries({ courtGroups: groups });
        for (const l of board.levels)
          for (const m of l.matches)
            if (m.court) {
              const old = oldCourts.find((c) => c.id === validCourt(m.court, board)),
                next = nextCourts.find((c) => c.id === old?.id);
              if (!next || next.groupId !== old?.groupId)
                throw Error('Najpierw przenieś mecze z usuwanych kortów.');
            }
        board.courtGroups = groups;
      }
    } else if (['add_level', 'rename_level', 'delete_level'].includes(body.action)) {
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może zarządzać poziomami.' }, 403);
      const level =
        body.action === 'add_level' ? undefined : board.levels.find((l) => l.id === body.levelId);
      if (body.action !== 'add_level' && !level)
        return json({ error: 'Nie znaleziono poziomu. Odśwież dane i wybierz go ponownie.' }, 404);
      if (body.action === 'delete_level') {
        if (body.confirm !== true)
          throw Error('Potwierdź usunięcie poziomu wraz z jego meczami i wynikami.');
        const ip = req.headers.get('cf-connecting-ip') || 'unknown',
          key = await hash('delete-level:' + ip + ':' + Math.floor(Date.now() / 600000));
        const attempt = await db
          .prepare(
            'INSERT INTO attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
          )
          .bind(key, Date.now() + 600000)
          .first<{ count: number }>();
        if ((attempt?.count ?? 99) > 10)
          return json(
            { error: 'Zbyt wiele prób potwierdzenia hasła. Spróbuj ponownie za 10 minut.' },
            429,
          );
        const password = String(body.adminPassword ?? '')
            .replace(/[\s-]/g, '')
            .toUpperCase(),
          secret = adminCode();
        if (
          !secret ||
          password.length < 5 ||
          password.length > 64 ||
          (await hash(password)) !== (await hash(secret))
        )
          return json(
            { error: 'Nieprawidłowe hasło organizatora. Poziom nie został usunięty.' },
            401,
          );
        board.levels = board.levels.filter((l) => l.id !== level!.id);
      } else {
        const name = normalizeLevelName(body.name);
        if (
          board.levels.some(
            (l) => l.id !== level?.id && levelNameKey(l.name) === levelNameKey(name),
          )
        )
          throw Error('Poziom o tej nazwie już istnieje. Wpisz inną nazwę.');
        if (body.action === 'rename_level') {
          level!.doubles = isDoubles(level!);
          level!.name = name;
        } else {
          if (board.levels.length >= MAX_LEVELS)
            throw Error('Możesz utworzyć maksymalnie 64 poziomy.');
          if (typeof body.doubles !== 'boolean') throw Error('Wybierz grę pojedynczą lub debel.');
          board.levels.push({
            ...makeLevel(name, 4, crypto.randomUUID(), () => crypto.randomUUID()),
            doubles: body.doubles,
          });
        }
      }
    } else if (body.action === 'create_bracket') {
      if (!LEAGUE_FEATURES.bracketEditor) throw Error('Ta liga korzysta z formularza par.');
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może tworzyć drabinki.' }, 403);
      const index = board.levels.findIndex((l) => l.id === body.levelId);
      if (index < 0) throw Error('Wybierz poziom.');
      const previous = board.levels[index],
        size = Number(body.startSize);
      if (![2, 4, 8, 16, 32].includes(size)) throw Error('Wybierz od 1 do 5 rund.');
      if (
        previous.matches.some(
          (m) =>
            m.configured ||
            m.players.some(Boolean) ||
            m.date ||
            m.time ||
            m.court ||
            m.status !== 'scheduled' ||
            m.codeHash,
        )
      )
        throw Error('Ta drabinka zawiera już dane. Edytuj jej mecze lub utwórz nowy poziom.');
      const level = makeLevel(previous.name, size, previous.id, () => crypto.randomUUID());
      level.doubles = isDoubles(previous);
      level.bracketConfigured = true;
      level.format = body.format === 'classic' ? 'classic' : 'super';
      if (body.roundFormats !== undefined) {
        if (
          !body.roundFormats ||
          typeof body.roundFormats !== 'object' ||
          Array.isArray(body.roundFormats)
        )
          throw Error('Wybierz format każdej rundy.');
        const rounds = new Set(level.matches.map((m) => String(m.roundSize ?? 0)));
        if (
          Object.keys(body.roundFormats).some((k) => !rounds.has(k)) ||
          [...rounds].some((k) => !['super', 'classic'].includes(body.roundFormats[k]))
        )
          throw Error('Wybierz format każdej rundy.');
        for (const m of level.matches) m.format = body.roundFormats[String(m.roundSize ?? 0)];
      }
      board.levels[index] = level;
    } else if (body.action === 'create') {
      if (access !== 'admin')
        return json({ error: 'Tylko organizator może dodawać poziomy.' }, 403);
      const existing = board.levels.findIndex((l) =>
        body.levelId ? l.id === body.levelId : l.name === body.name,
      );
      if (existing < 0) throw Error('Wybierz istniejący poziom lub najpierw dodaj nowy.');
      const targetLevel = board.levels[existing],
        name = targetLevel.name,
        size = Number(body.startSize ?? 4);
      if (![4, 8, 16].includes(size))
        throw Error('Wybierz półfinały, ćwierćfinały lub 1/8 finału.');
      const players = Array.isArray(body.players)
        ? body.players.map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
        : [];
      const maxLength = isDoubles(targetLevel) ? 150 : 70;
      if (
        players.length !== size ||
        players.some((p: string) => !p || p.length > maxLength) ||
        new Set(players.map((p: string) => p.toLocaleLowerCase('pl-PL'))).size !== size
      )
        throw Error(`Wpisz ${size} różnych ${isDoubles(targetLevel) ? 'par' : 'zawodników'}.`);
      if (
        existing >= 0 &&
        entryMatches(board.levels[existing]).some((m) => m.players.some(Boolean))
      )
        throw Error('Pary tego poziomu są już ustawione. Zmień je w ustawieniach meczu.');
      const l = makeLevel(
        name,
        size,
        existing >= 0 ? board.levels[existing].id : crypto.randomUUID(),
        () => crypto.randomUUID(),
      );
      if (
        body.referees !== undefined &&
        (!Array.isArray(body.referees) ||
          body.referees.length !== size ||
          body.referees.some((v: unknown) => typeof v !== 'boolean'))
      )
        throw Error('Sprawdź opcje sędziowania meczów.');
      l.doubles = isDoubles(targetLevel);
      l.format = body.format === 'classic' ? 'classic' : 'super';
      codes = {};
      for (let i = 0; i < l.matches.length; i++) {
        const m = l.matches[i],
          generated = await randomCode(usedCodes);
        codes[m.id] = generated.code;
        if (i < size / 2) m.players = players.slice(i * 2, i * 2 + 2);
        Object.assign(m, {
          court: validCourt(body.courts?.[i], board),
          date: matchDate(body.dates?.[i], board),
          time: startTime(body.times?.[i]),
          codeHash: generated.codeHash,
          savedCode: generated.code,
          codeFormat: 'pin5',
        });
        if (body.referees?.[i]) {
          const r = await randomCode(usedCodes);
          Object.assign(m, {
            refereeEnabled: true,
            refereeCodeHash: r.codeHash,
            refereeSavedCode: r.code,
            refereeToken: crypto.randomUUID(),
            points: [0, 0],
          });
        }
      }
      if (existing >= 0) board.levels[existing] = l;
      else board.levels.push(l);
      for (const match of l.matches) assertSlotAvailable(board, match);
    } else {
      const level = board.levels.find((l) => l.matches.some((m) => m.id === body.matchId));
      const match = level?.matches.find((m) => m.id === body.matchId);
      if (!level || !match) return json({ error: 'Nie znaleziono meczu.' }, 404);
      if (access !== 'admin' && access !== match.id && access !== refereeScope(match))
        return json({ error: 'Ten kod nie pozwala edytować tego meczu.' }, 403);
      if (independentScore) {
        const row = await db
          .prepare("SELECT data,revision FROM match_rows WHERE board_id='main' AND id=?")
          .bind(match.id)
          .first<{ data: string; revision: number }>();
        if (row && row.data !== JSON.stringify(match)) {
          await db
            .prepare(
              "UPDATE match_rows SET data=?,revision=revision+1 WHERE board_id='main' AND id=? AND revision=? AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)",
            )
            .bind(JSON.stringify(match), match.id, row.revision, revision)
            .run();
          return json(
            { error: 'Mecz został zmieniony. Odświeżono dane — sprawdź wynik i ponów działanie.' },
            409,
          );
        }
        if ((row?.revision ?? 0) !== body.matchRevision)
          return json(
            {
              error:
                'Wynik tego meczu został zmieniony. Odświeżono dane — sprawdź wynik i ponów działanie.',
            },
            409,
          );
        scoredMatch = match;
      }
      if (
        LEAGUE_FEATURES.bracketEditor &&
        ['start', 'add', 'point', 'finish', 'undo'].includes(body.action) &&
        !hasMatchSchedule(match, board)
      )
        throw Error(MATCH_SCHEDULE_REQUIRED);
      const entry = !matchSources(level, match).length;
      if (body.action === 'referee') {
        if (access !== 'admin')
          return json({ error: 'Tylko organizator może zarządzać sędziowaniem.' }, 403);
        if (typeof body.enabled !== 'boolean') throw Error('Wybierz tryb sędziowania.');
        const changed = body.enabled !== !!match.refereeEnabled;
        if (changed && (match.points || []).some((p) => p > 0))
          throw Error('Zmień tryb po zakończeniu gema lub cofnij jego punkty do 0:0.');
        if (body.enabled && (changed || body.rotate === true)) {
          const r = await randomCode(usedCodes);
          match.refereeCodeHash = r.codeHash;
          match.refereeSavedCode = r.code;
          match.refereeToken = crypto.randomUUID();
        }
        if (!body.enabled) {
          delete match.refereeCodeHash;
          delete match.refereeSavedCode;
          delete match.refereeToken;
        }
        match.refereeEnabled = body.enabled;
        if (changed) {
          match.points = [0, 0];
          match.history = [];
        }
      } else if (body.action === 'rotate') {
        if (access !== 'admin') return json({ error: 'Tylko organizator może zmieniać kod.' }, 403);
        const generated = await randomCode(usedCodes);
        match.codeHash = generated.codeHash;
        match.savedCode = generated.code;
        match.codeFormat = 'pin5';
        codes = { [match.id]: generated.code };
      } else {
        if (match.refereeEnabled && access !== 'admin' && access !== refereeScope(match))
          return json(
            { error: 'Ten mecz prowadzi sędzia. Kod zawodnika pozwala tylko oglądać wynik.' },
            403,
          );
        if (
          body.action !== 'details' &&
          match.status === 'finished' &&
          hasStartedDescendant(level, match.id)
        )
          throw Error(
            'Mecz kolejnej rundy już się rozpoczął. Najpierw cofnij jego wynik do początku.',
          );
        if (body.action === 'start') startMatch(match);
        else if (body.action === 'point') addPoint(match, body.player, matchFormat(level, match));
        else if (body.action === 'add') {
          if (match.refereeEnabled) throw Error('W meczu sędziowanym wpisuj punkty, nie gemy.');
          if (body.player !== 0 && body.player !== 1) throw Error('Wybierz zawodnika.');
          addScore(match, body.player, matchFormat(level, match));
        } else if (body.action === 'undo') {
          undoScore(match);
          normalizeLiveMatches(board);
        } else if (body.action === 'finish') {
          const w = matchWinner(match.sets, matchFormat(level, match));
          if (w === null) throw Error('Mecz kończy się po wygraniu dwóch setów.');
          if (match.status === 'finished') throw Error('Mecz jest już zakończony.');
          if (match.status === 'scheduled') throw Error('Najpierw rozpocznij mecz.');
          const finishedTime = validTime(body.finishedTime);
          if (!finishedTime) throw Error('Podaj godzinę zakończenia meczu.');
          const finishedAt = LEAGUE_FEATURES.bracketEditor
            ? finishInstant(match, finishedTime, body.finishedDate)
            : null;
          match.history ??= [];
          match.history.push(scoreSnapshot(match));
          if (LEAGUE_FEATURES.bracketEditor) match.finishedAt = finishedAt;
          match.status = 'finished';
          match.winner = w;
          match.finishedTime = finishedTime;
          match.unfinishedAt = null;
        } else if (body.action === 'details') {
          if (access !== 'admin')
            return json({ error: 'Tylko organizator może zmieniać dane meczu.' }, 403);
          if (body.seeds !== undefined && (!entry || !LEAGUE_FEATURES.bracketEditor))
            throw Error('Rozstawienie można edytować tylko w pierwszej rundzie Relaksmisji.');
          if (entry) {
            const maxLength = isDoubles(level) ? 150 : 70;
            if (
              !Array.isArray(body.players) ||
              body.players.length !== 2 ||
              body.players.some(
                (p: unknown) =>
                  typeof p !== 'string' ||
                  (!LEAGUE_FEATURES.bracketEditor && !p.trim()) ||
                  p.length > maxLength,
              )
            )
              throw Error('Wpisz obie strony meczu.');
            const names = body.players.map((p: string) => p.trim());
            if (
              (match.status !== 'scheduled' || hasStartedDescendant(level, match.id)) &&
              names.some((p: string) => !p)
            )
              throw Error('Nie można usuwać nazwisk z rozpoczętego meczu lub jego drabinki.');
            const others = entryMatches(level)
              .filter((m) => m.id !== match.id)
              .flatMap((m) => m.players)
              .map((p) => p.toLocaleLowerCase('pl-PL'));
            if (
              (names[0] &&
                names[0].toLocaleLowerCase('pl-PL') === names[1].toLocaleLowerCase('pl-PL')) ||
              names.some((p: string) => p && others.includes(p.toLocaleLowerCase('pl-PL')))
            )
              throw Error('Zawodnicy lub pary na poziomie muszą być różni.');
            match.players = names;
            if (LEAGUE_FEATURES.bracketEditor) {
              if (body.seeds !== undefined) {
                match.seeds = body.seeds;
                validateLevelSeeds(level);
              }
              if (match.seeds) {
                match.seeds = match.seeds.map((n, i) => (names[i] ? n : null));
                if (match.seeds.every((n) => n === null)) delete match.seeds;
              }
            }
          }
          match.court = validCourt(body.court, board);
          match.date =
            LEAGUE_FEATURES.bracketEditor && !body.date
              ? ''
              : matchDate(body.date, board, match.date);
          match.time = LEAGUE_FEATURES.bracketEditor ? validTime(body.time) : startTime(body.time);
          if (LEAGUE_FEATURES.bracketEditor) match.configured = true;
          if (LEAGUE_FEATURES.bracketEditor && !match.codeHash) {
            const generated = await randomCode(usedCodes);
            Object.assign(match, {
              codeHash: generated.codeHash,
              savedCode: generated.code,
              codeFormat: 'pin5',
            });
          }
          assertSlotAvailable(board, match);
          if (body.youtubeUrl !== undefined)
            match.youtubeUrl = normalizeYoutubeUrl(body.youtubeUrl);
        } else throw Error('Nieznane działanie.');
        propagatePlayers(level);
        match.updated = new Date().toISOString();
      }
    }
    normalizeLiveMatches(board);
    board.theme = SITE_LEAGUE;
    let saved;
    if (independentScore && scoredMatch && exists) {
      const result = await db.batch([
        db
          .prepare('UPDATE boards SET data=?,revision=revision+1 WHERE id=? AND revision=?')
          .bind(JSON.stringify(board), 'main', revision),
        db
          .prepare(
            "INSERT INTO match_rows (board_id,id,data,revision) SELECT 'main',?,?,1 WHERE changes()=1 ON CONFLICT(board_id,id) DO UPDATE SET data=excluded.data,revision=match_rows.revision+1",
          )
          .bind(scoredMatch.id, JSON.stringify(scoredMatch)),
      ]);
      saved = result[0];
    } else if (exists)
      saved = await db
        .prepare('UPDATE boards SET data=?,revision=revision+1 WHERE id=? AND revision=?')
        .bind(JSON.stringify(board), 'main', revision)
        .run();
    else
      saved = await db
        .prepare('INSERT OR IGNORE INTO boards (id,data,revision) VALUES (?,?,1)')
        .bind('main', JSON.stringify(board))
        .run();
    if (!saved.meta.changes && independentScore && retry < 8)
      return handlePost(
        new Request(req.url, { method: 'POST', headers: req.headers, body: raw }),
        retry + 1,
      );
    if (!saved.meta.changes)
      return json({ error: 'Ktoś właśnie zmienił wynik. Sprawdź go i spróbuj ponownie.' }, 409);
    if (body.action === 'rotate')
      await db.prepare('DELETE FROM sessions WHERE scope=?').bind(body.matchId).run();
    return json({
      ...(await publishedAfterCommit(board, access, revision + 1)),
      revision: revision + 1,
      codes,
      scope: access,
    });
  } catch (e) {
    console.error('league write failed', e);
    return json(
      {
        error:
          e instanceof Error && !/D1|SQL|binding/i.test(e.message)
            ? e.message
            : 'Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.',
      },
      400,
    );
  }
}
