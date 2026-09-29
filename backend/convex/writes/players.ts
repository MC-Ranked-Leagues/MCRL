import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, mutation } from "../_generated/server";
import {
  buildRegistrationSnapshot,
  ensureLeague,
  getPlayerByUuid,
  recomputeMatchWinnerSnapshot,
  syncPlayerRegistrationSnapshots,
  syncPlayerWinnerSnapshots,
} from "../lib/readModels";
import { ensureRegistrationMatchOutcomes } from "../lib/matchOutcomes";
import {
  requireWriterKey,
  requirePositiveInteger,
  requireFiniteNumber,
  requireNonemptyString,
  requireCompetitionKeys,
  requirePercentageHistory,
  throwWriteError,
  getCompetition,
  ensureCompetitionWritable,
  getRegistration,
  recalculateRegistrationAverageTime,
  recalculatePlayerFastestTime,
  percentageHistoryValidator,
} from "./helpers";

function buildPlayerPatch(args: {
  uuid?: string;
  ign?: string;
  lowercaseIgn?: string;
  elo?: number;
  currentLeagueNumber: number;
}) {
  const patch: Partial<Doc<"players">> = {
    currentLeagueNumber: args.currentLeagueNumber,
  };

  if (args.uuid !== undefined) patch.uuid = args.uuid;
  if (args.ign !== undefined) patch.ign = args.ign;
  if (args.lowercaseIgn !== undefined) patch.lowercaseIgn = args.lowercaseIgn;
  if (args.elo !== undefined) patch.elo = args.elo;

  return patch;
}

export const registerPlayer = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    uuid: v.string(),
    ign: v.string(),
    elo: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    playerId: v.id("players"),
    registrationCreated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requireNonemptyString(args.uuid, "uuid");
    requireNonemptyString(args.ign, "ign");
    if (args.elo !== undefined) requireFiniteNumber(args.elo, "elo");
    await ensureLeague(ctx, args.leagueTier);
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) {
      throwWriteError(404, "Competition not found.");
    }
    ensureCompetitionWritable(competition);

    const normalizedLowercaseIgn = args.ign.toLowerCase();
    let player = await getPlayerByUuid(ctx, args.uuid);

    if (player) {
      await ctx.db.patch(
        "players",
        player._id,
        buildPlayerPatch({
          uuid: args.uuid,
          ign: args.ign,
          lowercaseIgn: normalizedLowercaseIgn,
          elo: args.elo,
          currentLeagueNumber: args.leagueTier,
        })
      );
      player = await ctx.db.get("players", player._id);
    } else {
      const playerId = await ctx.db.insert("players", {
        currentLeagueNumber: args.leagueTier,
        uuid: args.uuid,
        ign: args.ign,
        lowercaseIgn: normalizedLowercaseIgn,
        ...(args.elo !== undefined ? { elo: args.elo } : {}),
      });
      player = await ctx.db.get("players", playerId);
      if (!player) {
        throwWriteError(500, "Player could not be created.");
      }
    }

    if (!player) {
      throwWriteError(500, "Player could not be loaded.");
    }

    await syncPlayerRegistrationSnapshots(ctx, player._id, player);
    await syncPlayerWinnerSnapshots(ctx, player._id, player);

    const existingRegistration = await getRegistration(
      ctx,
      competition._id,
      player._id
    );

    let registrationCreated = false;
    if (!existingRegistration) {
      await ctx.db.insert("registrations", {
        competitionId: competition._id,
        playerId: player._id,
        manualAdjustmentPoints: 0,
        computedSeedPoints: 0,
        totalPoints: 0,
        averageTimeMs: null,
        ...buildRegistrationSnapshot(player, competition),
      });
      registrationCreated = true;
    } else {
      await ctx.db.patch("registrations", existingRegistration._id, {
        ...buildRegistrationSnapshot(player, competition),
      });
    }

    await ensureRegistrationMatchOutcomes(ctx, competition, player._id);
    await recalculateRegistrationAverageTime(ctx, competition, player._id);

    return {
      ok: true as const,
      competitionId: competition._id,
      playerId: player._id,
      registrationCreated,
    };
  },
});

export const unregisterPlayer = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    uuid: v.string(),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    playerId: v.id("players"),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requireNonemptyString(args.uuid, "uuid");
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

    const results = await ctx.db
      .query("matchResults")
      .withIndex("by_player_and_competition", (q) =>
        q.eq("playerId", player._id).eq("competitionId", competition._id)
      )
      .collect();
    const fastestInvalidated = results.some(
      (result) =>
        !result.dnf && !result.missed && result.timeMs === player.fastestTimeMs
    );
    await ctx.db.delete("registrations", registration._id);
    for (const result of results) {
      await ctx.db.delete("matchResults", result._id);
      await recomputeMatchWinnerSnapshot(ctx, result.matchId);
    }
    if (fastestInvalidated) await recalculatePlayerFastestTime(ctx, player._id);

    return {
      ok: true as const,
      competitionId: competition._id,
      playerId: player._id,
    };
  },
});

