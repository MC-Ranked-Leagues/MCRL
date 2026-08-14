import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  canViewLeague,
  requireActiveUser,
  requireAdmin,
} from "./lib/permissions";
import { writeLog } from "./lib/logging";

const MIN_LEAGUE_NAME_LENGTH = 3;
const MAX_LEAGUE_NAME_LENGTH = 20;

function validateLeagueFields({
  leagueNumber,
  leagueName,
}: {
  leagueNumber: number;
  leagueName: string;
}) {
  if (!Number.isSafeInteger(leagueNumber) || leagueNumber < 1) {
    throw new ConvexError({
      code: "INVALID_LEAGUE_NUMBER",
      message: "League number must be a positive whole number",
    });
  }

  const trimmedLeagueName = leagueName.trim();

  if (
    trimmedLeagueName.length < MIN_LEAGUE_NAME_LENGTH ||
    trimmedLeagueName.length > MAX_LEAGUE_NAME_LENGTH
  ) {
    throw new ConvexError({
      code: "INVALID_LEAGUE_NAME",
      message: "League name must be between 3 and 20 characters",
    });
  }

  return trimmedLeagueName;
}

export const listLeagues = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);

    const leagues = await ctx.db
      .query("leagues")
      .withIndex("by_leagueNumber")
      .order("asc")
      .collect();

    return leagues.filter((l) => canViewLeague(user, l));
  },
});

export const listSeedUploadLeagueOptions = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    const isAdmin = user.roles.includes("admin");
    const isUploader = user.roles.includes("uploader");
    const isHost = user.roles.includes("host");

    if (!isAdmin && !isUploader && !isHost) {
      return [];
    }

    const leagues = await ctx.db
      .query("leagues")
      .withIndex("by_leagueNumber")
      .order("asc")
      .collect();
    const uploaderLeagues = user.uploaderLeagues ?? [];
    const hostLeagueIds = user.hostLeagueId ?? [];

    return leagues.map((league) => {
      const isUploaderLeague = uploaderLeagues.includes(league._id);
      const isHostedLeague = hostLeagueIds.includes(league._id);
      const canUpload =
        isAdmin ||
        (isUploader && isUploaderLeague) ||
        (isHost && isHostedLeague);

      return {
        ...league,
        seedUploadDisabled: !canUpload,
        seedUploadDisabledReason: canUpload
          ? undefined
          : isUploader && !isUploaderLeague
            ? "Uploaders cannot place seeds into leagues they don't upload for."
            : isHost && !isHostedLeague
              ? "You can only upload seeds for leagues you host."
              : "You do not have permission to upload seeds for this league.",
      };
    });
  },
});

export const addLeague = mutation({
  args: {
    leagueNumber: v.number(),
    leagueName: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const leagueName = validateLeagueFields(args);

    const existingLeague = await ctx.db
      .query("leagues")
      .withIndex("by_leagueNumber", (q) =>
        q.eq("leagueNumber", args.leagueNumber)
      )
      .unique();

    if (existingLeague) {
      throw new ConvexError({
        code: "DUPLICATE_LEAGUE_NUMBER",
        message: "A league with this number already exists",
      });
    }

    const leagueId = await ctx.db.insert("leagues", {
      seedCount: 0,
      usedSeedCount: 0,
      leagueNumber: args.leagueNumber,
      leagueName,
    });

    await writeLog(ctx, {
      eventType: "league.created",
      actor: admin,
      actorType: "admin",
      targetType: "league",
      targetId: leagueId,
      targetLabel: leagueName,
      summary: `Created ${leagueName} as league ${args.leagueNumber}.`,
    });

    return leagueId;
  },
});

export const deleteLeague = mutation({
  args: {
    leagueId: v.id("leagues"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const league = await ctx.db.get("leagues", args.leagueId);

    if (!league) {
      throw new ConvexError({
        code: "LEAGUE_NOT_EXIST",
        message: "The requested league id does not exist",
      });
    }

    const connectedSeed = await ctx.db
      .query("seeds")
      .withIndex("by_leagueId", (q) => q.eq("leagueId", league._id))
      .first();

    if (connectedSeed) {
      throw new ConvexError({
        code: "LEAGUE_HAS_SEEDS",
        message: "Move or delete connected seeds before deleting this league",
      });
    }

    await ctx.db.delete("leagues", league._id);

    await writeLog(ctx, {
      eventType: "league.deleted",
      actor: admin,
      actorType: "admin",
      targetType: "league",
      targetId: league._id,
      targetLabel: league.leagueName,
      summary: `Deleted ${league.leagueName} (league ${league.leagueNumber}).`,
    });
  },
});
