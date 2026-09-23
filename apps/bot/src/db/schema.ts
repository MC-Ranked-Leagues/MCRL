import { sql } from "drizzle-orm";
import {
  check,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import type { RetainedPercentage } from "../lib/player-history";

export const guilds = sqliteTable(
  "guilds",
  {
    id: text("id").primaryKey(),
    currentWeek: integer("current_week").notNull().default(1),
  },
  (table) => [
    check("guilds_current_week_positive", sql`${table.currentWeek} > 0`),
  ]
);

export const players = sqliteTable(
  "players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    ign: text("ign").notNull(),
    twitch: text("twitch"),
    status: text("status", { enum: ["pending", "active", "rejected"] })
      .notNull()
      .default("active"),
    signupMessageId: text("signup_message_id"),
    signupDetails: text("signup_details"),
    // Pending signups do not have a league assignment yet.
    leagueNumber: integer("league_number"),
    isTest: integer("is_test", { mode: "boolean" }).notNull().default(false),
    accountVersion: integer("account_version").notNull().default(1),
    percentageHistory: text("placements", { mode: "json" })
      .$type<RetainedPercentage[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (table) => [
    uniqueIndex("players_guild_discord_unique").on(
      table.guildId,
      table.discordUserId
    ),
    uniqueIndex("players_guild_uuid_unique").on(
      table.guildId,
      table.minecraftUuid
    ),
    check(
      "players_placements_limit",
      sql`json_array_length(${table.percentageHistory}) <= 3`
    ),
  ]
);

export const accountMigrations = sqliteTable(
  "account_migrations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    previousUuid: text("previous_uuid").notNull(),
    previousIgn: text("previous_ign").notNull(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    ign: text("ign").notNull(),
    accountVersion: integer("account_version").notNull(),
    status: text("status", { enum: ["pending", "approved", "denied"] })
      .notNull()
      .default("pending"),
    reviewerId: text("reviewer_id").notNull(),
    reviewMessageId: text("review_message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("account_migrations_pending_unique")
      .on(table.playerId)
      .where(sql`${table.status} = 'pending'`),
  ]
);

export const competitions = sqliteTable(
  "competitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guildId: text("guild_id").notNull(),
    leagueNumber: integer("league_number").notNull(),
    weekNumber: integer("week_number").notNull(),
    status: text("status", { enum: ["active", "ended"] })
      .notNull()
      .default("active"),
    hasUsedRelegate: integer("has_used_relegate", { mode: "boolean" })
      .notNull()
      .default(false),
    registrationOpen: integer("registration_open", { mode: "boolean" })
      .notNull()
      .default(false),
    registrationMessageIds: text("registration_message_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    leaderboardMessageIds: text("leaderboard_message_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    maxTimeLimitMs: integer("max_time_limit_ms").notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("competitions_guild_league_week_unique").on(
      table.guildId,
      table.leagueNumber,
      table.weekNumber
    ),
    uniqueIndex("competitions_guild_league_active_unique")
      .on(table.guildId, table.leagueNumber)
      .where(sql`${table.status} = 'active'`),
    check("competitions_week_number_positive", sql`${table.weekNumber} > 0`),
    check(
      "competitions_max_time_limit_ms_positive",
      sql`${table.maxTimeLimitMs} > 0`
    ),
    check(
      "competitions_status_valid",
      sql`${table.status} in ('active', 'ended')`
    ),
  ]
);

export const registrations = sqliteTable(
  "registrations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    accountVersion: integer("account_version").notNull().default(1),
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    ign: text("ign").notNull(),
    elo: real("elo"),
    peakElo: real("peak_elo"),
    averageUsed: real("average_used"),
    movement: text("movement", { enum: ["none", "promote", "demote"] }),
    streaming: integer("streaming", { mode: "boolean" })
      .notNull()
      .default(false),
    registeredAt: integer("registered_at", {
      mode: "timestamp_ms",
    }).notNull(),
  },
  (table) => [
    uniqueIndex("registrations_competition_user_unique").on(
      table.competitionId,
      table.discordUserId
    ),
    uniqueIndex("registrations_competition_uuid_unique").on(
      table.competitionId,
      table.minecraftUuid
    ),
  ]
);

export const matches = sqliteTable(
  "matches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    timeLimitMs: integer("time_limit_ms").notNull(),
    imported: integer("imported", { mode: "boolean" }).notNull().default(false),
    rankedMatchId: text("ranked_match_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("matches_competition_number_unique").on(
      table.competitionId,
      table.number
    ),
    uniqueIndex("matches_competition_ranked_match_unique").on(
      table.competitionId,
      table.rankedMatchId
    ),
    check("matches_number_positive", sql`${table.number} > 0`),
    check("matches_time_limit_ms_positive", sql`${table.timeLimitMs} > 0`),
  ]
);

export const matchResults = sqliteTable(
  "match_results",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    registrationId: integer("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "finished", "dnf", "missed"],
    })
      .notNull()
      .default("pending"),
    timeMs: integer("time_ms"),
    placement: integer("placement"),
    points: real("points").notNull().default(0),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.registrationId] }),
    check(
      "match_results_status_valid",
      sql`${table.status} in ('pending', 'finished', 'dnf', 'missed')`
    ),
    check(
      "match_results_time_ms_nonnegative",
      sql`${table.timeMs} is null or ${table.timeMs} >= 0`
    ),
    check(
      "match_results_placement_positive",
      sql`${table.placement} is null or ${table.placement} > 0`
    ),
  ]
);
