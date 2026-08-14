import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCompletedTimeMs } from "./lib/playerFastestTime";

export const getPlayerStats = query({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
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
