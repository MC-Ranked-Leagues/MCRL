import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { MAX_LEAGUE_SEED_LIST_COUNT, NUMERIC_SEED_PATTERN } from "./lib/consts";
import { writeLog } from "./lib/logging";
import { requireAdmin } from "./lib/permissions";
import { hardDeleteSeed } from "./lib/seedDeletion";
import { compareSeedOrder } from "./lib/seedOrder";
import { requireSettings } from "./lib/settings";

const seedTypeValidator = v.union(
  v.literal("BURIED_TREASURE"),
  v.literal("VILLAGE"),
  v.literal("DESERT_TEMPLE"),
  v.literal("JUNGLE_PYRAMID"),
  v.literal("RUINED_PORTAL"),
  v.literal("SHIPWRECK"),
);

const seedValuesValidator = {
  overworld: v.string(),
  nether: v.string(),
  end: v.string(),
  rng: v.string(),
  type: seedTypeValidator,
};

export const listSeeds = query({
  args: {
    leagueId: v.id("leagues"),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const settings = await requireSettings(ctx);
    validateWeekNumber(args.weekNumber, settings.currentWeekNumber);

    const league = await ctx.db.get("leagues", args.leagueId);
    if (!league) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The requested league does not exist",
      });
    }

    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_assignedWeekNumber_and_seedNumber", (q) =>
        q
          .eq("leagueId", args.leagueId)
          .eq("assignedWeekNumber", args.weekNumber),
      )
      .take(MAX_LEAGUE_SEED_LIST_COUNT + 1);

    if (seeds.length > MAX_LEAGUE_SEED_LIST_COUNT) {
      throw new ConvexError({
        code: "TOO_MANY_SEEDS",
        message: "Too many seeds to manage in one league and week",
      });
    }

    return seeds.sort(compareSeedOrder);
  },
});

export const addSeed = mutation({
  args: {
    leagueId: v.id("leagues"),
    weekNumber: v.number(),
    ...seedValuesValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const settings = await requireSettings(ctx);
    validateHistoricalWeekNumber(args.weekNumber, settings.currentWeekNumber);

    const league = await ctx.db.get("leagues", args.leagueId);
    if (!league) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The requested league does not exist",
      });
    }

    const values = validateSeedValues(args);
    const duplicate = await ctx.db
      .query("seeds")
      .withIndex("by_owseed", (q) => q.eq("overworld", values.overworld))
      .unique();
    if (duplicate) {
      throw new ConvexError({
        code: "DUPLICATE_SEED",
        message: "Seed already exists",
      });
    }

    const group = await getSeedGroup(ctx, args.leagueId, args.weekNumber);
    const seedNumber =
      group.reduce(
        (highest, seed) => Math.max(highest, seed.seedNumber ?? 0),
        0,
      ) + 1;
    const now = Date.now();
    const seedId = await ctx.db.insert("seeds", {
      ...values,
      seedNumber,
      leagueId: league._id,
      assignedWeekNumber: args.weekNumber,
      isExpired: true,
      isUsed: true,
      isBt: values.type === "BURIED_TREASURE",
      addedBy: admin._id,
      usedAt: now,
      usedBy: admin._id,
      commentCount: 0,
    });

    await writeLog(ctx, {
      eventType: "seed.uploaded",
      actor: admin,
      actorType: "admin",
      targetType: "seed",
      targetId: seedId,
      targetLabel: `Seed ${values.overworld}`,
      summary: `Added a ${formatSeedType(values.type)} seed as #${seedNumber} to ${league.leagueName} for historical week ${args.weekNumber}.`,
    });

    return seedId;
  },
});

