import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "../_generated/server";
import {
  buildMatchWinnerPatch,
  buildMatchResultSnapshot,
  getPlayerByUuid,
} from "../lib/readModels";
import { getImprovedFastestTimeMs } from "../lib/playerFastestTime";
import {
  type RegistrationDoc,
  requireWriterKey,
  requirePositiveInteger,
  requireNonnegativeInteger,
  requireFiniteNumber,
  requireNonemptyString,
  requireCompetitionKeys,
  throwWriteError,
  getCompetition,
  ensureCompetitionWritable,
  getRegistration,
  recalculateRegistrationAverageTime,
  recalculatePlayerFastestTime,
} from "./helpers";

type PlayerDoc = Doc<"players">;

type MatchDoc = Doc<"matches">;

async function getMatch(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  matchNumber: number
): Promise<MatchDoc | null> {
  return await ctx.db
    .query("matches")
    .withIndex("by_competition_match", (q) =>
      q.eq("competitionId", competitionId).eq("matchNumber", matchNumber)
    )
    .unique();
}

async function applyRegistrationPointDelta(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  playerId: Id<"players">,
  seedPointsDelta: number
): Promise<RegistrationDoc | null> {
  const registration = await getRegistration(ctx, competitionId, playerId);
  if (!registration) {
    return null;
  }

  const computedSeedPoints = registration.computedSeedPoints + seedPointsDelta;
  const totalPoints = registration.totalPoints + seedPointsDelta;

  await ctx.db.patch("registrations", registration._id, {
    computedSeedPoints,
    totalPoints,
  });

  return await ctx.db.get("registrations", registration._id);
}

export const createEmptyMatch = internalMutation({
  args: {
    leagueTier: v.number(),
    weekNumber: v.number(),
    matchNumber: v.number(),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    matchId: v.id("matches"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requirePositiveInteger(args.matchNumber, "matchNumber");
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) {
      throwWriteError(404, "Competition not found.");
    }
    ensureCompetitionWritable(competition);

    const existingMatch = await getMatch(
      ctx,
      competition._id,
      args.matchNumber
    );
    if (existingMatch) {
      return {
        ok: true as const,
        competitionId: competition._id,
        matchId: existingMatch._id,
        created: false,
      };
    }

    const matchId = await ctx.db.insert("matches", {
      competitionId: competition._id,
      matchNumber: args.matchNumber,
      winnerPlayerId: null,
      winnerName: null,
    });

    return {
      ok: true as const,
      competitionId: competition._id,
      matchId,
      created: true,
    };
  },
});

export const deleteMatch = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    matchNumber: v.number(),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    matchId: v.id("matches"),
    deleted: v.number(),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requirePositiveInteger(args.matchNumber, "matchNumber");
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) {
      throwWriteError(404, "Competition not found.");
    }
    ensureCompetitionWritable(competition);

    const match = await getMatch(ctx, competition._id, args.matchNumber);
    if (!match) {
      throwWriteError(404, "Match not found.");
    }

    const deletedPointsByPlayer = new Map<Id<"players">, number>();
    const fastestInvalidated = new Set<Id<"players">>();
    const existingResults = await ctx.db
      .query("matchResults")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .collect();

    for (const result of existingResults) {
      const player = await ctx.db.get("players", result.playerId);
      if (
        player &&
        !result.dnf &&
        !result.missed &&
        result.timeMs === player.fastestTimeMs
      ) {
        fastestInvalidated.add(result.playerId);
      }
      deletedPointsByPlayer.set(
        result.playerId,
        (deletedPointsByPlayer.get(result.playerId) ?? 0) + result.pointsWon
      );
    }

    for (const result of existingResults) {
      await ctx.db.delete("matchResults", result._id);
    }
    const deleted = existingResults.length;
    await ctx.db.delete("matches", match._id);

    for (const [playerId, deletedPoints] of deletedPointsByPlayer) {
      await applyRegistrationPointDelta(
        ctx,
        competition._id,
        playerId,
        -deletedPoints
      );
      await recalculateRegistrationAverageTime(ctx, competition, playerId);

      if (fastestInvalidated.has(playerId)) {
        await recalculatePlayerFastestTime(ctx, playerId);
      }
    }

    return {
      ok: true as const,
      competitionId: competition._id,
      matchId: match._id,
      deleted,
    };
  },
});

