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
