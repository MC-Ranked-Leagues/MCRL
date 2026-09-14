DROP TABLE `guilds`;--> statement-breakpoint
DROP TABLE `leagues`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_competitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`league_number` integer NOT NULL,
	`week_number` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`registration_open` integer DEFAULT false NOT NULL,
	`max_time_limit_ms` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	CONSTRAINT "competitions_week_number_positive" CHECK("__new_competitions"."week_number" > 0),
	CONSTRAINT "competitions_max_time_limit_ms_positive" CHECK("__new_competitions"."max_time_limit_ms" > 0),
	CONSTRAINT "competitions_status_valid" CHECK("__new_competitions"."status" in ('active', 'ended'))
);
--> statement-breakpoint
INSERT INTO `__new_competitions`("id", "guild_id", "league_number", "week_number", "status", "registration_open", "max_time_limit_ms", "started_at", "ended_at") SELECT "id", "guild_id", "league_number", "week_number", "status", "registration_open", "max_time_limit_ms", "started_at", "ended_at" FROM `competitions`;--> statement-breakpoint
DROP TABLE `competitions`;--> statement-breakpoint
ALTER TABLE `__new_competitions` RENAME TO `competitions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `competitions_guild_league_week_unique` ON `competitions` (`guild_id`,`league_number`,`week_number`);