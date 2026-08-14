import { paginationOptsValidator } from "convex/server"
import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { ensureRegistrationMatchOutcomes } from "./lib/matchOutcomes"
import { getImprovedFastestTimeMs } from "./lib/playerFastestTime"
import { calculateRegistrationAverageTimeMs } from "./lib/registrationAverage"

/**
 * Populates averageTimeMs for registrations that existed before that field was
 * introduced. Start it once with
 * { paginationOpts: { cursor: null, numItems: 64 } }; subsequent batches
 * schedule themselves until every registration has been processed.
 */
export const backfillRegistrationAverageTimes = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("registrations")
      .paginate(args.paginationOpts)

    for (const registration of page.page) {
      const competition = await ctx.db.get(registration.competitionId)
      if (!competition) {
        console.warn(
          `Skipping registration ${registration._id}: competition ${registration.competitionId} was not found.`
        )
        continue
      }

      const results = await ctx.db
        .query("matchResults")
        .withIndex("by_player_and_competition", (q) =>
          q
            .eq("playerId", registration.playerId)
            .eq("competitionId", registration.competitionId)
        )
        .take(128)

      await ctx.db.patch(registration._id, {
        averageTimeMs: calculateRegistrationAverageTimeMs(
          results,
          competition.maxTimeLimitMs
        ),
      })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillRegistrationAverageTimes,
        {
          paginationOpts: {
            ...args.paginationOpts,
            cursor: page.continueCursor,
          },
        }
      )
    }

    return {
      processed: page.page.length,
      isDone: page.isDone,
    }
  },
})

/**
 * Materializes explicit missed outcomes for imported matches, deduplicates and
 * marks legacy results as non-missed, and recalculates registration averages.
 * Start it once with
 * { paginationOpts: { cursor: null, numItems: 16 } }; subsequent batches
 * schedule themselves until every registration has been processed.
 */
export const backfillMissedMatchResults = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("registrations")
      .paginate(args.paginationOpts)

    for (const registration of page.page) {
      const competition = await ctx.db.get(registration.competitionId)
      if (!competition) {
        console.warn(
          `Skipping registration ${registration._id}: competition ${registration.competitionId} was not found.`
        )
        continue
      }

      await ensureRegistrationMatchOutcomes(
        ctx,
        competition,
        registration.playerId
      )

      const results = await ctx.db
        .query("matchResults")
        .withIndex("by_player_and_competition", (q) =>
          q
            .eq("playerId", registration.playerId)
            .eq("competitionId", registration.competitionId)
        )
        .take(128)

      await ctx.db.patch(registration._id, {
        averageTimeMs: calculateRegistrationAverageTimeMs(
          results,
          competition.maxTimeLimitMs
        ),
      })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillMissedMatchResults,
        {
          paginationOpts: {
            ...args.paginationOpts,
            cursor: page.continueCursor,
          },
        }
      )
    }

    return {
      processed: page.page.length,
      isDone: page.isDone,
    }
  },
})

/**
 * Populates players.fastestTimeMs from completed historical match results.
 * Start it once with
 * { paginationOpts: { cursor: null, numItems: 64 } }; subsequent batches
 * schedule themselves until every match result has been processed.
 */
export const backfillPlayerFastestTimes = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("matchResults")
      .paginate(args.paginationOpts)
    const fastestTimesByPlayer = new Map<Id<"players">, number>()

    for (const result of page.page) {
      const fastestTimeMs = getImprovedFastestTimeMs(
        fastestTimesByPlayer.get(result.playerId),
        result
      )

      if (fastestTimeMs !== undefined) {
        fastestTimesByPlayer.set(result.playerId, fastestTimeMs)
      }
    }

    for (const [playerId, fastestTimeMs] of fastestTimesByPlayer) {
      const player = await ctx.db.get(playerId)
      if (!player) continue

      const improvedFastestTimeMs = getImprovedFastestTimeMs(
        player.fastestTimeMs,
        { timeMs: fastestTimeMs, dnf: false }
      )
      if (improvedFastestTimeMs === undefined) continue

      await ctx.db.patch(playerId, {
        fastestTimeMs: improvedFastestTimeMs,
      })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillPlayerFastestTimes,
        {
          paginationOpts: {
            ...args.paginationOpts,
            cursor: page.continueCursor,
          },
        }
      )
    }

    return {
      processed: page.page.length,
      isDone: page.isDone,
    }
  },
})
