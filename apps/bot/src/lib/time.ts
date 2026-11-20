export function formatDuration(
  durationMs: number,
  includeMilliseconds = false
): string {
  durationMs = Math.floor(durationMs);
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.floor((durationMs % 60_000) / 1_000);
  const time = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  return includeMilliseconds
    ? `${time}.${(durationMs % 1_000).toString().padStart(3, "0")}`
    : time;
}

// Accepts m:ss or m:ss.mmm, the formats leaderboards display.
export function parseDuration(text: string): number | undefined {
  const match = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(text.trim());
  if (!match) return;
  const [, minutes, seconds, fraction = ""] = match;
  return (
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(fraction.padEnd(3, "0"))
  );
}
