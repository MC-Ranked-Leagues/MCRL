CREATE TABLE `competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`league_number` integer NOT NULL,
	`week_number` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`registration_open` integer DEFAULT false NOT NULL,
	`max_time_limit_ms` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`guild_id`,`league_number`) REFERENCES `leagues`(`guild_id`,`number`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "competitions_week_number_positive" CHECK("competitions"."week_number" > 0),
	CONSTRAINT "competitions_max_time_limit_ms_positive" CHECK("competitions"."max_time_limit_ms" > 0),
	CONSTRAINT "competitions_status_valid" CHECK("competitions"."status" in ('active', 'ended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_guild_league_week_unique` ON `competitions` (`guild_id`,`league_number`,`week_number`);--> statement-breakpoint
CREATE INDEX `competitions_guild_league_idx` ON `competitions` (`guild_id`,`league_number`);--> statement-breakpoint
CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`log_channel_id` text NOT NULL,
	`command_role_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`guild_id` text NOT NULL,
	`number` integer NOT NULL,
	`info_channel_id` text NOT NULL,
	`max_time_limit_ms` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `number`),
	FOREIGN KEY (`guild_id`) REFERENCES `guilds`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "leagues_number_positive" CHECK("leagues"."number" > 0),
	CONSTRAINT "leagues_max_time_limit_ms_positive" CHECK("leagues"."max_time_limit_ms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_guild_channel_unique` ON `leagues` (`guild_id`,`info_channel_id`);--> statement-breakpoint
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
	`participant_count` integer NOT NULL,
	`time_limit_ms` integer NOT NULL,
	`imported` integer DEFAULT false NOT NULL,
	`ranked_match_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "matches_number_positive" CHECK("matches"."number" > 0),
	CONSTRAINT "matches_participant_count_nonnegative" CHECK("matches"."participant_count" >= 0),
	CONSTRAINT "matches_time_limit_ms_positive" CHECK("matches"."time_limit_ms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_number_unique` ON `matches` (`competition_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_ranked_match_unique` ON `matches` (`competition_id`,`ranked_match_id`);--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_username` text NOT NULL,
	`minecraft_uuid` text NOT NULL,
	`ign` text NOT NULL,
	`elo` real,
	`registered_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_competition_user_unique` ON `registrations` (`competition_id`,`discord_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_competition_uuid_unique` ON `registrations` (`competition_id`,`minecraft_uuid`);