import { database } from '@/db/raw';
import { applyScoreAction, type ScoreAction } from './match-score-action';
import { publicMatch } from './public-match';
import { refereeScope, scopeMatchId, type Board, type Level } from './tennis';
import type { MatchDelta } from './match-delta';

type Slice = {
  revision: number;
  levelIndex: number;
  levelData: string;
  courtGroups: string | null;
  matchData: string | null;
  matchRevision: number | null;
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
    // D1 extracts just this bracket. No complete board crosses into Worker JS.
    // SQL still scans/rewrites the legacy board; row normalization is a later step.
    const row = await db
      .prepare(
        `
      SELECT b.revision,l.key AS levelIndex,l.value AS levelData,
             json_extract(b.data,'$.courtGroups') AS courtGroups,
             r.data AS matchData,r.revision AS matchRevision
      FROM boards b,json_each(b.data,'$.levels') l,json_each(l.value,'$.matches') m
      LEFT JOIN match_rows r ON r.board_id=b.id AND r.id=json_extract(m.value,'$.id')
      WHERE b.id='main' AND json_extract(m.value,'$.id')=? LIMIT 1
    `,
      )
      .bind(body.matchId)
      .first<Slice>();
    if (!row) return { status: 404, data: { error: 'Nie znaleziono meczu.' } };
    const level = JSON.parse(row.levelData) as Level;
    const matchIndex = level.matches.findIndex((m) => m.id === body.matchId);
    if (matchIndex < 0) return { status: 404, data: { error: 'Nie znaleziono meczu.' } };
    let match = level.matches[matchIndex];
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
    const before = level.matches.map((m) => JSON.stringify(m));
    const targetData = JSON.stringify(match);
    // A previous legacy save can have committed before its row synchronization.
    // Reconcile only the selected row and require a fresh client revision.
    if (row.matchData !== null && row.matchData !== targetData) {
      await db
        .prepare(
          `UPDATE match_rows SET data=?,revision=revision+1
        WHERE board_id='main' AND id=? AND revision=?
        AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)`,
        )
        .bind(targetData, match.id, row.matchRevision, row.revision)
        .run();
      return conflict();
    }
    if (row.matchData !== null) {
      match = JSON.parse(row.matchData) as typeof match;
      level.matches[matchIndex] = match;
    }
    if ((row.matchRevision ?? 0) !== body.matchRevision) return conflict();
    const board: Board = {
      levels: [level],
      ...(row.courtGroups ? { courtGroups: JSON.parse(row.courtGroups) } : {}),
    };
    applyScoreAction(board, level, match, body);
    const changes = level.matches.flatMap((m, index) => {
      const data = JSON.stringify(m);
      return data !== before[index] ? [{ match: m, index, data }] : [];
    });
    if (!changes.length) return conflict();
    const patch = changes.flatMap((c) => [
      `$.levels[${row.levelIndex}].matches[${c.index}]`,
      c.data,
    ]);
    // The board CAS also protects bracket edits on other matches. On a
    // conflict we reload only this bracket. This keeps existing clients compatible.
    const statements = [
      db
        .prepare(
          `
      UPDATE boards SET data=json_set(data,${changes.map(() => '?,json(?)').join(',')}),revision=revision+1
      WHERE id='main' AND revision=?
      AND COALESCE((SELECT revision FROM match_rows WHERE board_id='main' AND id=?),0)=?
    `,
        )
        .bind(...patch, row.revision, match.id, body.matchRevision),
    ];
    for (const change of changes) {
      // Each successful statement affects exactly one row. changes() gates the
      // entire chain, so a failed CAS cannot write any match rows. D1 batch is atomic.
      statements.push(
        db
          .prepare(
            `
        INSERT INTO match_rows (board_id,id,data,revision)
        SELECT 'main',?,?,1 WHERE changes()=1
        ON CONFLICT(board_id,id) DO UPDATE SET data=excluded.data,revision=match_rows.revision+1
        RETURNING id,revision
      `,
          )
          .bind(change.match.id, change.data),
      );
    }
    const results = await db.batch<{ id: string; revision: number }>(statements);
    if (!results[0].meta.changes) continue;
    const revisions = new Map(
      results.slice(1).flatMap((r) => r.results.map((m) => [m.id, m.revision] as const)),
    );
    return {
      status: 200,
      data: {
        kind: 'match-delta',
        baseRevision: row.revision,
        revision: row.revision + 1,
        levelId: level.id,
        matches: changes.map((c) => ({
          ...publicMatch(c.match, access),
          matchRevision: revisions.get(c.match.id)!,
        })),
        scope: access,
        serverTime: new Date().toISOString(),
      },
    };
  }
  return conflict();
}
