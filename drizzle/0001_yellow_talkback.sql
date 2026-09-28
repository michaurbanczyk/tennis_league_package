CREATE TABLE IF NOT EXISTS `match_rows` (
	`board_id` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`board_id`, `id`)
);
