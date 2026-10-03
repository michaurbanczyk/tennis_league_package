import { database } from '@/db/raw';
import { refereeScope, type Level, type Match } from './tennis';

type StoredSlice = {
  revision: number;
  levelData: string;
  season: string | null;
  finalsDates: string | null;
  courtGroups: string | null;
  heroBanner: string | null;
};

function levelFromRow(value: string): Level {
  const data = JSON.parse(value) as Omit<Level, 'matches'>;
  return { ...data, matches: [] } as Level;
}

export async function readLevelSlice(levelId: string) {
  const row = await database()
    .prepare(
      `
      SELECT b.revision,l.data AS levelData,
        json_extract(b.data,'$.season') AS season,
        json_extract(b.data,'$.finalsDates') AS finalsDates,
        json_extract(b.data,'$.courtGroups') AS courtGroups,
        json_extract(b.data,'$.heroBanner') AS heroBanner
      FROM boards b JOIN level_rows l ON l.board_id=b.id
      WHERE b.id='main' AND l.id=? LIMIT 1
    `,
    )
    .bind(levelId)
    .first<StoredSlice>();
  if (!row) return null;
  const level = levelFromRow(row.levelData);
  const revisions = new Map<string, number>();
  const rows = await database()
    .prepare(
      `
      SELECT r.id,r.data,r.revision
      FROM level_matches lm JOIN match_rows r
        ON r.board_id=lm.board_id AND r.id=lm.match_id
      WHERE lm.board_id='main' AND lm.level_id=? ORDER BY lm.position
    `,
    )
    .bind(levelId)
    .all<{ id: string; data: string; revision: number }>();
  for (const record of rows.results) {
    revisions.set(record.id, record.revision);
    level.matches.push(JSON.parse(record.data) as Match);
  }
  return { row, level, revisions };
}

export async function readMatchSlice(matchId: string) {
  const row = await database()
    .prepare(
      `
      SELECT b.revision,l.data AS levelData,
        json_extract(b.data,'$.season') AS season,
        json_extract(b.data,'$.finalsDates') AS finalsDates,
        json_extract(b.data,'$.courtGroups') AS courtGroups,
        json_extract(b.data,'$.heroBanner') AS heroBanner,
        r.data AS matchData,r.revision AS matchRevision
      FROM boards b
      JOIN level_rows l ON l.board_id=b.id
      JOIN level_matches lm ON lm.board_id=l.board_id AND lm.level_id=l.id
      JOIN match_rows r ON r.board_id=lm.board_id AND r.id=lm.match_id
      WHERE b.id='main' AND r.id=? LIMIT 1
    `,
    )
    .bind(matchId)
    .first<StoredSlice & { matchData: string; matchRevision: number }>();
  if (!row) return null;
  const level = levelFromRow(row.levelData);
  const match = JSON.parse(row.matchData) as Match;
  level.matches = [match];
  return { row, level, match, matchRevision: row.matchRevision };
}

export function visibleScope(match: Match, access: string | null) {
  if (access === 'admin' || access === match.id) return access;
  return match.refereeEnabled && match.refereeToken && access === refereeScope(match)
    ? access
    : null;
}

export function levelScope(level: Level, access: string | null) {
  if (access === 'admin') return access;
  return level.matches.some((match) => visibleScope(match, access) !== null) ? access : null;
}
