ALTER TABLE `profiles` ADD `role_tracks_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `career_stage` text DEFAULT 'exploring' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `bottleneck` text DEFAULT 'finding' NOT NULL;