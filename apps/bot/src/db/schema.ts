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
    registrationOpen: integer("registration_open", { mode: "boolean" })
      .notNull()
      .default(false),
    registrationMessageIds: text("registration_message_ids", { mode: "json" })
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
    discordUserId: text("discord_user_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    ign: text("ign").notNull(),
    elo: real("elo"),
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
    participantCount: integer("participant_count").notNull(),
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
    check(
      "matches_participant_count_nonnegative",
      sql`${table.participantCount} >= 0`
    ),
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