export const importMatchData = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    matchNumber: v.number(),
    rankedMatchId: v.string(),
    results: v.array(
      v.object({
        uuid: v.string(),
        timeMs: v.union(v.number(), v.null()),
        dnf: v.boolean(),
        placement: v.union(v.number(), v.null()),
        pointsWon: v.number(),
      })
    ),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    matchId: v.id("matches"),
    upserted: v.number(),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requirePositiveInteger(args.matchNumber, "matchNumber");
    requireNonemptyString(args.rankedMatchId, "rankedMatchId");
    for (const result of args.results) {
      requireNonemptyString(result.uuid, "results[].uuid");
      if (result.timeMs !== null)
        requireNonnegativeInteger(result.timeMs, "results[].timeMs");
      if (result.placement !== null)
        requirePositiveInteger(result.placement, "results[].placement");
      requireFiniteNumber(result.pointsWon, "results[].pointsWon");
      if (result.pointsWon < 0)
        throwWriteError(400, "results[].pointsWon must be nonnegative.");
    }
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) {
      throwWriteError(404, "Competition not found.");
    }
    ensureCompetitionWritable(competition);

    const seenUuids = new Set<string>();
    const duplicateUuid = args.results.find((result) => {
      if (seenUuids.has(result.uuid)) return true;
      seenUuids.add(result.uuid);
      return false;
    });
    if (duplicateUuid) {
      throwWriteError(400, `Duplicate result for uuid ${duplicateUuid.uuid}.`);
    }

    let match = await getMatch(ctx, competition._id, args.matchNumber);
    if (match) {
      if (match.rankedMatchId !== args.rankedMatchId) {
        await ctx.db.patch("matches", match._id, {
          rankedMatchId: args.rankedMatchId,
        });
        match = await ctx.db.get("matches", match._id);
      }
    } else {
      const matchId = await ctx.db.insert("matches", {
        competitionId: competition._id,
        matchNumber: args.matchNumber,
        rankedMatchId: args.rankedMatchId,
        winnerPlayerId: null,
        winnerName: null,
      });
      match = await ctx.db.get("matches", matchId);
    }

    if (!match) {
      throwWriteError(500, "Match could not be created.");
    }

    const existingResults = await ctx.db
      .query("matchResults")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .collect();

    const pointDeltasByPlayer = new Map<Id<"players">, number>();
    const fastestInvalidated = new Set<Id<"players">>();
    for (const existingResult of existingResults) {
      const player = await ctx.db.get("players", existingResult.playerId);
      if (
        player &&
        !existingResult.dnf &&
        !existingResult.missed &&
        existingResult.timeMs === player.fastestTimeMs
      ) {
        fastestInvalidated.add(existingResult.playerId);
      }
      pointDeltasByPlayer.set(
        existingResult.playerId,
        (pointDeltasByPlayer.get(existingResult.playerId) ?? 0) -
          existingResult.pointsWon
      );
    }

    const playersForWinner: Array<{
      player: PlayerDoc;
      placement: number | null;
    }> = [];
    const preparedResults: Array<{
      player: PlayerDoc;
      result: (typeof args.results)[number];
    }> = [];

    for (const result of args.results) {
      const player = await getPlayerByUuid(ctx, result.uuid);
      if (!player) {
        throwWriteError(404, `Player not found for uuid ${result.uuid}.`);
      }

      const registration = await getRegistration(
        ctx,
        competition._id,
        player._id
      );
      if (!registration) {
        throwWriteError(404, `Registration not found for uuid ${result.uuid}.`);
      }

      playersForWinner.push({
        player,
        placement: result.placement,
      });
      preparedResults.push({ player, result });
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", competition._id)
      )
      .collect();
    const preparedResultsByPlayerId = new Map(
      preparedResults.map((prepared) => [prepared.player._id, prepared])
    );

    for (const existingResult of existingResults) {
      await ctx.db.delete("matchResults", existingResult._id);
    }

    for (const registration of registrations) {
      const prepared = preparedResultsByPlayerId.get(registration.playerId);

      if (prepared) {
        const { player, result } = prepared;
        await ctx.db.insert("matchResults", {
          matchId: match._id,
          playerId: player._id,
          ...buildMatchResultSnapshot(competition, match.matchNumber),
          missed: false,
          timeMs: result.timeMs,
          dnf: result.dnf,
          placement: result.placement,
          pointsWon: result.pointsWon,
        });
        pointDeltasByPlayer.set(
          player._id,
          (pointDeltasByPlayer.get(player._id) ?? 0) + result.pointsWon
        );
        if (!fastestInvalidated.has(player._id)) {
          const improved = getImprovedFastestTimeMs(
            player.fastestTimeMs,
            result
          );
          if (improved !== undefined) {
            await ctx.db.patch("players", player._id, {
              fastestTimeMs: improved,
            });
          }
        }

        continue;
      }

      await ctx.db.insert("matchResults", {
        matchId: match._id,
        playerId: registration.playerId,
        ...buildMatchResultSnapshot(competition, match.matchNumber),
        missed: true,
        timeMs: null,
        dnf: false,
        placement: null,
        pointsWon: 0,
      });
    }

    for (const [playerId, pointDelta] of pointDeltasByPlayer) {
      if (pointDelta === 0) continue;
      await applyRegistrationPointDelta(
        ctx,
        competition._id,
        playerId,
        pointDelta
      );
    }

    for (const registration of registrations) {
      await recalculateRegistrationAverageTime(
        ctx,
        competition,
        registration.playerId
      );
    }

    for (const playerId of fastestInvalidated) {
      await recalculatePlayerFastestTime(ctx, playerId);
    }

    await ctx.db.patch(
      "matches",
      match._id,
      buildMatchWinnerPatch(playersForWinner)
    );

    return {
      ok: true as const,
      competitionId: competition._id,
      matchId: match._id,
      upserted: args.results.length,
    };
  },
});

