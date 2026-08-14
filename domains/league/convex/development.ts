// THIS FILE HOSTS ALL FUNCTIONS USED THROUGH THE CONVEX DASHBAORD.

import { v } from "convex/values"
import { internalMutation } from "./_generated/server"
import {
  syncPlayerRegistrationSnapshots,
  syncPlayerWinnerSnapshots,
} from "./lib/readModels"

export const syncPlayerInfo = internalMutation({
  args: {
    players: v.array(
      v.object({
        uuid: v.string(),
        ign: v.string(),
        lowercaseIgn: v.string(),
        elo: v.optional(v.number()),
        currentLeagueNumber: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const player of args.players) {
      const existing = await ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", player.uuid))
        .collect()

      if (existing.length > 1) {
        console.error(
          `uuid ${player.uuid} is found more than once in the database: ${JSON.stringify(existing, null, 2)}`
        )
        throw new Error("Duplicate existing players")
      }

      if (existing.length === 0) {
        console.info(
          `uuid ${player.uuid} (${player.ign}) does not match any value in the database`
        )

        await ctx.db.insert("players", {
          uuid: player.uuid,
          ign: player.ign,
          lowercaseIgn: player.lowercaseIgn,
          elo: player.elo,
          currentLeagueNumber: player.currentLeagueNumber,
        })
        continue
      }

      const existingPlayer = existing[0]

      await ctx.db.patch(existingPlayer._id, {
        uuid: player.uuid,
        ign: player.ign,
        lowercaseIgn: player.lowercaseIgn,
        elo: player.elo,
        currentLeagueNumber: player.currentLeagueNumber,
      })

      const updatedPlayer = await ctx.db.get(existingPlayer._id)
      if (!updatedPlayer) {
        console.error(`failed to create player ${player.uuid}: ${player.ign}`)
        throw new Error("Duplicate existing players")
      }

      await syncPlayerRegistrationSnapshots(
        ctx,
        updatedPlayer._id,
        updatedPlayer
      )
      await syncPlayerWinnerSnapshots(ctx, updatedPlayer._id, updatedPlayer)
    }
  },
})