export const updatePlayerLeague = internalMutation({
  args: {
    uuid: v.string(),
    leagueTier: v.number(),
    percentageHistory: v.optional(percentageHistoryValidator),
  },
  returns: v.object({
    ok: v.literal(true),
    playerId: v.id("players"),
    previousLeagueTier: v.number(),
    leagueTier: v.number(),
  }),
  handler: async (ctx, args) => {
    requireNonemptyString(args.uuid, "uuid");
    requirePositiveInteger(args.leagueTier, "leagueTier");
    if (args.percentageHistory !== undefined)
      requirePercentageHistory(args.percentageHistory);
    await ensureLeague(ctx, args.leagueTier);

    const player = await getPlayerByUuid(ctx, args.uuid);
    if (!player) {
      throwWriteError(404, "Player not found.");
    }

    if (player.currentLeagueNumber === args.leagueTier) {
      if (args.percentageHistory !== undefined) {
        await ctx.db.patch("players", player._id, {
          percentageHistory: args.percentageHistory,
        });
      }
      return {
        ok: true as const,
        playerId: player._id,
        previousLeagueTier: player.currentLeagueNumber,
        leagueTier: player.currentLeagueNumber,
      };
    }

    await ctx.db.patch("players", player._id, {
      currentLeagueNumber: args.leagueTier,
      ...(args.percentageHistory !== undefined
        ? { percentageHistory: args.percentageHistory }
        : {}),
    });

    return {
      ok: true as const,
      playerId: player._id,
      previousLeagueTier: player.currentLeagueNumber,
      leagueTier: args.leagueTier,
    };
  },
});

export const upsertPlayer = mutation({
  args: {
    writerKey: v.string(),
    uuid: v.string(),
    ign: v.string(),
    leagueTier: v.number(),
    elo: v.optional(v.number()),
    percentageHistory: v.optional(percentageHistoryValidator),
  },
  returns: v.object({
    ok: v.literal(true),
    playerId: v.id("players"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireNonemptyString(args.uuid, "uuid");
    requireNonemptyString(args.ign, "ign");
    requirePositiveInteger(args.leagueTier, "leagueTier");
    if (args.elo !== undefined) requireFiniteNumber(args.elo, "elo");
    if (args.percentageHistory !== undefined)
      requirePercentageHistory(args.percentageHistory);
    await ensureLeague(ctx, args.leagueTier);
    const existing = await getPlayerByUuid(ctx, args.uuid);
    if (existing) {
      await ctx.db.patch(
        "players",
        existing._id,
        buildPlayerPatch({
          ign: args.ign,
          lowercaseIgn: args.ign.toLowerCase(),
          currentLeagueNumber: args.leagueTier,
          elo: args.elo,
        })
      );
      if (args.percentageHistory !== undefined) {
        await ctx.db.patch("players", existing._id, {
          percentageHistory: args.percentageHistory,
        });
      }
      const updated = (await ctx.db.get("players", existing._id))!;
      await syncPlayerRegistrationSnapshots(ctx, updated._id, updated);
      await syncPlayerWinnerSnapshots(ctx, updated._id, updated);
      return { ok: true as const, playerId: existing._id, created: false };
    }
    const playerId = await ctx.db.insert("players", {
      uuid: args.uuid,
      ign: args.ign,
      lowercaseIgn: args.ign.toLowerCase(),
      currentLeagueNumber: args.leagueTier,
      ...(args.percentageHistory !== undefined
        ? { percentageHistory: args.percentageHistory }
        : {}),
      ...(args.elo !== undefined ? { elo: args.elo } : {}),
    });
    return { ok: true as const, playerId, created: true };
  },
});

export const migratePlayerAccount = mutation({
  args: {
    writerKey: v.string(),
    oldUuid: v.string(),
    newUuid: v.string(),
    ign: v.string(),
    leagueTier: v.number(),
    elo: v.optional(v.number()),
  },
  returns: v.object({ ok: v.literal(true), playerId: v.id("players") }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireNonemptyString(args.oldUuid, "oldUuid");
    requireNonemptyString(args.newUuid, "newUuid");
    requireNonemptyString(args.ign, "ign");
    requirePositiveInteger(args.leagueTier, "leagueTier");
    if (args.elo !== undefined) requireFiniteNumber(args.elo, "elo");
    if (args.oldUuid === args.newUuid) {
      throwWriteError(400, "Invalid account migration.");
    }
    await ensureLeague(ctx, args.leagueTier);
    const oldPlayer = await getPlayerByUuid(ctx, args.oldUuid);
    if (oldPlayer) {
      await ctx.db.patch("players", oldPlayer._id, { percentageHistory: [] });
    }
    const destination = await getPlayerByUuid(ctx, args.newUuid);
    if (destination) {
      await ctx.db.patch("players", destination._id, {
        ...buildPlayerPatch({
          ign: args.ign,
          lowercaseIgn: args.ign.toLowerCase(),
          currentLeagueNumber: args.leagueTier,
          elo: args.elo,
        }),
        percentageHistory: [],
      });
      const updated = (await ctx.db.get("players", destination._id))!;
      await syncPlayerRegistrationSnapshots(ctx, updated._id, updated);
      await syncPlayerWinnerSnapshots(ctx, updated._id, updated);
      return { ok: true as const, playerId: destination._id };
    }
    const playerId = await ctx.db.insert("players", {
      uuid: args.newUuid,
      ign: args.ign,
      lowercaseIgn: args.ign.toLowerCase(),
      currentLeagueNumber: args.leagueTier,
      percentageHistory: [],
      ...(args.elo !== undefined ? { elo: args.elo } : {}),
    });
    return { ok: true as const, playerId };
  },
});
