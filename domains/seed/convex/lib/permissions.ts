import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }

  return await ctx.db.get("users", userId);
}

export function canViewLeague(
  user: Doc<"users">,
  league: Doc<"leagues"> | undefined,
) {
  const leagueId = league?._id;

  if (user.roles.includes("admin")) {
    return true;
  }

  if (leagueId === undefined) {
    return false;
  }

  const uploaderLeagues = user.uploaderLeagues ?? [];
  const hostLeagueIds = user.hostLeagueId ?? [];

  const hasUploaderAccess =
    user.roles.includes("uploader") && uploaderLeagues.includes(leagueId);

  const hasHostAccess =
    user.roles.includes("host") && hostLeagueIds.includes(leagueId);

  return hasUploaderAccess || hasHostAccess;
}

export async function getAccessibleSeed(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  seedId: Id<"seeds">,
) {
  const seed = await ctx.db.get("seeds", seedId);

  if (!seed) {
    return null;
  }

  if (seed.isExpired === true && !user.roles.includes("admin")) {
    return null;
  }

  const league =
    seed.leagueId === undefined
      ? null
      : await ctx.db.get("leagues", seed.leagueId);

  if (user.roles.includes("admin")) {
    return { seed, league };
  }

  if (league && canViewLeague(user, league)) {
    return { seed, league };
  }

  return null;
}

export async function requireActiveUser(ctx: QueryCtx | MutationCtx) {
  const user = await getUser(ctx);
  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Sign in required",
    });
  }

  if (user.status !== "active") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this data",
    });
  }

  return user;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireActiveUser(ctx);

  if (!user.roles.includes("admin")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return user;
}
