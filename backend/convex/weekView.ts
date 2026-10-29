import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import {
  compareWeekStandingRegistrations,
  projectWeekMovement,
} from "./lib/weekStandings";

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
  returns: v.array(
    v.object({
      rank: v.union(v.number(), v.null()),
      playerId: v.id("players"),
      name: v.string(),
      totalPoints: v.number(),
      movement: v.union(
        v.literal("promoted"),
        v.literal("demoted"),
        v.literal("none"),
        v.null()
      ),
      currentPercentage: v.union(v.number(), v.null()),
      averagePercentage: v.union(v.number(), v.null()),
      // Live weeks show expected values until the bot publishes `/em` results.
      projected: v.boolean(),
    })
  ),
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
    const participants = registrations.filter(
      (registration) => registration.averageTimeMs !== null
    );

    // League 7 moves by time rather than percentages, so it has no projection.
    const projections =
      competition.status === "active" && competition.leagueTier !== 7
        ? projectWeekMovement(
            competition.leagueTier,
            await Promise.all(
              participants.map(async (registration) => ({
                totalPoints: registration.totalPoints,
                history: (
                  (await ctx.db.get("players", registration.playerId))
                    ?.percentageHistory ?? []
                ).map((entry) => entry.percentage),
              }))
            )
          )
        : null;

    // Ranked registrations sort first, so their indexes match `participants`.
    return registrations.map((registration, index) => {
      const projection =
        projections && registration.averageTimeMs !== null
          ? projections[index]!
          : null;
      return {
        rank: registration.averageTimeMs === null ? null : index + 1,
        playerId: registration.playerId,
        name: registration.playerIgn,
        totalPoints: registration.totalPoints,
        movement: projection
          ? projection.movement
          : (registration.movementStatus ?? null),
        currentPercentage: projection
          ? projection.currentPercentage
          : (registration.currentPercentage ?? null),
        averagePercentage: projection
          ? projection.averagePercentage
          : (registration.averagePercentage ?? null),
        projected: projection !== null,
      };
    });
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
