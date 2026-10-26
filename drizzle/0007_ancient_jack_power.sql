CREATE TABLE `user_activity` (
	`email` text PRIMARY KEY NOT NULL,
	`full_name` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`last_step` integer DEFAULT 0 NOT NULL,
	`furthest_step` integer DEFAULT 0 NOT NULL
);
