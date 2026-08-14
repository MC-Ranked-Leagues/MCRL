import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  canViewLeague,
  requireActiveUser,
  requireAdmin,
} from "./lib/permissions";
import { requireSettings } from "./lib/settings";
import {
  MAX_ADMIN_SEED_LIST_COUNT,
  MAX_LEAGUE_SEED_LIST_COUNT,
  NUMERIC_SEED_PATTERN,
} from "./lib/consts";
import { getPrimaryActorType, writeLog } from "./lib/logging";
import { hardDeleteSeed } from "./lib/seedDeletion";
import { compareSeedOrder } from "./lib/seedOrder";

type ALL_SEED_TYPES = [
  "BURIED_TREASURE",
  "VILLAGE",
  "DESERT_TEMPLE",
  "JUNGLE_PYRAMID",
  "RUINED_PORTAL",
  "SHIPWRECK",
];

type SeedType = ALL_SEED_TYPES[number];

const seedTypeValidator = v.union(
  v.literal("BURIED_TREASURE"),
  v.literal("VILLAGE"),
  v.literal("DESERT_TEMPLE"),
  v.literal("JUNGLE_PYRAMID"),
  v.literal("RUINED_PORTAL"),
  v.literal("SHIPWRECK")
);

const seedUploadValidator = v.object({
  leagueId: v.id("leagues"),
  overworld: v.string(),
  nether: v.string(),
  end: v.string(),
  rng: v.string(),
  type: seedTypeValidator,
});

type SeedUploadInput = {
  leagueId: Id<"leagues">;
  overworld: string;
  nether: string;
  end: string;
  rng: string;
  type: SeedType;
};

export const listPublishedHistory = internalQuery({
  args: {
    leagueNumber: v.number(),
    weekNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await requireSettings(ctx);

    if (args.weekNumber > settings.currentWeekNumber) {
      return {
        ok: false as const,
        status: 400,
        error: "Future tournament weeks are not available.",
      };
    }

    const league = await ctx.db
      .query("leagues")
      .withIndex("by_leagueNumber", (q) =>
        q.eq("leagueNumber", args.leagueNumber)
      )
      .unique();

    if (!league) {
      return {
        ok: false as const,
        status: 404,
        error: "League not found.",
      };
    }

    if (args.weekNumber < settings.currentWeekNumber) {
      const seeds = await ctx.db
        .query("seeds")
        .withIndex("by_leagueId_and_assignedWeekNumber_and_isExpired", (q) =>
          q
            .eq("leagueId", league._id)
            .eq("assignedWeekNumber", args.weekNumber)
            .eq("isExpired", true)
        )
        .take(MAX_LEAGUE_SEED_LIST_COUNT + 1);
      return buildPublishedHistoryResult(seeds, false);
    }

    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_assignedWeekNumber_and_isUsed", (q) =>
        q
          .eq("leagueId", league._id)
          .eq("assignedWeekNumber", args.weekNumber)
          .eq("isUsed", true)
      )
      .take(MAX_LEAGUE_SEED_LIST_COUNT + 1);

    return buildPublishedHistoryResult(seeds, true);
  },
});

export const listCurrentWeekSeedOrder = internalQuery({
  args: {
    leagueNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSettings(ctx);
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_leagueNumber", (q) =>
        q.eq("leagueNumber", args.leagueNumber)
      )
      .unique();

    if (!league) {
      return {
        ok: false as const,
        status: 404,
        error: "League not found.",
      };
    }

    const seeds = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_isExpired", (q) =>
        q.eq("leagueId", league._id).eq("isExpired", false)
      )
      .take(MAX_LEAGUE_SEED_LIST_COUNT + 1);

    if (seeds.length > MAX_LEAGUE_SEED_LIST_COUNT) {
      return {
        ok: false as const,
        status: 500,
        error: "Too many seeds to return.",
      };
    }

    return {
      ok: true as const,
      seeds: seeds.sort(compareSeedOrder).map((seed, index) => ({
        order: index + 1,
        type: seed.type ?? null,
      })),
    };
  },
});

function buildPublishedHistoryResult(
  seeds: Doc<"seeds">[],
  isCurrentWeek: boolean
) {
  if (seeds.length > MAX_LEAGUE_SEED_LIST_COUNT) {
    return {
      ok: false as const,
      status: 500,
      error: "Too many published seeds to return.",
    };
  }

  return {
    ok: true as const,
    isCurrentWeek,
    seeds: seeds
      .sort(compareSeedOrder)
      .map((seed, index) => toPublishedSeed(seed, index)),
  };
}

function toPublishedSeed(seed: Doc<"seeds">, index: number) {
  return {
    order: index + 1,
    overworld: seed.overworld,
    nether: seed.nether,
    end: seed.end,
    rng: seed.rng,
    type: seed.type ?? null,
  };
}

