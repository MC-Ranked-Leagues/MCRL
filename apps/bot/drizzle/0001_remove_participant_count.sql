-- Drizzle runs migrations in a transaction, where disabling foreign keys has no
-- effect. Preserve child rows before rebuilding matches to avoid cascade loss.
CREATE TEMP TABLE `__saved_match_results` AS SELECT * FROM `match_results`;--> statement-breakpoint
DELETE FROM `match_results`;--> statement-breakpoint
CREATE TABLE `__new_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`competition_id` integer NOT NULL,
	`number` integer NOT NULL,
	`time_limit_ms` integer NOT NULL,
	`imported` integer DEFAULT false NOT NULL,
	`ranked_match_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "matches_number_positive" CHECK("__new_matches"."number" > 0),
	CONSTRAINT "matches_time_limit_ms_positive" CHECK("__new_matches"."time_limit_ms" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_matches`("id", "competition_id", "number", "time_limit_ms", "imported", "ranked_match_id", "created_at") SELECT "id", "competition_id", "number", "time_limit_ms", "imported", "ranked_match_id", "created_at" FROM `matches`;--> statement-breakpoint
DROP TABLE `matches`;--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;--> statement-breakpoint
INSERT INTO `match_results` ("match_id", "registration_id", "status", "time_ms", "placement", "points", "submitted_at")
SELECT "match_id", "registration_id", "status", "time_ms", "placement", "points", "submitted_at" FROM `__saved_match_results`;--> statement-breakpoint
DROP TABLE `__saved_match_results`;--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_number_unique` ON `matches` (`competition_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `matches_competition_ranked_match_unique` ON `matches` (`competition_id`,`ranked_match_id`);