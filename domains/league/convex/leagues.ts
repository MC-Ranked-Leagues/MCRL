import { query } from "./_generated/server"
import { getLeagueName } from "./lib/readModels"

export const listLeagues = query({
  args: {},
  handler: async (ctx) => {
    const leagues = await ctx.db.query("leagues").collect()
    return leagues
      .sort((a, b) => a.leagueTier - b.leagueTier)
      .map((league) => ({
        leagueTier: league.leagueTier,
        name: league.name ?? getLeagueName(league.leagueTier),
      }))
  },
})
