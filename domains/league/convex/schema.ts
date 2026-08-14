// convex/schema.ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  players: defineTable({
    uuid: v.string(),
    ign: v.string(),
    lowercaseIgn: v.string(), // For easy searching
    elo: v.optional(v.number()),
    currentLeagueNumber: v.number(),
    fastestTimeMs: v.optional(v.number()),
  })
    .index("by_uuid", ["uuid"])
    .index("by_league", ["currentLeagueNumber"])
    .index("by_ign", ["ign"])
    .index("by_lowercase_ign", ["lowercaseIgn"])
    .index("by_fastest_time", ["fastestTimeMs"])
    .searchIndex("search_lowercase_ign", {
      searchField: "lowercaseIgn",
    }),

  leagues: defineTable({
    leagueTier: v.number(),
    name: v.string(),
  }).index("by_league_tier", ["leagueTier"]),

  weeks: defineTable({
    weekNumber: v.number(),
    activeCompetitionCount: v.number(),
  })
    .index("by_week_number", ["weekNumber"])
    .index("by_active_comp_count", ["activeCompetitionCount"]),

  competitions: defineTable({
    leagueTier: v.number(),
    weekNumber: v.number(),
    status: v.union(v.literal("active"), v.literal("ended")),
    maxTimeLimitMs: v.number(),
    startingTime: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_week_number", ["weekNumber"])
    .index("by_league_and_week", ["leagueTier", "weekNumber"]),

  registrations: defineTable({
    competitionId: v.id("competitions"),
    playerId: v.id("players"),
    manualAdjustmentPoints: v.number(), // Updated via /adjust
    // Store computed totals here to make sorting fast
    computedSeedPoints: v.number(),
    totalPoints: v.number(),
    averageTimeMs: v.union(v.number(), v.null()),
    playerIgn: v.string(),
    weekNumber: v.number(),
    leagueTier: v.number(),
    movementStatus: v.optional(
      v.union(v.literal("promoted"), v.literal("demoted"), v.literal("none"))
    ),
  })
    .index("by_competition", ["competitionId"])
    .index("by_player", ["playerId"])
    .index("by_comp_and_player", ["competitionId", "playerId"]),

  matches: defineTable({
    competitionId: v.id("competitions"),
    matchNumber: v.number(),
    rankedMatchId: v.optional(v.string()),
    winnerPlayerId: v.union(v.id("players"), v.null()),
    winnerName: v.union(v.string(), v.null()),
  })
    .index("by_competition_match", ["competitionId", "matchNumber"])
    .index("by_winner_player", ["winnerPlayerId"]),

  matchResults: defineTable({
    matchId: v.id("matches"),
    playerId: v.id("players"),
    competitionId: v.id("competitions"),
    weekNumber: v.number(),
    leagueTier: v.number(),
    matchNumber: v.number(),
    // Optional while existing result rows are migrated. New writes always set it.
    missed: v.optional(v.boolean()),
    timeMs: v.union(v.number(), v.null()),
    dnf: v.boolean(),
    placement: v.union(v.number(), v.null()),
    pointsWon: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_player", ["playerId"])
    .index("by_player_and_competition", ["playerId", "competitionId"])
    .index("by_week_and_player", ["weekNumber", "playerId"])
    .index("by_match_and_player", ["matchId", "playerId"]),
})
