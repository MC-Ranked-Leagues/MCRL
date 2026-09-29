CREATE TABLE `backend_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`league_number` integer NOT NULL,
	`week_number` integer NOT NULL,
	`mutation` text NOT NULL,
	`args` text NOT NULL,
	`outcome` text DEFAULT 'unsent' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`attempted_at` integer,
	CONSTRAINT "backend_calls_outcome_valid" CHECK("backend_calls"."outcome" in ('unsent', 'success', 'failure', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE `publication_pauses` (
	`guild_id` text NOT NULL,
	`league_number` integer NOT NULL,
	`week_number` integer NOT NULL,
	`paused_at` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `league_number`, `week_number`)
);
--> statement-breakpoint
ALTER TABLE `registrations` ADD `current_percentage` real;