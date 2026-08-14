import { describe, expect, test } from "vitest"
import { compareWeekStandingRegistrations } from "../convex/lib/weekStandings"

describe("weekly standings ordering", () => {
  test("orders by points and uses average time as the tiebreaker", () => {
    const registrations = [
      { playerIgn: "LowerPoints", totalPoints: 8, averageTimeMs: 50_000 },
      { playerIgn: "SlowerTie", totalPoints: 10, averageTimeMs: 82_000 },
      { playerIgn: "FasterTie", totalPoints: 10, averageTimeMs: 61_000 },
    ]

    expect(registrations.sort(compareWeekStandingRegistrations)).toEqual([
      { playerIgn: "FasterTie", totalPoints: 10, averageTimeMs: 61_000 },
      { playerIgn: "SlowerTie", totalPoints: 10, averageTimeMs: 82_000 },
      { playerIgn: "LowerPoints", totalPoints: 8, averageTimeMs: 50_000 },
    ])
  })

  test("puts registrations without results last and orders them by name", () => {
    const registrations = [
      { playerIgn: "Zed", totalPoints: 20, averageTimeMs: null },
      { playerIgn: "Ranked", totalPoints: 1, averageTimeMs: 75_000 },
      { playerIgn: "Alex", totalPoints: 20, averageTimeMs: null },
    ]

    expect(registrations.sort(compareWeekStandingRegistrations)).toEqual([
      { playerIgn: "Ranked", totalPoints: 1, averageTimeMs: 75_000 },
      { playerIgn: "Alex", totalPoints: 20, averageTimeMs: null },
      { playerIgn: "Zed", totalPoints: 20, averageTimeMs: null },
    ])
  })
})
