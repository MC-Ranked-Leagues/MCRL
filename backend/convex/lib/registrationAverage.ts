import type { Doc } from "../_generated/dataModel";

type MatchResultForAverage = Pick<
  Doc<"matchResults">,
  "dnf" | "missed" | "timeMs"
>;

/**
 * Computes a registration's average over its imported match outcomes.
 * Misses, DNFs, and legacy results without a time are treated as the cap.
 * A player with only missed outcomes remains unranked.
 */
export function calculateRegistrationAverageTimeMs(
  results: MatchResultForAverage[],
  maxTimeLimitMs: number
): number | null {
  if (
    results.length === 0 ||
    results.every((result) => result.missed === true)
  ) {
    return null;
  }

  const totalTimeMs = results.reduce(
    (total, result) =>
      total +
      (result.missed === true || result.dnf || result.timeMs === null
        ? maxTimeLimitMs
        : result.timeMs),
    0
  );

  return totalTimeMs / results.length;
}
