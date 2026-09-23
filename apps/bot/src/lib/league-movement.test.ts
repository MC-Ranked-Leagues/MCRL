import { expect, test } from "bun:test";
import {
  calculateLeagueMovement,
  calculateLeague7Qualification,
  type MovementParticipant,
} from "./league-movement";
import { averagePercentage, formatHistoryAverage } from "./player-history";

function participants(
  count: number
): (MovementParticipant & {
  averageTimeMs: number;
  bestFinishTimeMs: number | null;
})[] {
  return Array.from({ length: count }, (_, index) => ({
    registrationId: index + 1,
    points: count - index,
    averageTimeMs: 35 * 60_000,
    bestFinishTimeMs: 35 * 60_000,
    history: [],
  }));
}

test("positive scoring ranks set percentages; played zero-point players count toward quotas", () => {
  const field = participants(10);
  for (const player of field.slice(5)) player.points = 0;
  const result = calculateLeagueMovement(5, field);
  expect(result.map((player) => player.percentage)).toEqual([
    100, 80, 60, 40, 20, 0, 0, 0, 0, 0,
  ]);
  expect(result.filter((player) => player.movement === "promote")).toHaveLength(
    2
  );
  expect(
    result
      .filter((player) => player.movement === "demote")
      .map((player) => player.registrationId)
  ).toEqual([6, 7, 8, 9, 10]);
});

test("winner occupies a promotion slot even with the lowest rolling average", () => {
  const field = participants(10);
  for (const player of field) {
    player.history = [1, 2].map((week) => ({
      week,
      league: 5,
      percentage: player.registrationId === 1 ? 0 : 100,
    }));
  }
  const result = calculateLeagueMovement(5, field);
  expect(result[0]!.averageUsed).toBeCloseTo(100 / 3);
  expect(
    result
      .filter((player) => player.movement === "promote")
      .map((player) => player.registrationId)
  ).toEqual([1, 2]);
  expect(
    result
      .filter((player) => player.movement === "demote")
      .map((player) => player.registrationId)
  ).toEqual([9, 10]);
});

test("short histories use only available entries and old weeks do not expire", () => {
  const field = participants(5);
  field[1]!.history = [{ week: 1, league: 5, percentage: 20 }];
  field[2]!.history = [100, 10, 85].map((percentage, index) => ({
    week: index + 1,
    league: 4,
    percentage,
  }));
  const result = calculateLeagueMovement(5, field);
  expect(result[0]!.averageUsed).toBe(100);
  expect(result[1]!.averageUsed).toBe(50);
  expect(result[2]!.averageUsed).toBe((60 + 10 + 85) / 3);
});

test("movement ties use weekly placement and decisions keep full precision", () => {
  const field = participants(10);
  // Both players average 90. Better weekly placement gets the second promotion.
  field[1]!.history = [{ week: 1, league: 5, percentage: 90 }];
  field[2]!.history = [{ week: 1, league: 5, percentage: 100 }];
  let result = calculateLeagueMovement(5, field);
  expect(result[1]!.averageUsed).toBe(result[2]!.averageUsed);
  expect(result[1]!.movement).toBe("promote");
  field[1]!.history = [{ week: 1, league: 5, percentage: 89.99999 }];
  result = calculateLeagueMovement(5, field);
  expect(result[1]!.averageUsed.toFixed(2)).toBe(
    result[2]!.averageUsed.toFixed(2)
  );
  expect(result[2]!.movement).toBe("promote");
});

test("league limits, empty fields, all-zero fields and rounded-zero quotas are safe", () => {
  expect(calculateLeagueMovement(5, [])).toEqual([]);
  expect(
    calculateLeagueMovement(5, participants(3)).every(
      (player) => player.movement === "none"
    )
  ).toBe(true);
  expect(
    calculateLeagueMovement(1, participants(10)).some(
      (player) => player.movement === "promote"
    )
  ).toBe(false);
  expect(
    calculateLeagueMovement(6, participants(10)).some(
      (player) => player.movement === "demote"
    )
  ).toBe(false);
  const result = calculateLeagueMovement(
    5,
    participants(8).map((player) => ({ ...player, points: 0 }))
  );
  expect(result.every((player) => player.percentage === 0)).toBe(true);
  expect(result[0]!.movement).toBe("promote");
  expect(result.slice(1).every((player) => player.movement === "demote")).toBe(
    true
  );
});

test("League 7 qualifies independently of quotas and history with strict time thresholds", () => {
  const field = participants(5);
  field[0]!.bestFinishTimeMs = 25 * 60_000 - 1;
  field[1]!.bestFinishTimeMs = 25 * 60_000;
  field[2]!.averageTimeMs = 30 * 60_000 - 1;
  field[3]!.averageTimeMs = 30 * 60_000;
  field[4]!.bestFinishTimeMs = null;
  expect(
    calculateLeague7Qualification(field).every(
      (player) => player.averageUsed === null
    )
  ).toBe(true);
  expect(
    calculateLeague7Qualification(field).map((player) => player.movement)
  ).toEqual(["promote", "none", "promote", "none", "none"]);
});

test("saved history averages distinguish no history from zero and report the actual entry count", () => {
  const history = [0, 60, 90].map((percentage, index) => ({
    week: index + 1,
    league: 5,
    percentage,
  }));
  expect(
    averagePercentage(
      history.map((entry) => entry.percentage),
      2
    )
  ).toBe(75);
  expect(
    averagePercentage(
      history.map((entry) => entry.percentage),
      3
    )
  ).toBe(50);
  expect(formatHistoryAverage([], 2)).toBe("No history");
  expect(formatHistoryAverage(history.slice(0, 1), 3)).toBe("0.00% (1 entry)");
  expect(formatHistoryAverage(history, 2)).toBe("75.00% (2 entries)");
});

test("zero averages fill demotion slots first while prior history can protect a zero-point week", () => {
  const field = participants(10);
  field[9]!.points = 0;
  let result = calculateLeagueMovement(5, field);
  expect(
    result
      .filter((player) => player.movement === "demote")
      .map((player) => player.registrationId)
  ).toEqual([9, 10]);
  for (const player of field.slice(5)) player.points = 0;
  field[9]!.history = [{ week: 1, league: 5, percentage: 85 }];
  result = calculateLeagueMovement(5, field);
  expect(
    result
      .filter((player) => player.movement === "demote")
      .map((player) => player.registrationId)
  ).toEqual([6, 7, 8, 9]);
  expect(result[9]!.movement).toBe("none");
  expect(
    calculateLeagueMovement(6, field).some(
      (player) => player.movement === "demote"
    )
  ).toBe(false);
});
