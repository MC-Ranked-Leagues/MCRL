import { internalMutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getCurrentWeek = query({
  args: {},
  handler: async (ctx) => {
    const activeWeeks = await ctx.db
      .query("weeks")
      .withIndex("by_active_comp_count", (q) =>
        q.gt("activeCompetitionCount", 0)
      )
      .collect()

    if (activeWeeks.length === 0) return null

    const weekNumber = Math.max(...activeWeeks.map((week) => week.weekNumber))
    const competitions = await ctx.db
      .query("competitions")
      .withIndex("by_week_number", (q) => q.eq("weekNumber", weekNumber))
      .collect()

    return {
      weekNumber,
      competitions: competitions.filter(
        (competition) => competition.status === "active"
      ),
    }
  },
})

export const transitionWeek = internalMutation({
  args: {
    weekNumber: v.number(),
    newWeek: v.number(),
    players: v.array(
      v.object({
        uuid: v.string(),
        ign: v.string(),
        elo: v.optional(v.number()),
        leagueTier: v.number(),
      })
    ),
  },
  handler: async (_ctx, args) => {
    return {
      success: false,
      error:
        "transitionWeek is no longer supported by the refactored competition schema.",
      weekNumber: args.weekNumber,
      newWeek: args.newWeek,
      playerCount: args.players.length,
    }
  },
})