export const updateSeed = mutation({
  args: {
    seedId: v.id("seeds"),
    ...seedValuesValidator,
    isUsed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const settings = await requireSettings(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);
    if (!seed) {
      throw new ConvexError({
        code: "SEED_NOT_FOUND",
        message: "The requested seed does not exist",
      });
    }
    if (seed.leagueId === undefined || seed.assignedWeekNumber === undefined) {
      throw new ConvexError({
        code: "SEED_NOT_MANAGED",
        message: "Only assigned seeds can be managed on this page",
      });
    }

    const values = validateSeedValues(args);
    if (values.overworld !== seed.overworld) {
      const duplicate = await ctx.db
        .query("seeds")
        .withIndex("by_owseed", (q) => q.eq("overworld", values.overworld))
        .unique();
      if (duplicate && duplicate._id !== seed._id) {
        throw new ConvexError({
          code: "DUPLICATE_SEED",
          message: "Seed already exists",
        });
      }
    }

    const changedFields = getChangedFields(seed, values, args.isUsed);
    if (changedFields.length === 0) {
      return null;
    }

    await ctx.db.patch("seeds", seed._id, {
      ...values,
      isBt: values.type === "BURIED_TREASURE",
      isUsed: args.isUsed,
      ...(args.isUsed === seed.isUsed
        ? {}
        : args.isUsed
          ? { usedAt: Date.now(), usedBy: admin._id }
          : { usedAt: undefined, usedBy: undefined }),
    });

    if (
      args.isUsed !== seed.isUsed &&
      seed.assignedWeekNumber === settings.currentWeekNumber &&
      seed.isExpired === false
    ) {
      const league = await ctx.db.get("leagues", seed.leagueId);
      if (!league) {
        throw new ConvexError({
          code: "LEAGUE_NOT_EXIST",
          message: "The seed's league does not exist",
        });
      }
      await ctx.db.patch("leagues", league._id, {
        usedSeedCount: Math.max(
          0,
          league.usedSeedCount + (args.isUsed ? 1 : -1),
        ),
      });
    }

    await writeLog(ctx, {
      eventType: "seed.updated",
      actor: admin,
      actorType: "admin",
      targetType: "seed",
      targetId: seed._id,
      targetLabel: `Seed ${seed.overworld}`,
      summary: `Updated ${formatFieldList(changedFields)} for seed #${seed.seedNumber ?? "unknown"} in week ${seed.assignedWeekNumber}.`,
    });

    return null;
  },
});

export const reorderSeed = mutation({
  args: {
    seedId: v.id("seeds"),
    movement: v.union(v.literal("UP"), v.literal("DOWN")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);
    if (!seed) {
      throw new ConvexError({
        code: "SEED_NOT_FOUND",
        message: "The requested seed does not exist",
      });
    }
    if (seed.leagueId === undefined || seed.assignedWeekNumber === undefined) {
      throw new ConvexError({
        code: "SEED_NOT_MANAGED",
        message: "Only assigned seeds can be managed on this page",
      });
    }

    const [league, group] = await Promise.all([
      ctx.db.get("leagues", seed.leagueId),
      getSeedGroup(ctx, seed.leagueId, seed.assignedWeekNumber),
    ]);
    if (!league) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The seed's league does not exist",
      });
    }

    const currentIndex = group.findIndex((item) => item._id === seed._id);
    const nextIndex =
      args.movement === "UP" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex === -1 || nextIndex < 0 || nextIndex >= group.length) {
      return null;
    }

    [group[currentIndex], group[nextIndex]] = [
      group[nextIndex],
      group[currentIndex],
    ];
    for (const [index, item] of group.entries()) {
      const seedNumber = index + 1;
      if (item.seedNumber !== seedNumber) {
        await ctx.db.patch("seeds", item._id, { seedNumber });
      }
    }

    await writeLog(ctx, {
      eventType: "seed.reordered",
      actor: admin,
      actorType: "admin",
      targetType: "seed",
      targetId: seed._id,
      targetLabel: `Seed ${seed.overworld}`,
      summary: `Moved the seed from position #${currentIndex + 1} to #${nextIndex + 1} in ${league.leagueName} for week ${seed.assignedWeekNumber}.`,
    });

    return null;
  },
});