export const listAllSeeds = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const neverAssignedSeeds = await ctx.db
      .query("seeds")
      .withIndex("by_isExpired", (q) => q.eq("isExpired", undefined))
      .order("desc")
      .take(MAX_ADMIN_SEED_LIST_COUNT);
    const activeAssignedSeeds = await ctx.db
      .query("seeds")
      .withIndex("by_isExpired", (q) => q.eq("isExpired", false))
      .order("desc")
      .take(MAX_ADMIN_SEED_LIST_COUNT);

    return [...neverAssignedSeeds, ...activeAssignedSeeds]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, MAX_ADMIN_SEED_LIST_COUNT);
  },
});

export const listSeedsByLeague = query({
  args: {
    leagueId: v.id("leagues"),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const league = await ctx.db.get("leagues", args.leagueId);

    if (!league || !canViewLeague(user, league)) {
      return [];
    }

    return await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_isExpired", (q) =>
        q.eq("leagueId", args.leagueId).eq("isExpired", false)
      )
      .take(MAX_LEAGUE_SEED_LIST_COUNT);
  },
});

export const getSeedForLeague = query({
  args: {
    leagueId: v.id("leagues"),
    seedId: v.id("seeds"),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);

    if (!seed) {
      return null;
    }
    if (seed.leagueId !== args.leagueId) {
      return null;
    }
    if (seed.isExpired === true) {
      return null;
    }

    const league = await ctx.db.get("leagues", seed.leagueId);

    if (!league || !canViewLeague(user, league)) {
      return null;
    }

    if (!user.roles.includes("admin")) {
      return {
        ...seed,
        addedByUser: null,
      };
    }

    // Hard set for specific id because of accidental user delelion
    const addedBy = await ctx.db.get("users", seed.addedBy);

    return {
      ...seed,
      addedByUser: addedBy
        ? {
            _id: addedBy._id,
            name: addedBy.name,
            uploaderLeagueIds: addedBy.uploaderLeagues ?? [],
            hostLeagueIds: addedBy.hostLeagueId ?? [],
          }
        : null,
    };
  },
});

export const deleteSeed = mutation({
  args: {
    seedId: v.id("seeds"),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);

    if (!seed) {
      throw new ConvexError({
        code: "SEED_NOT_FOUND",
        message: "The requested seed does not exist",
      });
    }

    if (seed.isExpired === true) {
      throw new ConvexError({
        code: "SEED_EXPIRED",
        message: "Expired seeds are read-only",
      });
    }

    if (seed.isUsed) {
      throw new ConvexError({
        code: "SEED_ALREADY_USED",
        message: "Used seeds are read-only",
      });
    }

    if (seed.leagueId === undefined || seed.assignedWeekNumber === undefined) {
      throw new ConvexError({
        code: "SEED_UNASSIGNED",
        message: "Only assigned seeds can be deleted",
      });
    }

    await requireSeedTestingOpen(ctx);

    const canDeleteAsAdmin = user.roles.includes("admin");
    const canDeleteAsOriginalUploader = seed.addedBy === user._id;
    const canDeleteAsHost =
      user.roles.includes("host") &&
      (user.hostLeagueId ?? []).includes(seed.leagueId);

    if (!canDeleteAsAdmin && !canDeleteAsOriginalUploader && !canDeleteAsHost) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You cannot delete this seed",
      });
    }

    await hardDeleteSeed(ctx, seed, user);

    return null;
  },
});

export const markSeedUsed = mutation({
  args: {
    seedId: v.id("seeds"),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);

    if (!seed) {
      throw new ConvexError({
        code: "SEED_NOT_FOUND",
        message: "The requested seed does not exist",
      });
    }

    if (seed.isExpired === true) {
      throw new ConvexError({
        code: "SEED_EXPIRED",
        message: "Expired seeds are read-only",
      });
    }

    if (seed.leagueId === undefined) {
      throw new ConvexError({
        code: "SEED_UNASSIGNED",
        message: "Only assigned seeds can be marked used",
      });
    }

    const league = await ctx.db.get("leagues", seed.leagueId);

    if (!league) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The seed's league does not exist",
      });
    }

    const canMarkAsAdmin = user.roles.includes("admin");
    const canMarkAsHost =
      user.roles.includes("host") &&
      (user.hostLeagueId ?? []).includes(seed.leagueId);

    if (!canMarkAsAdmin && !canMarkAsHost) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message:
          "Only admins and hosts for this league can mark this seed used",
      });
    }

    if (seed.isUsed) {
      return;
    }

    await ctx.db.patch("seeds", seed._id, {
      isUsed: true,
      usedAt: Date.now(),
      usedBy: user._id,
    });

    await ctx.db.patch("leagues", league._id, {
      usedSeedCount: league.usedSeedCount + 1,
    });

    await writeLog(ctx, {
      eventType: "seed.marked_used",
      actor: user,
      actorType: canMarkAsAdmin ? "admin" : "host",
      targetType: "seed",
      targetId: seed._id,
      targetLabel: getSeedLogLabel(seed),
      summary: `Marked seed #${seed.seedNumber ?? "unknown"} in ${league.leagueName} as used.`,
    });
  },
});

