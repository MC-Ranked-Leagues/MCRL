import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx } from "../_generated/server";
import { calculateRegistrationAverageTimeMs } from "../lib/registrationAverage";
import { getImprovedFastestTimeMs } from "../lib/playerFastestTime";

export type CompetitionDoc = Doc<"competitions">;

export type RegistrationDoc = Doc<"registrations">;

export function requireWriterKey(writerKey: string): void {
  if (!process.env.WRITER_API_KEY) {
    throwWriteError(500, "Server misconfiguration.");
  }
  if (writerKey !== process.env.WRITER_API_KEY) {
    throwWriteError(401, "Unauthorized");
  }
}

export function requirePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throwWriteError(400, `${name} must be a positive integer.`);
  }
}

export function requireNonnegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throwWriteError(400, `${name} must be a nonnegative integer.`);
  }
}

export function requireFiniteNumber(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throwWriteError(400, `${name} must be finite.`);
  }
}

export function requireNonemptyString(value: string, name: string): void {
  if (!value.trim()) {
    throwWriteError(400, `${name} must not be empty.`);
  }
}

export function requireCompetitionKeys(
  leagueTier: number,
  weekNumber: number
): void {
  requirePositiveInteger(leagueTier, "leagueTier");
  requirePositiveInteger(weekNumber, "weekNumber");
}

export function requirePercentageHistory(
  history: Array<{ week: number; league: number; percentage: number }>
): void {
  if (history.length > 3)
    throwWriteError(400, "percentageHistory exceeds three entries.");
  for (const entry of history) {
    requirePositiveInteger(entry.week, "percentageHistory.week");
    requirePositiveInteger(entry.league, "percentageHistory.league");
    requireFiniteNumber(entry.percentage, "percentageHistory.percentage");
  }
}

export function throwWriteError(status: number, error: string): never {
  console.error(`[Write API] ${status} ${error}`);
  throw new ConvexError({ status, error });
}

export async function getCompetition(
  ctx: MutationCtx,
  leagueTier: number,
  weekNumber: number
): Promise<CompetitionDoc | null> {
  return await ctx.db
    .query("competitions")
    .withIndex("by_league_and_week", (q) =>
      q.eq("leagueTier", leagueTier).eq("weekNumber", weekNumber)
    )
    .unique();
}

export function ensureCompetitionWritable(competition: CompetitionDoc): void {
  if (competition.status === "ended") {
    throwWriteError(403, "Competition already finalized.");
  }
}

export async function getRegistration(
  ctx: MutationCtx,
  competitionId: Id<"competitions">,
  playerId: Id<"players">
): Promise<RegistrationDoc | null> {
  return await ctx.db
    .query("registrations")
    .withIndex("by_comp_and_player", (q) =>
      q.eq("competitionId", competitionId).eq("playerId", playerId)
    )
    .unique();
}

export async function recalculateRegistrationAverageTime(
  ctx: MutationCtx,
  competition: CompetitionDoc,
  playerId: Id<"players">
) {
  const registration = await getRegistration(ctx, competition._id, playerId);
  if (!registration) return;

  const results = await ctx.db
    .query("matchResults")
    .withIndex("by_player_and_competition", (q) =>
      q.eq("playerId", playerId).eq("competitionId", competition._id)
    )
    .collect();

  await ctx.db.patch("registrations", registration._id, {
    averageTimeMs: calculateRegistrationAverageTimeMs(
      results,
      competition.maxTimeLimitMs
    ),
  });
}

export async function recalculatePlayerFastestTime(
  ctx: MutationCtx,
  playerId: Id<"players">
) {
  const results = await ctx.db
    .query("matchResults")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .collect();
  let fastestTimeMs: number | undefined;
  for (const result of results) {
    fastestTimeMs =
      getImprovedFastestTimeMs(fastestTimeMs, result) ?? fastestTimeMs;
  }
  await ctx.db.patch("players", playerId, { fastestTimeMs });
}

export const percentageHistoryValidator = v.array(
  v.object({
    week: v.number(),
    league: v.number(),
    percentage: v.number(),
  })
);
