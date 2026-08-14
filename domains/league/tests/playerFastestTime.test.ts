import { describe, expect, test } from "vitest"
import {
  getCompletedTimeMs,
  getImprovedFastestTimeMs,
} from "../convex/lib/playerFastestTime"

describe("player fastest time", () => {
  test("accepts a player's first completed time", () => {
    expect(
      getImprovedFastestTimeMs(undefined, { timeMs: 75_000, dnf: false })
    ).toBe(75_000)
  })

  test("only returns completed times that improve the current best", () => {
    expect(
      getImprovedFastestTimeMs(75_000, { timeMs: 72_000, dnf: false })
    ).toBe(72_000)
    expect(
      getImprovedFastestTimeMs(75_000, { timeMs: 80_000, dnf: false })
    ).toBeUndefined()
  })

  test("ignores DNFs and invalid times", () => {
    expect(getCompletedTimeMs({ timeMs: 70_000, dnf: true })).toBeNull()
    expect(getCompletedTimeMs({ timeMs: null, dnf: false })).toBeNull()
    expect(getCompletedTimeMs({ timeMs: 0, dnf: false })).toBeNull()
  })
})
