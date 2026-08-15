import { describe, expect, test } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildPlayerUrl,
  formatDuration,
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

  test("merges history, preserves gaps, and sorts weeks and matches", () => {
    const stats: PlayerStats = {
      name: "Runner",
      elo: 1200,
      currentLeague: "League 2",
      currentTier: 2,
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

    expect(weeks.map((week) => week.weekNumber)).toEqual([1, 2]);
    expect(weeks[0].averageTimeMs).toBeNull();
    expect(weeks[1]).toMatchObject({
      leagueNumber: 2,
      movement: "promoted",
    });
    expect(weeks[1].matchDetails.map((match) => match.matchNumber)).toEqual([
      1, 2, 3,
    ]);
  });
});
