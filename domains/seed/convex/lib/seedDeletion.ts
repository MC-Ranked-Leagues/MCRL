import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_LEAGUE_SEED_LIST_COUNT } from "./consts";
import { getPrimaryActorType, writeLog } from "./logging";
import { compareSeedOrder } from "./seedOrder";
import { requireSettings } from "./settings";

export async function hardDeleteSeed(
  ctx: MutationCtx,
  seed: Doc<"seeds">,
  actor: Doc<"users">,
) {
  if (seed.leagueId === undefined || seed.assignedWeekNumber === undefined) {
    throw new ConvexError({
      code: "SEED_UNASSIGNED",
      message: "Only assigned seeds can be deleted",
    });
  }

  const settings = await requireSettings(ctx);
  const [league, group] = await Promise.all([
    ctx.db.get("leagues", seed.leagueId),
    ctx.db
      .query("seeds")
      .withIndex("by_leagueId_and_assignedWeekNumber_and_seedNumber", (q) =>
        q
          .eq("leagueId", seed.leagueId)
          .eq("assignedWeekNumber", seed.assignedWeekNumber),
      )
      .take(MAX_LEAGUE_SEED_LIST_COUNT + 1),
  ]);

  if (group.length > MAX_LEAGUE_SEED_LIST_COUNT) {
    throw new ConvexError({
      code: "TOO_MANY_SEEDS",
      message: "Too many seeds to manage in one league and week",
    });
  }

  const remaining = group
    .filter((item) => item._id !== seed._id)
    .sort(compareSeedOrder);
  for (const [index, item] of remaining.entries()) {
    const seedNumber = index + 1;
    if (item.seedNumber !== seedNumber) {
      await ctx.db.patch("seeds", item._id, { seedNumber });
    }
  }

  let deletedCommentCount = 0;
  for await (const comment of ctx.db
    .query("comments")
    .withIndex("by_seedId_and_createdAt", (q) => q.eq("seedId", seed._id))) {
    await ctx.db.delete("comments", comment._id);
    deletedCommentCount += 1;
  }

  await ctx.db.delete("seeds", seed._id);

  if (
    league &&
    seed.assignedWeekNumber === settings.currentWeekNumber &&
    seed.isExpired === false
  ) {
    await ctx.db.patch("leagues", league._id, {
      seedCount: Math.max(0, league.seedCount - 1),
      usedSeedCount: Math.max(0, league.usedSeedCount - (seed.isUsed ? 1 : 0)),
    });
  }

  await writeLog(ctx, {
    eventType: "seed.deleted",
    actor,
    actorType: getPrimaryActorType(actor),
    targetType: "seed",
    targetId: seed._id,
    targetLabel: `Seed ${seed.overworld}`,
    summary: `Deleted seed #${seed.seedNumber ?? "unknown"} from ${league?.leagueName ?? "its deleted league"} week ${seed.assignedWeekNumber}${deletedCommentCount > 0 ? ` with ${deletedCommentCount} ${deletedCommentCount === 1 ? "comment" : "comments"}` : ""}.`,
  });
}
