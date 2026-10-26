CREATE TABLE `email_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`delivery_date` text NOT NULL,
	`radar_run_id` integer NOT NULL,
	`delivery_email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_deliveries_user_date_idx` ON `email_deliveries` (`user_email`,`delivery_date`);