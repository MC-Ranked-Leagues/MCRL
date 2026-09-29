import { describe, expect, test } from "vitest";
import type { Id } from "@mcrl/backend/data-model";
import {
  buildPlayerUrl,
  formatDuration,
  formatPercentage,
  getCurrentPercentageAverage,
  mergeWeeklyPerformance,
  type PlayerStats,
} from "./stats-utils";

describe("stats player URL helper", () => {
  test("persists player selection and removes the legacy league filter", () => {
    expect(
      buildPlayerUrl(
        "https://example.com/stats?league=2&source=discord#history",
        "Runner Name"
      )
    ).toBe("/stats?source=discord&player=Runner+Name#history");
  });
});

describe("stats data formatting", () => {
  test("formats durations and uses an em dash for missing values", () => {
    expect(formatDuration(83_456)).toBe("1:23.456");
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(null)).toBe("—");
  });

  test("formats percentages and averages the latest two saved values", () => {
    expect(formatPercentage(null)).toBe("—");
    expect(formatPercentage(0)).toBe("0%");
    expect(formatPercentage(86.6666)).toBe("86.67%");
    expect(getCurrentPercentageAverage([])).toBeNull();
    expect(
      getCurrentPercentageAverage([
        { week: 1, league: 2, percentage: 10 },
        { week: 2, league: 2, percentage: 0 },
        { week: 3, league: 2, percentage: 85 },
      ])
    ).toBe(42.5);
  });

  test("merges history, preserves gaps, and sorts weeks and matches", () => {
    const stats: PlayerStats = {
      name: "Runner",
      elo: 1200,
      currentLeague: "League 2",
      currentTier: 2,
      percentageHistory: [{ week: 2, league: 2, percentage: 85 }],
      summary: { totalMatches: 3, avgTimeMs: 72_000, bestTimeMs: 61_000 },
      leagueHistory: [
        { weekNumber: 2, leagueNumber: 2, movement: "promoted" },
        { weekNumber: 1, leagueNumber: 1, movement: "none" },
      ],
      weeklyBreakdown: [
        {
          weekNumber: 2,
          leagueNumber: 1,
          matches: 3,
          totalPoints: 18,
          averageTimeMs: 70_000,
          currentPercentage: 80,
          averagePercentage: 75,
          matchDetails: [
            {
              matchId: "match-3" as Id<"matches">,
              matchNumber: 3,
              placement: 1,
              pointsWon: 10,
              timeMs: 61_000,
              dnf: false,
              missed: false,
            },
            {
              matchId: "match-1" as Id<"matches">,
              matchNumber: 1,
              placement: null,
              pointsWon: 0,
              timeMs: null,
              dnf: false,
              missed: true,
            },
            {
              matchId: "match-2" as Id<"matches">,
              matchNumber: 2,
              placement: null,
              pointsWon: 0,
              timeMs: 90_000,
              dnf: true,
              missed: false,
            },
          ],
        },
        {
          weekNumber: 1,
          leagueNumber: 1,
          matches: 1,
          totalPoints: 4,
          averageTimeMs: null,
          currentPercentage: 0,
          averagePercentage: null,
          matchDetails: [
            {
              matchId: "match-0" as Id<"matches">,
              matchNumber: 1,
              placement: 4,
              pointsWon: 4,
              timeMs: 80_000,
              dnf: false,
              missed: false,
            },
          ],
        },
      ],
    };

    const weeks = mergeWeeklyPerformance(stats);
    const [weekOne, weekTwo] = weeks;

    if (!weekOne || !weekTwo) {
      throw new Error("Expected performance for weeks one and two");
    }

    expect(weeks.map((week) => week.weekNumber)).toEqual([1, 2]);
    expect(weekOne.averageTimeMs).toBeNull();
    expect(weekOne.currentPercentage).toBe(0);
    expect(weekOne.averagePercentage).toBeNull();
    expect(weekTwo).toMatchObject({
      leagueNumber: 2,
      movement: "promoted",
      currentPercentage: 80,
      averagePercentage: 75,
    });
    expect(weekTwo.matchDetails.map((match) => match.matchNumber)).toEqual([
      1, 2, 3,
    ]);
  });
});
