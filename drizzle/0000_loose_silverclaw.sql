CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`radar_run_id` integer,
	`item_id` text NOT NULL,
	`reaction` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_user_idx` ON `feedback` (`user_email`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`full_name` text,
	`school` text NOT NULL,
	`major` text NOT NULL,
	`graduation_year` text NOT NULL,
	`academic_level` text DEFAULT 'undergraduate' NOT NULL,
	`goals_json` text DEFAULT '[]' NOT NULL,
	`interests_json` text DEFAULT '[]' NOT NULL,
	`sponsorship` text DEFAULT 'unsure' NOT NULL,
	`paid_only` integer DEFAULT false NOT NULL,
	`delivery_time` text DEFAULT '07:30' NOT NULL,
	`weekends` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `radar_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`output_json` text NOT NULL,
	`source_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE INDEX `radar_runs_user_created_idx` ON `radar_runs` (`user_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`type` text NOT NULL,
	`encrypted_config` text,
	`display_label` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_user_type_idx` ON `sources` (`user_email`,`type`);