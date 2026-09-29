import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCompletedTimeMs } from "./lib/playerFastestTime";

export const getPlayerStats = query({
  args: {
    playerId: v.id("players"),
  },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      elo: v.number(),
      currentLeague: v.string(),
      currentTier: v.number(),
      percentageHistory: v.array(
        v.object({
          week: v.number(),
          league: v.number(),
          percentage: v.number(),
        })
      ),
      leagueHistory: v.array(
        v.object({
          weekNumber: v.number(),
          leagueNumber: v.number(),
          movement: v.union(
            v.literal("promoted"),
            v.literal("demoted"),
            v.literal("none")
          ),
        })
      ),
      weeklyBreakdown: v.array(
        v.object({
          weekNumber: v.number(),
          leagueNumber: v.number(),
          matches: v.number(),
          totalPoints: v.number(),
          averageTimeMs: v.union(v.number(), v.null()),
          currentPercentage: v.union(v.number(), v.null()),
          averagePercentage: v.union(v.number(), v.null()),
          matchDetails: v.array(
            v.object({
              matchId: v.id("matches"),
              matchNumber: v.number(),
              placement: v.union(v.number(), v.null()),
              pointsWon: v.number(),
              timeMs: v.union(v.number(), v.null()),
              dnf: v.boolean(),
              missed: v.boolean(),
            })
          ),
        })
      ),
      summary: v.object({
        totalMatches: v.number(),
        avgTimeMs: v.number(),
        bestTimeMs: v.number(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const player = await ctx.db.get("players", args.playerId);
    if (!player) return null;

    const [registrations, playerResults] = await Promise.all([
      ctx.db
        .query("registrations")
        .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
        .collect(),
      ctx.db
        .query("matchResults")
        .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
        .collect(),
    ]);

    const resultsByMatchId = new Map(
      playerResults.map((result) => [result.matchId, result])
    );

    const weeklyBreakdown = await Promise.all(
      registrations.map(async (registration) => {
        const matches = await ctx.db
          .query("matches")
          .withIndex("by_competition_match", (q) =>
            q.eq("competitionId", registration.competitionId)
          )
          .collect();

        const matchDetails = matches.flatMap((match) => {
          const result = resultsByMatchId.get(match._id);
          if (!result) return [];

          return [
            {
              matchId: match._id,
              matchNumber: match.matchNumber,
              placement: result.placement,
              pointsWon: result.pointsWon,
              timeMs: result.timeMs,
              dnf: result.dnf,
              missed: result.missed === true,
            },
          ];
        });

        return {
          weekNumber: registration.weekNumber,
          leagueNumber: registration.leagueTier,
          matches: matchDetails.length,
          totalPoints: matchDetails.reduce(
            (total, match) => total + match.pointsWon,
            0
          ),
          averageTimeMs: registration.averageTimeMs,
          currentPercentage: registration.currentPercentage ?? null,
          averagePercentage: registration.averagePercentage ?? null,
          matchDetails,
        };
      })
    );

    const leagueHistory = registrations
      .map((registration) => ({
        weekNumber: registration.weekNumber,
        leagueNumber: registration.leagueTier,
        movement: registration.movementStatus ?? "none",
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber);

    const registrationAverageTimes = registrations
      .map((registration) => registration.averageTimeMs)
      .filter((timeMs): timeMs is number => timeMs !== null);

    const completedTimes = playerResults
      .map(getCompletedTimeMs)
      .filter((timeMs): timeMs is number => timeMs !== null);

    return {
      name: player.ign,
      elo: player.elo ?? 0,
      currentLeague: `League ${player.currentLeagueNumber}`,
      currentTier: player.currentLeagueNumber,
      percentageHistory: player.percentageHistory ?? [],
      leagueHistory,
      weeklyBreakdown: weeklyBreakdown.sort(
        (a, b) => a.weekNumber - b.weekNumber
      ),
      summary: {
        totalMatches: playerResults.filter((result) => result.missed !== true)
          .length,
        avgTimeMs:
          registrationAverageTimes.length > 0
            ? Math.round(
                registrationAverageTimes.reduce(
                  (total, timeMs) => total + timeMs,
                  0
                ) / registrationAverageTimes.length
              )
            : 0,
        bestTimeMs:
          player.fastestTimeMs ??
          (completedTimes.length > 0 ? Math.min(...completedTimes) : 0),
      },
    };
  },
});
