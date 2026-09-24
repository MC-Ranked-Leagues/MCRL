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
CREATE TABLE `competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`league_number` integer NOT NULL,
	`week_number` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`has_used_relegate` integer DEFAULT false NOT NULL,
	`registration_open` integer DEFAULT false NOT NULL,
	`host_minecraft_uuid` text,
	`registration_message_ids` text DEFAULT '[]' NOT NULL,
	`leaderboard_message_ids` text DEFAULT '[]' NOT NULL,
	`max_time_limit_ms` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	CONSTRAINT "competitions_week_number_positive" CHECK("competitions"."week_number" > 0),
	CONSTRAINT "competitions_max_time_limit_ms_positive" CHECK("competitions"."max_time_limit_ms" > 0),
	CONSTRAINT "competitions_status_valid" CHECK("competitions"."status" in ('active', 'ended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_guild_league_week_unique` ON `competitions` (`guild_id`,`league_number`,`week_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_guild_league_active_unique` ON `competitions` (`guild_id`,`league_number`) WHERE "competitions"."status" = 'active';--> statement-breakpoint
CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`current_week` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "guilds_current_week_positive" CHECK("guilds"."current_week" > 0)
);
--> statement-breakpoint
CREATE TABLE `match_results` (
	`match_id` integer NOT NULL,
	`registration_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`time_ms` integer,
	`placement` integer,
	`points` real DEFAULT 0 NOT NULL,
	`submitted_at` integer,
	PRIMARY KEY(`match_id`, `registration_id`),
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "match_results_status_valid" CHECK("match_results"."status" in ('pending', 'finished', 'dnf', 'missed')),
	CONSTRAINT "match_results_time_ms_nonnegative" CHECK("match_results"."time_ms" is null or "match_results"."time_ms" >= 0),
	CONSTRAINT "match_results_placement_positive" CHECK("match_results"."placement" is null or "match_results"."placement" > 0)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`number` integer NOT NULL,
	`time_limit_ms` integer NOT NULL,
	`imported` integer DEFAULT false NOT NULL,
	`ranked_match_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "matches_number_positive" CHECK("matches"."number" > 0),
	CONSTRAINT "matches_time_limit_ms_positive" CHECK("matches"."time_limit_ms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_number_unique` ON `matches` (`competition_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_ranked_match_unique` ON `matches` (`competition_id`,`ranked_match_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_username` text NOT NULL,
	`minecraft_uuid` text NOT NULL,
	`ign` text NOT NULL,
	`twitch` text,
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
CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`account_version` integer DEFAULT 1 NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_username` text NOT NULL,
	`minecraft_uuid` text NOT NULL,
	`ign` text NOT NULL,
	`elo` real,
	`peak_elo` real,
	`average_used` real,
	`movement` text,
	`streaming` integer DEFAULT false NOT NULL,
	`registered_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_competition_user_unique` ON `registrations` (`competition_id`,`discord_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_competition_uuid_unique` ON `registrations` (`competition_id`,`minecraft_uuid`);