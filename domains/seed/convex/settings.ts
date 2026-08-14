import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireActiveUser, requireAdmin } from "./lib/permissions";
import { getSettings, requireSettings } from "./lib/settings";
import { MAX_WEEK_EXPIRATION_COUNT } from "./lib/consts";
import { writeLog } from "./lib/logging";

export const current = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);

    return await getSettings(ctx);
  },
});

export const pauseSeedTesting = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const settings = await requireSettings(ctx);

    if (settings.seedTestingPaused) {
      return;
    }

    await ctx.db.patch("settings", settings._id, {
      seedTestingPaused: true,
    });

    await writeLog(ctx, {
      eventType: "testing.paused",
      actor: admin,
      actorType: "admin",
      targetType: "settings",
      targetId: settings._id,
      targetLabel: `Week ${settings.currentWeekNumber} testing`,
      summary: `Paused seed testing for week ${settings.currentWeekNumber}.`,
    });
  },
});

export const resumeSeedTesting = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const settings = await requireSettings(ctx);

    if (!settings.seedTestingPaused) {
      return;
    }

    await ctx.db.patch("settings", settings._id, {
      seedTestingPaused: false,
    });

    await writeLog(ctx, {
      eventType: "testing.resumed",
      actor: admin,
      actorType: "admin",
      targetType: "settings",
      targetId: settings._id,
      targetLabel: `Week ${settings.currentWeekNumber} testing`,
      summary: `Resumed seed testing for week ${settings.currentWeekNumber}.`,
    });
  },
});

export const setJunglePyramidSeedsEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const settings = await requireSettings(ctx);

    if ((settings.enableJunglePyramidSeeds ?? false) === args.enabled) {
      return;
    }

    await ctx.db.patch("settings", settings._id, {
      enableJunglePyramidSeeds: args.enabled,
    });
  },
});

type AdvanceWeekResult = {
  currentWeekNumber: number;
  expiredCount: number;
};

export const advanceWeekInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const settings = await requireSettings(ctx);
    const activeSeeds = await ctx.db
      .query("seeds")
      .withIndex("by_isExpired", (q) => q.eq("isExpired", false))
      .take(MAX_WEEK_EXPIRATION_COUNT);

    // In case there were more seeds, fail instead of partially finishing
    if (activeSeeds.length >= MAX_WEEK_EXPIRATION_COUNT) {
      throw new ConvexError({
        code: "TOO_MANY_ACTIVE_SEEDS",
        message: "Too many active seeds to expire in one week advance",
      });
    }

    const leagues = activeSeeds
      .map((s) => s.leagueId)
      .filter((lid) => lid !== undefined);

    let expiredCount = 0;

    for (const seed of activeSeeds) {
      await ctx.db.patch("seeds", seed._id, {
        isExpired: true,
      });
      expiredCount += 1;
    }

    // Set all league counts to zero because all active seeds expired
    for (const leagueId of leagues) {
      await ctx.db.patch("leagues", leagueId, {
        seedCount: 0,
        usedSeedCount: 0,
      });
    }

    // reset host and uploader roles
    const users = await ctx.db.query("users").collect();
    const clearedUserCount = users.filter(
      (user) =>
        (user.hostLeagueId?.length ?? 0) > 0 ||
        (user.uploaderLeagues?.length ?? 0) > 0,
    ).length;

    await Promise.all(
      users.map((u) =>
        ctx.db.patch("users", u._id, {
          hostLeagueId: [],
          uploaderLeagues: [],
        }),
      ),
    );

    await ctx.db.patch("settings", settings._id, {
      currentWeekNumber: settings.currentWeekNumber + 1,
      seedTestingPaused: true,
    });

    await writeLog(ctx, {
      eventType: "week.advanced",
      actor: admin,
      actorType: "admin",
      targetType: "settings",
      targetId: settings._id,
      targetLabel: `Week ${settings.currentWeekNumber + 1}`,
      summary: `Advanced from week ${settings.currentWeekNumber} to week ${settings.currentWeekNumber + 1}, expired ${expiredCount} active ${expiredCount === 1 ? "seed" : "seeds"}, cleared weekly league assignments for ${clearedUserCount} ${clearedUserCount === 1 ? "user" : "users"}, and paused testing.`,
    });

    return {
      currentWeekNumber: settings.currentWeekNumber + 1,
      expiredCount,
    };
  },
});

export const advanceWeek = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const result: AdvanceWeekResult = await ctx.runMutation(
      internal.settings.advanceWeekInternal,
      {},
    );

    return result;
  },
});
