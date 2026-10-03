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

export async function readLevelSlice(levelId: string) {
  const row = await database()
    .prepare(
      `
      SELECT b.revision,l.value AS levelData,
        json_extract(b.data,'$.season') AS season,
        json_extract(b.data,'$.finalsDates') AS finalsDates,
        json_extract(b.data,'$.courtGroups') AS courtGroups,
        json_extract(b.data,'$.heroBanner') AS heroBanner
      FROM boards b,json_each(b.data,'$.levels') l
      WHERE b.id='main' AND json_extract(l.value,'$.id')=? LIMIT 1
    `,
    )
    .bind(levelId)
    .first<StoredSlice>();
  if (!row) return null;
  const level = JSON.parse(row.levelData) as Level;
  const ids = level.matches.map((match) => match.id);
  const revisions = new Map<string, number>();
  const records = new Map<string, Match>();
  if (ids.length) {
    const rows = await database()
      .prepare(
        `SELECT id,data,revision FROM match_rows WHERE board_id='main' AND id IN (${ids.map(() => '?').join(',')})`,
      )
      .bind(...ids)
      .all<{ id: string; data: string; revision: number }>();
    for (const record of rows.results) {
      revisions.set(record.id, record.revision);
      records.set(record.id, JSON.parse(record.data) as Match);
    }
  }
  level.matches = level.matches.map((match) => records.get(match.id) ?? match);
  return { row, level, revisions };
}

export async function readMatchSlice(matchId: string) {
  const row = await database()
    .prepare(
      `
      SELECT b.revision,l.value AS levelData,
        json_extract(b.data,'$.season') AS season,
        json_extract(b.data,'$.finalsDates') AS finalsDates,
        json_extract(b.data,'$.courtGroups') AS courtGroups,
        json_extract(b.data,'$.heroBanner') AS heroBanner,
        r.data AS matchData,r.revision AS matchRevision
      FROM boards b,json_each(b.data,'$.levels') l,json_each(l.value,'$.matches') m
      LEFT JOIN match_rows r ON r.board_id=b.id AND r.id=json_extract(m.value,'$.id')
      WHERE b.id='main' AND json_extract(m.value,'$.id')=? LIMIT 1
    `,
    )
    .bind(matchId)
    .first<StoredSlice & { matchData: string | null; matchRevision: number | null }>();
  if (!row) return null;
  const level = JSON.parse(row.levelData) as Level;
  const match = row.matchData
    ? (JSON.parse(row.matchData) as Match)
    : level.matches.find((item) => item.id === matchId);
  return match ? { row, level, match, matchRevision: row.matchRevision ?? 0 } : null;
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
