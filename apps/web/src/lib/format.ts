// Run times read m:ss.hh. Without hundredths they round to the nearest second.
export function formatRunTime(
  ms: number | null,
  { hundredths = true }: { hundredths?: boolean } = {}
) {
  if (ms === null) return "—";
  if (!hundredths) {
    const seconds = Math.round(ms / 1000);
    return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
  }
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}.${pad(Math.floor((ms % 1000) / 10))}`;
}

// A fixed two decimals keeps right-aligned columns even.
export function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}%`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
