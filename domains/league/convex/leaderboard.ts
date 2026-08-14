import { v } from "convex/values"
import { query } from "./_generated/server"
import { buildPlayerListEntry } from "./lib/playerListEntry"

export const getLeagueStandings = query({
  args: {
    leagueTier: v.number(),
  },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_league", (q) =>
        q.eq("currentLeagueNumber", args.leagueTier)
      )
      .collect()

    players.sort((a, b) => {
      const eloDiff = (b.elo ?? 0) - (a.elo ?? 0)
      if (eloDiff !== 0) return eloDiff
      return a.ign.localeCompare(b.ign)
    })

    return players.map((player, index) => ({
      rank: index + 1,
      playerId: player._id,
      uuid: player.uuid,
      name: player.ign,
      elo: player.elo ?? 0,
      leagueTier: player.currentLeagueNumber,
    }))
  },
})

export const getFastestPlayers = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_fastest_time", (q) => q.gt("fastestTimeMs", 0))
      .order("asc")
      .take(20)

    return players.map((player, index) =>
      buildPlayerListEntry(player, index + 1)
    )
  },
})
