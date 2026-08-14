type TimedResult = {
  timeMs: number | null;
  dnf: boolean;
};

export function getCompletedTimeMs(result: TimedResult): number | null {
  if (
    result.dnf ||
    result.timeMs === null ||
    !Number.isFinite(result.timeMs) ||
    result.timeMs <= 0
  ) {
    return null;
  }

  return result.timeMs;
}

export function getImprovedFastestTimeMs(
  currentFastestTimeMs: number | undefined,
  result: TimedResult
): number | undefined {
  const completedTimeMs = getCompletedTimeMs(result);
  if (completedTimeMs === null) return undefined;

  return currentFastestTimeMs === undefined ||
    completedTimeMs < currentFastestTimeMs
    ? completedTimeMs
    : undefined;
}
