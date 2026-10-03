-- Seed normalized match records from the current league document.
-- INSERT OR IGNORE makes this safe to rerun and preserves existing revisions.
INSERT OR IGNORE INTO match_rows (board_id, id, data, revision)
SELECT b.id, json_extract(m.value, '$.id'), m.value, 0
FROM boards AS b,
     json_each(b.data, '$.levels') AS l,
     json_each(l.value, '$.matches') AS m
WHERE b.id = 'main'
  AND json_type(m.value, '$.id') = 'text';
