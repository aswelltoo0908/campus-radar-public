ALTER TABLE `profiles` ADD `delivery_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `email_delivery_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `inbound_alias` text;