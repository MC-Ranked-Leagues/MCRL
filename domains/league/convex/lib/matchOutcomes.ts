import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { buildMatchResultSnapshot } from "./readModels"

/**
 * Ensures a registration has one explicit outcome for every imported match.
 * The newest legacy result is marked as non-missed and older duplicates are
 * removed; a missing result is materialized as a missed outcome.
 */
export async function ensureRegistrationMatchOutcomes(
  ctx: MutationCtx,
  competition: Doc<"competitions">,
  playerId: Id<"players">
) {
  const matches = await ctx.db
    .query("matches")
    .withIndex("by_competition_match", (q) =>
      q.eq("competitionId", competition._id)
    )
    .collect()

  for (const match of matches) {
    if (match.rankedMatchId === undefined) continue

    let existingResults = await ctx.db
      .query("matchResults")
      .withIndex("by_match_and_player", (q) =>
        q.eq("matchId", match._id).eq("playerId", playerId)
      )
      .order("desc")
      .take(128)

    const existingResult = existingResults[0]
    let duplicatesRemoved = 0
    while (existingResults.length > 1) {
      for (const duplicate of existingResults.slice(1)) {
        await ctx.db.delete(duplicate._id)
        duplicatesRemoved += 1
      }

      if (existingResults.length < 128) break

      existingResults = await ctx.db
        .query("matchResults")
        .withIndex("by_match_and_player", (q) =>
          q.eq("matchId", match._id).eq("playerId", playerId)
        )
        .order("desc")
        .take(128)
    }

    if (duplicatesRemoved > 0) {
      console.warn(
        `Removed ${duplicatesRemoved} duplicate outcome(s) for match ${match._id} and player ${playerId}.`
      )
    }

    if (existingResult) {
      if (existingResult.missed === undefined) {
        await ctx.db.patch(existingResult._id, { missed: false })
      }
      continue
    }

    await ctx.db.insert("matchResults", {
      matchId: match._id,
      playerId,
      ...buildMatchResultSnapshot(competition, match.matchNumber),
      missed: true,
      timeMs: null,
      dnf: false,
      placement: null,
      pointsWon: 0,
    })
  }
}
