CREATE TABLE `api_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL
);
