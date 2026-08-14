import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const SETTINGS_KEY = "global";

export async function getSettings(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
}

export async function requireSettings(ctx: QueryCtx | MutationCtx) {
  const settings = await getSettings(ctx);

  if (!settings) {
    throw new ConvexError({
      code: "SETTINGS_NOT_INITIALIZED",
      message: "Tournament settings have not been initialized",
    });
  }

  return settings;
}
