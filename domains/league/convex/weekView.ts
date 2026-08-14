import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { compareWeekStandingRegistrations } from "./lib/weekStandings";

async function getCompetitionByWeekAndLeague(
  ctx: QueryCtx,
  weekNumber: number,
  leagueTier: number
) {
  return await ctx.db
    .query("competitions")
    .withIndex("by_league_and_week", (q) =>
      q.eq("leagueTier", leagueTier).eq("weekNumber", weekNumber)
    )
    .unique();
}

export const getAllWeeks = query({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("weeks").collect())
      .map((week) => ({
        weekNumber: week.weekNumber,
        isActive: week.activeCompetitionCount > 0,
      }))
      .sort((a, b) => b.weekNumber - a.weekNumber),
});

export const getWeekMatches = query({
  args: {
    weekNumber: v.number(),
    leagueTier: v.number(),
  },
  handler: async (ctx, args) => {
    const competition = await getCompetitionByWeekAndLeague(
      ctx,
      args.weekNumber,
      args.leagueTier
    );
    if (!competition) return [];

    const matches = await ctx.db
      .query("matches")
      .withIndex("by_competition_match", (q) =>
        q.eq("competitionId", competition._id)
      )
      .collect();

    return matches
      .map((match) => ({
        _id: match._id,
        matchNumber: match.matchNumber,
        rankedMatchId: match.rankedMatchId ?? null,
        winnerName: match.winnerName ?? "Unknown",
      }))
      .sort((a, b) => a.matchNumber - b.matchNumber);
  },
});

export const getWeekStandings = query({
  args: {
    weekNumber: v.number(),
    leagueTier: v.number(),
  },
  handler: async (ctx, args) => {
    const competition = await getCompetitionByWeekAndLeague(
      ctx,
      args.weekNumber,
      args.leagueTier
    );
    if (!competition) return [];

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_competition", (q) =>
        q.eq("competitionId", competition._id)
      )
      .collect();

    registrations.sort(compareWeekStandingRegistrations);

    return registrations.map((registration, index) => ({
      rank: registration.averageTimeMs === null ? null : index + 1,
      playerId: registration.playerId,
      name: registration.playerIgn,
      totalPoints: registration.totalPoints,
      movement: registration.movementStatus ?? null,
    }));
  },
});

export const getPlayerWeekPlacements = query({
  args: {
    weekNumber: v.number(),
    leagueTier: v.number(),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const competition = await getCompetitionByWeekAndLeague(
      ctx,
      args.weekNumber,
      args.leagueTier
    );
    if (!competition) return [];

    return (
      await ctx.db
        .query("matchResults")
        .withIndex("by_player_and_competition", (q) =>
          q.eq("playerId", args.playerId).eq("competitionId", competition._id)
        )
        .collect()
    )
      .map((result) => ({
        matchId: result.matchId,
        matchNumber: result.matchNumber,
        placement: result.placement,
        pointsWon: result.pointsWon,
        timeMs: result.timeMs,
        dnf: result.dnf,
        missed: result.missed === true,
      }))
      .sort((a, b) => a.matchNumber - b.matchNumber);
  },
});
