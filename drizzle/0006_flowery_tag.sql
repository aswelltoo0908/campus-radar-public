CREATE TABLE `inbound_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`message_id` text NOT NULL,
	`encrypted_content` text NOT NULL,
	`received_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbound_emails_message_idx` ON `inbound_emails` (`message_id`);--> statement-breakpoint
CREATE INDEX `inbound_emails_user_received_idx` ON `inbound_emails` (`user_email`,`received_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `forwarding_enabled` integer DEFAULT false NOT NULL;