export const changeSeedLeague = mutation({
  args: {
    seedId: v.id("seeds"),
    leagueId: v.id("leagues"),
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

    if (seed.leagueId === undefined) {
      throw new ConvexError({
        code: "SEED_UNASSIGNED",
        message: "Only assigned seeds can move to another league",
      });
    }

    if (seed.isExpired === true) {
      throw new ConvexError({
        code: "SEED_EXPIRED",
        message: "Expired seeds are read-only",
      });
    }

    if (seed.isUsed) {
      throw new ConvexError({
        code: "SEED_ALREADY_USED",
        message: "Used seeds are read-only",
      });
    }

    if (seed.leagueId === args.leagueId) {
      return;
    }

    const [sourceLeague, targetLeague] = await Promise.all([
      ctx.db.get("leagues", seed.leagueId),
      ctx.db.get("leagues", args.leagueId),
    ]);

    if (!targetLeague) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The requested league id does not exist",
      });
    }

    const seedsAlreadyInTargetLeague = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_isExpired", (q) =>
        q.eq("leagueId", targetLeague._id).eq("isExpired", false)
      )
      .collect();

    await ctx.db.patch("seeds", seed._id, {
      seedNumber: seedsAlreadyInTargetLeague.length + 1,
      leagueId: targetLeague._id,
      leagueChangedByAdminId: admin._id,
    });

    if (sourceLeague) {
      await ctx.db.patch("leagues", sourceLeague._id, {
        seedCount: Math.max(0, sourceLeague.seedCount - 1),
      });
    }

    await ctx.db.patch("leagues", targetLeague._id, {
      seedCount: targetLeague.seedCount + 1,
    });

    // recalculate seed numbers for the previous league
    const previousId = seed.leagueId;
    const seedsOnPreviousLeague = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_isExpired", (q) =>
        q.eq("leagueId", previousId).eq("isExpired", false)
      )
      .collect();

    const sorted = seedsOnPreviousLeague.sort(
      (a, b) => (a.seedNumber ?? 0) - (b.seedNumber ?? 0)
    );

    await Promise.all(
      sorted.map((s, i) => ctx.db.patch("seeds", s._id, { seedNumber: i + 1 }))
    );

    await writeLog(ctx, {
      eventType: "seed.league_changed",
      actor: admin,
      actorType: "admin",
      targetType: "seed",
      targetId: seed._id,
      targetLabel: getSeedLogLabel(seed),
      summary: `Moved the seed from ${sourceLeague?.leagueName ?? "a deleted league"} to ${targetLeague.leagueName}; its position changed from #${seed.seedNumber ?? "unknown"} to #${seedsAlreadyInTargetLeague.length + 1}.`,
    });
  },
});

