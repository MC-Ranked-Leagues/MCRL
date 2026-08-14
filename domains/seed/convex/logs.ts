import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { logActorTypeValidator, logEventTypeValidator } from "./lib/logValues";
import { requireAdmin } from "./lib/permissions";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    eventType: v.optional(logEventTypeValidator),
    actorType: v.optional(logActorTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const eventType = args.eventType;
    const actorType = args.actorType;

    if (eventType !== undefined && actorType !== undefined) {
      return await ctx.db
        .query("logs")
        .withIndex("by_eventType_and_actorType", (q) =>
          q.eq("eventType", eventType).eq("actorType", actorType)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    if (eventType !== undefined) {
      return await ctx.db
        .query("logs")
        .withIndex("by_eventType", (q) => q.eq("eventType", eventType))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    if (actorType !== undefined) {
      return await ctx.db
        .query("logs")
        .withIndex("by_actorType", (q) => q.eq("actorType", actorType))
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("logs")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
