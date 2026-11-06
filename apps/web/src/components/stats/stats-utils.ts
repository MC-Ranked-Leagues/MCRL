import type { FunctionReturnType } from "convex/server";
import type { api } from "@mcrl/backend/api";

export type PlayerListEntry = FunctionReturnType<
  typeof api.leaderboard.getFastestPlayers
>[number];
export type PlayerStats = NonNullable<
  FunctionReturnType<typeof api.playerStats.getPlayerStats>
>;
// One player's run in a league match.
export type Run =
  PlayerStats["weeklyBreakdown"][number]["matchDetails"][number];
type Movement = PlayerStats["leagueHistory"][number]["movement"];

export interface WeeklyPerformance {
  weekNumber: number;
  leagueNumber: number;
  movement: Movement;
  matches: number;
  totalPoints: number;
  averageTimeMs: number | null;
  currentPercentage: number | null;
  averagePercentage: number | null;
  matchDetails: Run[];
}

export function getCurrentPercentageAverage(
  history: PlayerStats["percentageHistory"]
): number | null {
  const recent = history.slice(-2);
  return recent.length
    ? recent.reduce((sum, entry) => sum + entry.percentage, 0) / recent.length
    : null;
}

export function buildPlayerUrl(
  currentHref: string,
  playerName: string
): string {
  const url = new URL(currentHref);
  url.searchParams.delete("league");
  url.searchParams.set("player", playerName);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function mergeWeeklyPerformance(
  stats: PlayerStats
): WeeklyPerformance[] {
  const historyByWeek = new Map(
    stats.leagueHistory.map((entry) => [entry.weekNumber, entry])
  );

  return stats.weeklyBreakdown
    .map((week) => {
      const history = historyByWeek.get(week.weekNumber);

      return {
        weekNumber: week.weekNumber,
        leagueNumber: history?.leagueNumber ?? week.leagueNumber,
        movement: history?.movement ?? "none",
        matches: week.matches,
        totalPoints: week.totalPoints,
        averageTimeMs:
          week.averageTimeMs !== null && week.averageTimeMs > 0
            ? Math.round(week.averageTimeMs)
            : null,
        currentPercentage: week.currentPercentage,
        averagePercentage: week.averagePercentage,
        matchDetails: [...week.matchDetails].sort(
          (a, b) => a.matchNumber - b.matchNumber
        ),
      };
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);
}
