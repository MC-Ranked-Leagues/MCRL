import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import {
  applyWeekCompetitionDelta,
  ensureLeague,
  getPlayerByUuid,
} from "../lib/readModels";
import {
  type CompetitionDoc,
  requireWriterKey,
  requirePositiveInteger,
  requireNonnegativeInteger,
  requireFiniteNumber,
  requireNonemptyString,
  requireCompetitionKeys,
  requirePercentageHistory,
  throwWriteError,
  getCompetition,
  percentageHistoryValidator,
} from "./helpers";

function requireMovements(
  movements: Array<{
    uuid: string;
    currentPercentage: number | null;
    averagePercentage: number | null;
    playerUpdate?: {
      leagueTier: number;
      percentageHistory: Array<{
        week: number;
        league: number;
        percentage: number;
      }>;
    };
  }>
): void {
  for (const movement of movements) {
    requireNonemptyString(movement.uuid, "movement.uuid");
    if (movement.currentPercentage !== null)
      requireFiniteNumber(movement.currentPercentage, "currentPercentage");
    if (movement.averagePercentage !== null)
      requireFiniteNumber(movement.averagePercentage, "averagePercentage");
    if (movement.playerUpdate) {
      requirePositiveInteger(
        movement.playerUpdate.leagueTier,
        "playerUpdate.leagueTier"
      );
      requirePercentageHistory(movement.playerUpdate.percentageHistory);
    }
  }
}

export const createCompetition = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    maxTimeLimitMs: v.number(),
    startingTime: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    action: v.literal("created"),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requireNonnegativeInteger(args.maxTimeLimitMs, "maxTimeLimitMs");
    if (args.startingTime !== undefined)
      requireNonnegativeInteger(args.startingTime, "startingTime");
    await ensureLeague(ctx, args.leagueTier);
    const existingCompetition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );

    if (existingCompetition) {
      throwWriteError(
        409,
        "Competition already exists for this league and week."
      );
    }

    const competitionId = await ctx.db.insert("competitions", {
      leagueTier: args.leagueTier,
      weekNumber: args.weekNumber,
      status: "active",
      maxTimeLimitMs: args.maxTimeLimitMs,
      startingTime: args.startingTime,
    });
    await applyWeekCompetitionDelta(ctx, args.weekNumber, 1);

    return {
      ok: true as const,
      action: "created" as const,
      competitionId,
    };
  },
});

export const reopenCompetition = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    status: v.literal("active"),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) {
      throwWriteError(404, "Competition not found.");
    }

    if (competition.movementPhase === "done") {
      throwWriteError(403, "Movements already finalized.");
    }

    if (competition.status === "active") {
      return {
        ok: true as const,
        competitionId: competition._id,
        status: "active" as const,
      };
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", competition._id)
      )
      .collect();
    await ctx.db.patch("competitions", competition._id, {
      status: "active",
      movementPhase: undefined,
    });
    for (const registration of registrations) {
      await ctx.db.patch("registrations", registration._id, {
        movementStatus: undefined,
        currentPercentage: undefined,
        averagePercentage: undefined,
      });
    }
    await applyWeekCompetitionDelta(ctx, competition.weekNumber, 1);
    return {
      ok: true as const,
      competitionId: competition._id,
      status: "active" as const,
    };
  },
});

const movementStatusValidator = v.union(
  v.literal("promoted"),
  v.literal("demoted"),
  v.literal("none")
);

const movementFields = {
  uuid: v.string(),
  movementStatus: movementStatusValidator,
  currentPercentage: v.union(v.number(), v.null()),
  averagePercentage: v.union(v.number(), v.null()),
};

async function getMovementRegistrations<
  T extends {
    uuid: string;
    movementStatus: "promoted" | "demoted" | "none";
    currentPercentage: number | null;
    averagePercentage: number | null;
  },
>(ctx: MutationCtx, competition: CompetitionDoc, movements: T[]) {
  if (competition.movementPhase === "done") {
    throwWriteError(403, "Movements already finalized.");
  }
  const registrations = await ctx.db
    .query("registrations")
    .withIndex("by_competition", (q) => q.eq("competitionId", competition._id))
    .collect();
  if (registrations.length !== movements.length) {
    throwWriteError(400, "Movements must cover every registration.");
  }
  const registrationsByPlayer = new Map(
    registrations.map((registration) => [registration.playerId, registration])
  );
  const seen = new Set<Id<"players">>();
  const prepared = [];
  for (const movement of movements) {
    const player = await getPlayerByUuid(ctx, movement.uuid);
    const registration = player && registrationsByPlayer.get(player._id);
    if (!player || !registration || seen.has(player._id)) {
      throwWriteError(
        400,
        `Invalid or duplicate movement for uuid ${movement.uuid}.`
      );
    }
    seen.add(player._id);
    prepared.push({ player, registration, movement });
  }
  return prepared;
}

export const endCompetition = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    movements: v.array(v.object(movementFields)),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requireMovements(args.movements);
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) throwWriteError(404, "Competition not found.");
    const prepared = await getMovementRegistrations(
      ctx,
      competition,
      args.movements
    );
    for (const { registration, movement } of prepared) {
      await ctx.db.patch("registrations", registration._id, {
        movementStatus: movement.movementStatus,
        currentPercentage: movement.currentPercentage,
        averagePercentage: movement.averagePercentage,
      });
    }
    await ctx.db.patch("competitions", competition._id, {
      status: "ended",
      movementPhase: "pending",
    });
    if (competition.status === "active") {
      await applyWeekCompetitionDelta(ctx, competition.weekNumber, -1);
    }
    return {
      ok: true as const,
      competitionId: competition._id,
      count: prepared.length,
    };
  },
});

export const processMovements = mutation({
  args: {
    writerKey: v.string(),
    leagueTier: v.number(),
    weekNumber: v.number(),
    movements: v.array(
      v.object({
        ...movementFields,
        playerUpdate: v.optional(
          v.object({
            leagueTier: v.number(),
            percentageHistory: percentageHistoryValidator,
          })
        ),
      })
    ),
  },
  returns: v.object({
    ok: v.literal(true),
    competitionId: v.id("competitions"),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    requireWriterKey(args.writerKey);
    requireCompetitionKeys(args.leagueTier, args.weekNumber);
    requireMovements(args.movements);
    const competition = await getCompetition(
      ctx,
      args.leagueTier,
      args.weekNumber
    );
    if (!competition) throwWriteError(404, "Competition not found.");
    if (competition.status !== "ended") {
      throwWriteError(403, "Competition is not ended.");
    }
    const prepared = await getMovementRegistrations(
      ctx,
      competition,
      args.movements
    );
    for (const { player, registration, movement } of prepared) {
      await ctx.db.patch("registrations", registration._id, {
        movementStatus: movement.movementStatus,
        currentPercentage: movement.currentPercentage,
        averagePercentage: movement.averagePercentage,
      });
      if (movement.playerUpdate) {
        await ensureLeague(ctx, movement.playerUpdate.leagueTier);
        await ctx.db.patch("players", player._id, {
          currentLeagueNumber: movement.playerUpdate.leagueTier,
          percentageHistory: movement.playerUpdate.percentageHistory,
        });
      }
    }
    await ctx.db.patch("competitions", competition._id, {
      movementPhase: "done",
    });
    return {
      ok: true as const,
      competitionId: competition._id,
      count: prepared.length,
    };
  },
});
