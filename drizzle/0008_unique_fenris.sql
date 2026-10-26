CREATE TABLE `public_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`source_id` text NOT NULL,
	`canonical_url` text NOT NULL,
	`content_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`first_seen_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signals_source_url_idx` ON `public_signals` (`source_id`,`canonical_url`);--> statement-breakpoint
CREATE TABLE `public_source_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_attempt_at` text NOT NULL,
	`last_success_at` text,
	`item_count` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `opportunity_preferences_json` text DEFAULT '{}' NOT NULL;