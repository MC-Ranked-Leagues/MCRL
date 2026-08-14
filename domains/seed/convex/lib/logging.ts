import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LogActorType, LogEventType, LogTargetType } from "./logValues";

type LogActor =
  | {
      actor: Doc<"users">;
      actorType?: Exclude<LogActorType, "system">;
      actorName?: never;
    }
  | {
      actor?: never;
      actorType: "system";
      actorName: string;
    };

type WriteLogArgs = LogActor & {
  eventType: LogEventType;
  targetType: LogTargetType;
  targetId?: string;
  targetLabel: string;
  summary: string;
};

export async function writeLog(ctx: MutationCtx, args: WriteLogArgs) {
  const actorType =
    args.actorType ?? (args.actor ? getPrimaryActorType(args.actor) : "system");

  return await ctx.db.insert("logs", {
    eventType: args.eventType,
    actorId: args.actor?._id,
    actorName: args.actor
      ? getUserDisplayName(args.actor)
      : (args.actorName ?? "System"),
    actorDiscordId: args.actor?.discordId,
    actorImage: args.actor?.image,
    actorRoles: args.actor?.roles ?? [],
    actorType,
    targetType: args.targetType,
    targetId: args.targetId,
    targetLabel: args.targetLabel,
    summary: args.summary,
  });
}

export function getPrimaryActorType(
  user: Doc<"users">
): Exclude<LogActorType, "system"> {
  if (user.roles.includes("admin")) return "admin";
  if (user.roles.includes("host")) return "host";
  if (user.roles.includes("uploader")) return "uploader";
  return "user";
}

export function getUserDisplayName(user: Doc<"users">) {
  return (
    user.name ??
    (user.discordId ? `Discord user ${user.discordId}` : `User ${user._id}`)
  );
}
