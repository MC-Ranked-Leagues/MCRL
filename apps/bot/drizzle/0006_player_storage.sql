CREATE TABLE `account_migrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`previous_uuid` text NOT NULL,
	`previous_ign` text NOT NULL,
	`minecraft_uuid` text NOT NULL,
	`ign` text NOT NULL,
	`account_version` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text NOT NULL,
	`review_message_id` text,
	`created_at` integer NOT NULL,
	`decided_at` integer,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_migrations_pending_unique` ON `account_migrations` (`player_id`) WHERE "account_migrations"."status" = 'pending';--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_username` text NOT NULL,
	`minecraft_uuid` text NOT NULL,
	`ign` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`signup_message_id` text,
	`signup_details` text,
	`league_number` integer,
	`is_test` integer DEFAULT false NOT NULL,
	`account_version` integer DEFAULT 1 NOT NULL,
	`placements` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "players_placements_limit" CHECK(json_array_length("players"."placements") <= 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_guild_discord_unique` ON `players` (`guild_id`,`discord_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_guild_uuid_unique` ON `players` (`guild_id`,`minecraft_uuid`);--> statement-breakpoint
ALTER TABLE `registrations` ADD `account_version` integer DEFAULT 1 NOT NULL;