ALTER TABLE `guilds` ADD `ticket_message_id` text;--> statement-breakpoint
ALTER TABLE `guilds` ADD `ticket_count` integer DEFAULT 0 NOT NULL;