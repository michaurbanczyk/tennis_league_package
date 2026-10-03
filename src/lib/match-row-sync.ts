import type { D1Database } from '@cloudflare/workers-types';

// Save relational level and match records in the same D1 batch as board metadata.
export function matchRowSyncStatements(db: D1Database, revision: number, serialized: string) {
  return [
    db
      .prepare(
        "DELETE FROM level_matches WHERE board_id='main' AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)",
      )
      .bind(revision),
    db
      .prepare(
        `
        DELETE FROM match_rows
        WHERE board_id='main'
          AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)
          AND id NOT IN (
            SELECT json_extract(m.value,'$.id')
            FROM json_each(?,'$.levels') l,json_each(l.value,'$.matches') m
          )
      `,
      )
      .bind(revision, serialized),
    db
      .prepare(
        `
        DELETE FROM level_rows
        WHERE board_id='main'
          AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)
          AND id NOT IN (
            SELECT json_extract(l.value,'$.id') FROM json_each(?,'$.levels') l
          )
      `,
      )
      .bind(revision, serialized),
    db
      .prepare(
        `
        INSERT INTO level_rows (board_id,id,position,data)
        SELECT 'main',json_extract(l.value,'$.id'),CAST(l.key AS INTEGER),json_remove(l.value,'$.matches')
        FROM json_each(?,'$.levels') l
        WHERE json_type(l.value,'$.id')='text'
          AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)
        ON CONFLICT(board_id,id) DO UPDATE
        SET position=excluded.position,data=excluded.data
        WHERE level_rows.position<>excluded.position OR level_rows.data<>excluded.data
      `,
      )
      .bind(serialized, revision),
    db
      .prepare(
        `
        INSERT INTO match_rows (board_id,id,data,revision)
        SELECT 'main',json_extract(m.value,'$.id'),m.value,0
        FROM json_each(?,'$.levels') l,json_each(l.value,'$.matches') m
        WHERE json_type(m.value,'$.id')='text'
          AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)
        ON CONFLICT(board_id,id) DO UPDATE
        SET data=excluded.data,revision=match_rows.revision+1
        WHERE match_rows.data<>excluded.data
      `,
      )
      .bind(serialized, revision),
    db
      .prepare(
        `
        INSERT INTO level_matches (board_id,level_id,position,match_id)
        SELECT 'main',json_extract(l.value,'$.id'),CAST(m.key AS INTEGER),json_extract(m.value,'$.id')
        FROM json_each(?,'$.levels') l,json_each(l.value,'$.matches') m
        WHERE json_type(l.value,'$.id')='text' AND json_type(m.value,'$.id')='text'
          AND EXISTS (SELECT 1 FROM boards WHERE id='main' AND revision=?)
      `,
      )
      .bind(serialized, revision),
  ];
}
