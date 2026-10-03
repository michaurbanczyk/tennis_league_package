import { database } from '@/db/raw';
import { applyScoreAction, type ScoreAction } from './match-score-action';
import { publicMatch } from './public-match';
import { refereeScope, scopeMatchId, type Board, type Level, type Match } from './tennis';
import type { MatchDelta } from './match-delta';

type Slice = {
  revision: number;
  levelId: string;
  levelData: string;
  courtGroups: string | null;
  matchData: string;
  matchRevision: number;
};
type Command = ScoreAction & { matchId: string; matchRevision: number };
type Result = { status: number; data: MatchDelta | { error: string } };
const conflict = (): Result => ({
  status: 409,
  data: { error: 'Mecz został zmieniony. Odświeżono dane — sprawdź wynik i ponów działanie.' },
});

export async function scoreMatch(
  body: Command,
  getAccess: () => Promise<string | null>,
): Promise<Result> {
  if (
    typeof body.matchId !== 'string' ||
    !Number.isSafeInteger(body.matchRevision) ||
    body.matchRevision < 0
  )
    return { status: 400, data: { error: 'Nieprawidłowe dane meczu.' } };
  const db = database();
  for (let attempt = 0; attempt < 8; attempt++) {
    const access = await getAccess();
    if (!access) return { status: 401, data: { error: 'Wpisz kod, aby edytować wyniki.' } };
    const row = await db
      .prepare(
        `
        SELECT b.revision,l.id AS levelId,l.data AS levelData,
          json_extract(b.data,'$.courtGroups') AS courtGroups,
          r.data AS matchData,r.revision AS matchRevision
        FROM boards b
        JOIN level_rows l ON l.board_id=b.id
        JOIN level_matches lm ON lm.board_id=l.board_id AND lm.level_id=l.id
        JOIN match_rows r ON r.board_id=lm.board_id AND r.id=lm.match_id
        WHERE b.id='main' AND r.id=? LIMIT 1
      `,
      )
      .bind(body.matchId)
      .first<Slice>();
    if (!row) return { status: 404, data: { error: 'Nie znaleziono meczu.' } };
    const levelFields = JSON.parse(row.levelData) as Omit<Level, 'matches'>;
    const matchRows = await db
      .prepare(
        `
        SELECT r.id,r.data
        FROM level_matches lm JOIN match_rows r
          ON r.board_id=lm.board_id AND r.id=lm.match_id
        WHERE lm.board_id='main' AND lm.level_id=? ORDER BY lm.position
      `,
      )
      .bind(row.levelId)
      .all<{ id: string; data: string }>();
    const level: Level = {
      ...levelFields,
      matches: matchRows.results.map((record) => JSON.parse(record.data) as Match),
    };
    const matchIndex = level.matches.findIndex((match) => match.id === body.matchId);
    if (matchIndex < 0) return { status: 404, data: { error: 'Nie znaleziono meczu.' } };
    const match = level.matches[matchIndex];
    if (access !== 'admin') {
      if (scopeMatchId(access) !== match.id)
        return { status: 403, data: { error: 'Ten kod nie pozwala edytować tego meczu.' } };
      if (
        access.startsWith('referee:') &&
        (!match.refereeEnabled || !match.refereeToken || access !== refereeScope(match))
      )
        return { status: 401, data: { error: 'Wpisz aktualny kod sędziego.' } };
      if (match.refereeEnabled && access !== refereeScope(match))
        return {
          status: 403,
          data: { error: 'Ten mecz prowadzi sędzia. Kod zawodnika pozwala tylko oglądać wynik.' },
        };
    }
    if (row.matchRevision !== body.matchRevision) return conflict();
    const before = level.matches.map((item) => JSON.stringify(item));
    const board: Board = {
      levels: [level],
      ...(row.courtGroups ? { courtGroups: JSON.parse(row.courtGroups) } : {}),
    };
    applyScoreAction(board, level, match, body);
    const changes = level.matches.flatMap((item, index) => {
      const data = JSON.stringify(item);
      return data !== before[index] ? [{ match: item, data }] : [];
    });
    if (!changes.length) return conflict();

    // Score changes increment only the small board revision row; all changed
    // match records are updated atomically in match_rows. boards.data is untouched.
    const statements = [
      db
        .prepare(
          `
          UPDATE boards SET revision=revision+1
          WHERE id='main' AND revision=?
            AND COALESCE((SELECT revision FROM match_rows WHERE board_id='main' AND id=?),0)=?
        `,
        )
        .bind(row.revision, match.id, body.matchRevision),
    ];
    for (const change of changes) {
      statements.push(
        db
          .prepare(
            `
            INSERT INTO match_rows (board_id,id,data,revision)
            SELECT 'main',?,?,1 WHERE changes()=1
            ON CONFLICT(board_id,id) DO UPDATE
              SET data=excluded.data,revision=match_rows.revision+1
            RETURNING id,revision
          `,
          )
          .bind(change.match.id, change.data) as (typeof statements)[number],
      );
    }
    const results = await db.batch<{ id: string; revision: number }>(statements);
    if (!results[0].meta.changes) continue;
    const revisions = new Map(
      results
        .slice(1)
        .flatMap((result) => result.results.map((item) => [item.id, item.revision] as const)),
    );
    return {
      status: 200,
      data: {
        kind: 'match-delta',
        baseRevision: row.revision,
        revision: row.revision + 1,
        levelId: level.id,
        matches: changes.map((change) => ({
          ...publicMatch(change.match, access),
          matchRevision: revisions.get(change.match.id)!,
        })),
        scope: access,
        serverTime: new Date().toISOString(),
      },
    };
  }
  return conflict();
}
