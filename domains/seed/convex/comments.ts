import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  MAX_SEED_COMMENT_BODY_LENGTH,
  MAX_SEED_COMMENT_LIST_COUNT,
} from "./lib/consts";
import { writeLog } from "./lib/logging";
import { getAccessibleSeed, requireActiveUser } from "./lib/permissions";

export const listForSeed = query({
  args: {
    seedId: v.id("seeds"),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const seedAccess = await getAccessibleSeed(ctx, user, args.seedId);

    if (!seedAccess) {
      return [];
    }

    const newestComments = await ctx.db
      .query("comments")
      .withIndex("by_seedId_and_createdAt", (q) => q.eq("seedId", args.seedId))
      .order("desc")
      .take(MAX_SEED_COMMENT_LIST_COUNT);
    const comments = [...newestComments].reverse();

    const authorIds = Array.from(
      new Set(comments.map((comment) => comment.author))
    );
    const authors = await Promise.all(
      authorIds.map((authorId) => ctx.db.get("users", authorId))
    );
    const authorsById = new Map(
      authorIds.map((authorId, index) => [authorId, authors[index]])
    );

    return comments.map((comment) => {
      const author = authorsById.get(comment.author);

      return {
        ...comment,
        authorName: getCommentAuthorName(author),
        authorUsername: author?.lowercaseName ?? null,
        authorImage: author?.image ?? null,
      };
    });
  },
});

export const create = mutation({
  args: {
    seedId: v.id("seeds"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);

    if (!user.roles.includes("uploader") && !user.roles.includes("host")) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Uploader or host access is required to comment",
      });
    }

    const seedAccess = await getAccessibleSeed(ctx, user, args.seedId);

    if (!seedAccess) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You cannot comment on this seed",
      });
    }

    if (seedAccess.seed.isExpired === true) {
      throw new ConvexError({
        code: "SEED_EXPIRED",
        message: "Expired seeds are read-only",
      });
    }

    const body = validateCommentBody(args.body);

    const commentId = await ctx.db.insert("comments", {
      seedId: seedAccess.seed._id,
      author: user._id,
      body,
      createdAt: Date.now(),
    });

    await ctx.db.patch("seeds", seedAccess.seed._id, {
      commentCount: seedAccess.seed.commentCount + 1,
    });

    await writeLog(ctx, {
      eventType: "comment.created",
      actor: user,
      targetType: "comment",
      targetId: commentId,
      targetLabel: `Comment on seed ${seedAccess.seed.overworld}`,
      summary: seedAccess.league
        ? `Posted a comment on the seed in ${seedAccess.league.leagueName}.`
        : "Posted a comment on an unassigned seed.",
    });
  },
});

function validateCommentBody(body: string) {
  const trimmedBody = body.trim();

  if (trimmedBody.length === 0) {
    throw new ConvexError({
      code: "COMMENT_BODY_REQUIRED",
      message: "Enter a comment before posting",
    });
  }

  if (trimmedBody.length > MAX_SEED_COMMENT_BODY_LENGTH) {
    throw new ConvexError({
      code: "COMMENT_BODY_TOO_LONG",
      message: `Comments must be ${MAX_SEED_COMMENT_BODY_LENGTH} characters or fewer`,
    });
  }

  return trimmedBody;
}

export function getCommentAuthorName(
  author:
    | {
        name?: string;
        lowercaseName?: string;
      }
    | null
    | undefined
) {
  return author?.name ?? author?.lowercaseName ?? "Unknown user";
}
