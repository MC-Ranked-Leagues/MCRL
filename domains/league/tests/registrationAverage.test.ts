import { describe, expect, test } from "vitest";
import { calculateRegistrationAverageTimeMs } from "../convex/lib/registrationAverage";

describe("registration average", () => {
  test("keeps players with no played results unranked", () => {
    expect(calculateRegistrationAverageTimeMs([], 120_000)).toBeNull();
    expect(
      calculateRegistrationAverageTimeMs(
        [
          { missed: true, dnf: false, timeMs: null },
          { missed: true, dnf: false, timeMs: null },
        ],
        120_000
      )
    ).toBeNull();
  });

  test("counts misses and DNFs at the competition time limit", () => {
    expect(
      calculateRegistrationAverageTimeMs(
        [
          { missed: true, dnf: false, timeMs: null },
          { missed: false, dnf: true, timeMs: 90_000 },
          { missed: false, dnf: false, timeMs: 60_000 },
        ],
        120_000
      )
    ).toBe(100_000);
  });
});
