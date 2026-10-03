CREATE TABLE IF NOT EXISTS level_rows (
  board_id TEXT NOT NULL,
  id TEXT NOT NULL,
  position INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (board_id, id)
);

-- Keep each level's ordered match IDs as its relationship to match_rows.
-- The large match objects themselves stay in match_rows.
INSERT OR IGNORE INTO level_rows (board_id, id, position, data)
SELECT
  b.id,
  json_extract(l.value, '$.id'),
  CAST(l.key AS INTEGER),
  json_set(
    json_remove(l.value, '$.matches'),
    '$.matchIds',
    json((
      SELECT json_group_array(json_extract(m.value, '$.id'))
      FROM json_each(l.value, '$.matches') AS m
    ))
  )
FROM boards AS b, json_each(b.data, '$.levels') AS l
WHERE b.id = 'main' AND json_type(l.value, '$.id') = 'text';

-- The normalized rows now hold the active draw. Keep only tournament metadata
-- in the main board document. Archive boards remain backward-compatible snapshots.
UPDATE boards SET data = json_remove(data, '$.levels') WHERE id = 'main';
