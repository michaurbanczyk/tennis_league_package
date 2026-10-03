CREATE TABLE IF NOT EXISTS level_matches (
  board_id TEXT NOT NULL,
  level_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  match_id TEXT NOT NULL,
  PRIMARY KEY (board_id, level_id, position),
  UNIQUE (board_id, match_id)
);

INSERT OR IGNORE INTO level_matches (board_id, level_id, position, match_id)
SELECT l.board_id, l.id, CAST(m.key AS INTEGER), m.value
FROM level_rows AS l, json_each(l.data, '$.matchIds') AS m;

UPDATE level_rows SET data = json_remove(data, '$.matchIds');
