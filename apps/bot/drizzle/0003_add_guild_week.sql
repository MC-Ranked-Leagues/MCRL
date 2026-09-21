CREATE TABLE `guilds` (
	`id` text PRIMARY KEY NOT NULL,
	`current_week` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "guilds_current_week_positive" CHECK("guilds"."current_week" > 0)
);
--> statement-breakpoint
INSERT INTO `guilds` (`id`, `current_week`)
SELECT `guild_id`, MAX(`week_number`)
FROM `competitions`
GROUP BY `guild_id`;
