import { database } from '@/db/raw';
import type { Board, Level, Match } from './tennis';

type StoredBoard = { data: string; revision: number };
type StoredLevel = { id: string; position: number; data: string };

export async function readNormalizedBoard(boardId: string) {
  const db = database();
  const stored = await db
    .prepare('SELECT data,revision FROM boards WHERE id=?')
    .bind(boardId)
    .first<StoredBoard>();
  const board = stored ? (JSON.parse(stored.data) as Board) : null;
  if (!stored || !board) return { board: null, revision: 0, exists: false };

  const levels = await db
    .prepare('SELECT id,position,data FROM level_rows WHERE board_id=? ORDER BY position')
    .bind(boardId)
    .all<StoredLevel>();
  if (levels.results.length || !Object.hasOwn(board, 'levels')) {
    const matches = await db
      .prepare(
        `
        SELECT lm.level_id,m.id,m.data
        FROM level_matches lm JOIN match_rows m
          ON m.board_id=lm.board_id AND m.id=lm.match_id
        WHERE lm.board_id=? ORDER BY lm.level_id,lm.position
      `,
      )
      .bind(boardId)
      .all<{ level_id: string; id: string; data: string; position: number }>();
    const byLevel = new Map<string, Match[]>();
    for (const row of matches.results) {
      const items = byLevel.get(row.level_id) ?? [];
      items.push(JSON.parse(row.data) as Match);
      byLevel.set(row.level_id, items);
    }
    board.levels = levels.results.map((row) => {
      const level = JSON.parse(row.data) as Level;
      return { ...level, matches: byLevel.get(row.id) ?? [] };
    });
  }
  return { board, revision: stored.revision, exists: true };
}

export async function readMainBoard() {
  return readNormalizedBoard('main');
}
