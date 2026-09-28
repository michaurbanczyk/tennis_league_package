import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
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