export const importSeeds = mutation({
  args: {
    seed: seedUploadValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);

    const isAdmin = user.roles.includes("admin");
    const isUploader = user.roles.includes("uploader");
    const canUploadAsUploader =
      isUploader && (user.uploaderLeagues ?? []).includes(args.seed.leagueId);
    const canUploadAsHost =
      user.roles.includes("host") &&
      (user.hostLeagueId ?? []).includes(args.seed.leagueId);

    if (!isAdmin) {
      if (!isUploader && !user.roles.includes("host")) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Only admins, hosts, and uploaders can import seeds",
        });
      }

      if (!canUploadAsUploader && !canUploadAsHost) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "You can only upload seeds for leagues you are an uploader for and for the leagues you host.",
        });
      }

      await requireSeedTestingOpen(ctx);
    }

    const seed = await normalizeSeed(ctx, args.seed);
    const settings = await requireSettings(ctx);

    if (seed.type === "JUNGLE_PYRAMID" && !settings.enableJunglePyramidSeeds) {
      throw new ConvexError({
        code: "EXPERIMENTAL_SEED_TYPE_DISABLED",
        message: "Jungle pyramid seed uploads are not currently enabled",
      });
    }

    // League existance check
    const league = await ctx.db.get("leagues", seed.leagueId);

    if (!league) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The requested league id does not exist",
      });
    }

    const existing = await ctx.db
      .query("seeds")
      .withIndex("by_owseed", (q) => q.eq("overworld", seed.overworld))
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Seed already exists.",
      });
    }

    const seedsAlreadyInThisLeague = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_isExpired", (q) =>
        q.eq("leagueId", seed.leagueId).eq("isExpired", false)
      )
      .collect();

    const seedNumber = seedsAlreadyInThisLeague.length + 1;
    const seedId = await ctx.db.insert("seeds", {
      seedNumber,

      overworld: seed.overworld,
      nether: seed.nether,
      end: seed.end,
      rng: seed.rng,
      type: seed.type,
      isBt: seed.type === "BURIED_TREASURE",

      leagueId: seed.leagueId,
      isExpired: false,
      assignedWeekNumber: settings?.currentWeekNumber,

      addedBy: user._id,
      isUsed: false,
      commentCount: 0,
    });

    await ctx.db.patch("leagues", seed.leagueId, {
      seedCount: league.seedCount + 1,
    });

    await writeLog(ctx, {
      eventType: "seed.uploaded",
      actor: user,
      actorType: isAdmin ? "admin" : canUploadAsUploader ? "uploader" : "host",
      targetType: "seed",
      targetId: seedId,
      targetLabel: `Seed ${seed.overworld}`,
      summary: `Uploaded a ${seed.type.toLowerCase().replace(/_/g, " ")} seed as #${seedNumber} to ${league.leagueName} for week ${settings.currentWeekNumber}.`,
    });

    return seedId;
  },
});

export const moveSeed = mutation({
  args: {
    seedId: v.id("seeds"),
    movement: v.union(v.literal("UP"), v.literal("DOWN")),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const seed = await ctx.db.get("seeds", args.seedId);

    if (!seed) {
      throw new ConvexError({
        code: "SEED_NOT_FOUND",
        message: "The requested seed does not exist",
      });
    }

    if (seed.leagueId === undefined || seed.isExpired !== false) {
      throw new ConvexError({
        code: "SEED_NOT_ACTIVE",
        message: "Only active assigned seeds can be reordered",
      });
    }

    const league = await ctx.db.get("leagues", seed.leagueId);
    if (!league || !canViewLeague(user, league)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You cannot reorder seeds in this league",
      });
    }

    const seedNumber = seed.seedNumber;

    if (!seedNumber) {
      throw new ConvexError({
        code: "SEED_NUMBER_UNDEFINED",
        message: "The seed number wasn't initialized",
      });
    }

    const nextSeedNumber =
      args.movement === "UP" ? seedNumber - 1 : seedNumber + 1;

    if (nextSeedNumber < 1) {
      return;
    }

    const adjacentSeed = await ctx.db
      .query("seeds")
      .withIndex("by_number_league_expired", (q) =>
        q
          .eq("seedNumber", nextSeedNumber)
          .eq("leagueId", seed.leagueId)
          .eq("isExpired", false)
      )
      .unique();

    if (!adjacentSeed) {
      return;
    }

    await ctx.db.patch("seeds", seed._id, { seedNumber: nextSeedNumber });
    await ctx.db.patch("seeds", adjacentSeed._id, { seedNumber });

    await writeLog(ctx, {
      eventType: "seed.reordered",
      actor: user,
      actorType: getPrimaryActorType(user),
      targetType: "seed",
      targetId: seed._id,
      targetLabel: getSeedLogLabel(seed),
      summary: `Moved the seed from position #${seedNumber} to #${nextSeedNumber} in ${league.leagueName}.`,
    });
  },
});

async function normalizeSeed(ctx: MutationCtx, seeds: SeedUploadInput) {
  const normalizedSeed = {
    leagueId: seeds.leagueId,
    type: seeds.type,
    overworld: validateNumericSeedString(seeds.overworld, "Overworld seed"),
    nether: validateNumericSeedString(seeds.nether, "Nether seed"),
    end: validateNumericSeedString(seeds.end, "End seed"),
    rng: validateNumericSeedString(seeds.rng, "RNG seed"),
  };

  const league = await ctx.db.get("leagues", normalizedSeed.leagueId);
  if (league === null) {
    throw new ConvexError({
      code: "LEAGUE_NOT_EXIST",
      message: "The requested league id does not exist",
    });
  }

  return normalizedSeed;
}

async function requireSeedTestingOpen(ctx: MutationCtx) {
  const settings = await requireSettings(ctx);

  if (settings.seedTestingPaused) {
    throw new ConvexError({
      code: "SEED_TESTING_PAUSED",
      message: "Seed testing is currently paused",
    });
  }

  return settings;
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

function getSeedLogLabel(seed: Pick<Doc<"seeds">, "overworld">) {
  return `Seed ${seed.overworld}`;
}
