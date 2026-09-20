ALTER TABLE `players` ADD `twitch` text;--> statement-breakpoint
ALTER TABLE `registrations` ADD `streaming` integer DEFAULT false NOT NULL;
