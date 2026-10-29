import { describe, expect, test } from "vitest";
import {
  compareWeekStandingRegistrations,
  projectWeekMovement,
} from "./weekStandings";

describe("weekly standings ordering", () => {
  test("orders by points and uses average time as the tiebreaker", () => {
    const registrations = [
      { playerIgn: "LowerPoints", totalPoints: 8, averageTimeMs: 50_000 },
      { playerIgn: "SlowerTie", totalPoints: 10, averageTimeMs: 82_000 },
      { playerIgn: "FasterTie", totalPoints: 10, averageTimeMs: 61_000 },
    ];

    expect(registrations.sort(compareWeekStandingRegistrations)).toEqual([
      { playerIgn: "FasterTie", totalPoints: 10, averageTimeMs: 61_000 },
      { playerIgn: "SlowerTie", totalPoints: 10, averageTimeMs: 82_000 },
      { playerIgn: "LowerPoints", totalPoints: 8, averageTimeMs: 50_000 },
    ]);
  });

  test("puts registrations without results last and orders them by name", () => {
    const registrations = [
      { playerIgn: "Zed", totalPoints: 20, averageTimeMs: null },
      { playerIgn: "Ranked", totalPoints: 1, averageTimeMs: 75_000 },
      { playerIgn: "Alex", totalPoints: 20, averageTimeMs: null },
    ];

    expect(registrations.sort(compareWeekStandingRegistrations)).toEqual([
      { playerIgn: "Ranked", totalPoints: 1, averageTimeMs: 75_000 },
      { playerIgn: "Alex", totalPoints: 20, averageTimeMs: null },
      { playerIgn: "Zed", totalPoints: 20, averageTimeMs: null },
    ]);
  });
});

describe("projected weekly movement", () => {
  // Seven players give a quota of one, so only the winner promotes.
  const field = (histories: number[][]) =>
    histories.map((history, index) => ({
      totalPoints: index === histories.length - 1 ? 0 : 10 - index,
      history,
    }));

  test("promotes the weekly winner even with a lower average", () => {
    const projections = projectWeekMovement(
      3,
      field([[0, 0], [100, 100], [], [], [], [], []])
    );

    expect(projections[0]).toMatchObject({
      currentPercentage: 100,
      averagePercentage: 100 / 3,
      movement: "promoted",
    });
    expect(projections[1]!.movement).toBe("none");
  });

  test("demotes every zero average even past the quota", () => {
    const projections = projectWeekMovement(3, [
      ...field([[], [], [], [], [], []]).slice(0, 5),
      { totalPoints: 0, history: [] },
      { totalPoints: 0, history: [] },
    ]);

    expect(projections.map((projection) => projection.movement)).toEqual([
      "promoted",
      "none",
      "none",
      "none",
      "none",
      "demoted",
      "demoted",
    ]);
  });

  test("skips promotion in league 1 and demotion in league 6", () => {
    const histories = field([[], [], [], [], [], [], []]);

    expect(projectWeekMovement(1, histories)[0]!.movement).toBe("none");
    expect(projectWeekMovement(6, histories).at(-1)!.movement).toBe("none");
  });
});
