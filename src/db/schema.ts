import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});
export const matchRows = sqliteTable(
  'match_rows',
  {
    boardId: text('board_id').notNull(),
    id: text('id').notNull(),
    data: text('data').notNull(),
    revision: integer('revision').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.boardId, table.id] })],
);
export const levelRows = sqliteTable(
  'level_rows',
  {
    boardId: text('board_id').notNull(),
    id: text('id').notNull(),
    position: integer('position').notNull(),
    data: text('data').notNull(),
  },
  (table) => [primaryKey({ columns: [table.boardId, table.id] })],
);
export const levelMatches = sqliteTable(
  'level_matches',
  {
    boardId: text('board_id').notNull(),
    levelId: text('level_id').notNull(),
    position: integer('position').notNull(),
    matchId: text('match_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.boardId, table.levelId, table.position] }),
    uniqueIndex('level_matches_board_match_unique').on(table.boardId, table.matchId),
  ],
);
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  scope: text('scope').notNull(),
  expires: integer('expires').notNull(),
});
export const attempts = sqliteTable('attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