export const setPointAdjustment = internalMutation({
  args: {
    leagueTier: v.number(),
    weekNumber: v.number(),
    uuid: v.string(),
    manualAdjustmentPoints: v.number(),
  },
  returns: v.object({
    ok: v.literal(true),
    registrationId: v.id("registrations"),
    manualAdjustmentPoints: v.number(),
  }),
  handler: async (ctx, args) => {
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requireNonemptyString(args.uuid, "uuid");
    requireFiniteNumber(args.manualAdjustmentPoints, "manualAdjustmentPoints");
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) {
      throwWriteError(404, "Competition not found.");
    }
    ensureCompetitionWritable(competition);

    const player = await getPlayerByUuid(ctx, args.uuid);
    if (!player) {
      throwWriteError(404, "Player not found.");
    }

    const registration = await getRegistration(
      ctx,
      competition._id,
      player._id
    );
    if (!registration) {
      throwWriteError(404, "Registration not found.");
    }

    const manualAdjustmentDelta =
      args.manualAdjustmentPoints - registration.manualAdjustmentPoints;

    await ctx.db.patch("registrations", registration._id, {
      manualAdjustmentPoints: args.manualAdjustmentPoints,
      totalPoints: registration.totalPoints + manualAdjustmentDelta,
    });

    return {
      ok: true as const,
      registrationId: registration._id,
      manualAdjustmentPoints: args.manualAdjustmentPoints,
    };
  },
});
