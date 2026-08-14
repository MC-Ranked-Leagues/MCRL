import { v } from "convex/values"
import { internalQuery } from "./_generated/server"
import { getPlayerByUuid } from "./lib/readModels"
import type { Doc } from "./_generated/dataModel"

// This query assumes that a player only plays in one competition per week. If not, it will throw an error.
export const listPlayerMatches = internalQuery({
  args: {
    uuid: v.optional(v.string()),
    playerName: v.optional(v.string()),
    weekNumber: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    playerName: string
    weekNumber: number
    currentLeagueNumber: number
    weekLeagueNumber: number | null
    matches: {
      matchNumber: number
      rankedMatchId: string | null
      pointsWon: number
      timeMs: number | null
      placement: number | null
      dnf: boolean
      missed: boolean
    }[]
  }> => {
    let player: Doc<"players"> | null = null
    if (args.uuid) {
      player = await getPlayerByUuid(ctx, args.uuid)
    }

    if (!player && args.playerName) {
      player = await ctx.db
        .query("players")
        .withIndex("by_ign", (q) => q.eq("ign", args.playerName!))
        .unique()
    }

    if (!player) {
      throw new Error("Player not found")
    }

    const matchResults = await ctx.db
      .query("matchResults")
      .withIndex("by_week_and_player", (q) =>
        q.eq("weekNumber", args.weekNumber).eq("playerId", player._id)
      )
      .collect()

    if (matchResults.length === 0) {
      return {
        playerName: player.ign,
        weekNumber: args.weekNumber,
        currentLeagueNumber: player.currentLeagueNumber,
        weekLeagueNumber: null,
        matches: [],
      }
    }

    const competitionId = matchResults[0].competitionId
    const leagueTier = matchResults[0].leagueTier
    const allSameComp = matchResults.every(
      (r) => r.competitionId === competitionId
    )
    if (!allSameComp)
      throw new Error(
        `Player has results across multiple competitions in week ${args.weekNumber}`
      )

    // Load the match metadata for each imported player outcome.
    const matchIds = [...new Set(matchResults.map((r) => r.matchId))]
    const matchesById = new Map(
      (await Promise.all(matchIds.map((id) => ctx.db.get(id))))
        .filter(Boolean)
        .map((m) => [m!._id, m!])
    )

    const matches = matchResults
      .sort((a, b) => a.matchNumber - b.matchNumber)
      .map((result) => ({
        matchNumber: result.matchNumber,
        rankedMatchId: matchesById.get(result.matchId)?.rankedMatchId ?? null,
        pointsWon: result.pointsWon,
        timeMs: result.timeMs,
        placement: result.placement,
        dnf: result.dnf,
        missed: result.missed === true,
      }))

    return {
      playerName: player.ign,
      weekNumber: args.weekNumber,
      currentLeagueNumber: player.currentLeagueNumber,
      weekLeagueNumber: leagueTier,
      matches,
    }
  },
})
