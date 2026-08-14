import { type Infer, v } from "convex/values";

export const logEventTypeValidator = v.union(
  v.literal("seed.uploaded"),
  v.literal("seed.marked_bad"),
  v.literal("seed.marked_used"),
  v.literal("seed.league_changed"),
  v.literal("seed.reordered"),
  v.literal("seed.updated"),
  v.literal("seed.deleted"),
  v.literal("comment.created"),
  v.literal("user.signed_up"),
  v.literal("user.activated"),
  v.literal("user.deactivated"),
  v.literal("user.access_updated"),
  v.literal("user.settings_updated"),
  v.literal("league.created"),
  v.literal("league.updated"),
  v.literal("league.deleted"),
  v.literal("testing.paused"),
  v.literal("testing.resumed"),
  v.literal("week.advanced")
);

export const logActorTypeValidator = v.union(
  v.literal("admin"),
  v.literal("host"),
  v.literal("uploader"),
  v.literal("user"),
  v.literal("system")
);

export const logTargetTypeValidator = v.union(
  v.literal("seed"),
  v.literal("comment"),
  v.literal("user"),
  v.literal("league"),
  v.literal("settings")
);

export type LogEventType = Infer<typeof logEventTypeValidator>;
export type LogActorType = Infer<typeof logActorTypeValidator>;
export type LogTargetType = Infer<typeof logTargetTypeValidator>;