export const deleteSeed = mutation({
  args: {
    seedId: v.id("seeds"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);
    if (!seed) {
      throw new ConvexError({
        code: "SEED_NOT_FOUND",
        message: "The requested seed does not exist",
      });
    }
    if (seed.leagueId === undefined || seed.assignedWeekNumber === undefined) {
      throw new ConvexError({
        code: "SEED_NOT_MANAGED",
        message: "Only assigned seeds can be managed on this page",
      });
    }

    await hardDeleteSeed(ctx, seed, admin);

    return null;
  },
});

function validateWeekNumber(weekNumber: number, currentWeekNumber: number) {
  if (
    !Number.isSafeInteger(weekNumber) ||
    weekNumber < 1 ||
    weekNumber > currentWeekNumber
  ) {
    throw new ConvexError({
      code: "INVALID_WEEK_NUMBER",
      message: `Week number must be between 1 and ${currentWeekNumber}`,
    });
  }
}

function validateHistoricalWeekNumber(
  weekNumber: number,
  currentWeekNumber: number,
) {
  validateWeekNumber(weekNumber, currentWeekNumber);
  if (weekNumber === currentWeekNumber) {
    throw new ConvexError({
      code: "CURRENT_WEEK_ADD_DISABLED",
      message: "Add current week seeds through the existing workflows",
    });
  }
}

function validateSeedValues(values: {
  overworld: string;
  nether: string;
  end: string;
  rng: string;
  type: Doc<"seeds">["type"];
}) {
  if (!values.type) {
    throw new ConvexError({
      code: "SEED_TYPE_REQUIRED",
      message: "Seed type is required",
    });
  }

  return {
    overworld: validateNumericSeedString(values.overworld, "Overworld seed"),
    nether: validateNumericSeedString(values.nether, "Nether seed"),
    end: validateNumericSeedString(values.end, "End seed"),
    rng: validateNumericSeedString(values.rng, "RNG seed"),
    type: values.type,
  };
}

function validateNumericSeedString(value: string, label: string) {
  const trimmedValue = value.trim();
  if (!NUMERIC_SEED_PATTERN.test(trimmedValue)) {
    throw new ConvexError({
      code: "INVALID_SEED_VALUE",
      message: `${label} must be a whole number`,
    });
  }
  return trimmedValue;
}

async function getSeedGroup(
  ctx: Parameters<typeof requireAdmin>[0],
  leagueId: Doc<"leagues">["_id"],
  weekNumber: number,
) {
  const seeds = await ctx.db
    .query("seeds")
    .withIndex("by_leagueId_and_assignedWeekNumber_and_seedNumber", (q) =>
      q.eq("leagueId", leagueId).eq("assignedWeekNumber", weekNumber),
    )
    .take(MAX_LEAGUE_SEED_LIST_COUNT + 1);
  if (seeds.length > MAX_LEAGUE_SEED_LIST_COUNT) {
    throw new ConvexError({
      code: "TOO_MANY_SEEDS",
      message: "Too many seeds to manage in one league and week",
    });
  }
  return seeds.sort(compareSeedOrder);
}

function formatSeedType(type: NonNullable<Doc<"seeds">["type"]>) {
  return type.toLowerCase().replace(/_/g, " ");
}

function getChangedFields(
  seed: Doc<"seeds">,
  values: ReturnType<typeof validateSeedValues>,
  isUsed: boolean,
) {
  const changedFields: string[] = [];
  if (seed.overworld !== values.overworld) changedFields.push("overworld");
  if (seed.nether !== values.nether) changedFields.push("nether");
  if (seed.end !== values.end) changedFields.push("end");
  if (seed.rng !== values.rng) changedFields.push("RNG");
  if (seed.type !== values.type) changedFields.push("seed type");
  if (seed.isUsed !== isUsed) changedFields.push("used state");
  return changedFields;
}

function formatFieldList(fields: string[]) {
  if (fields.length === 1) return fields[0];
  return `${fields.slice(0, -1).join(", ")} and ${fields[fields.length - 1]}`;
}
