export interface RetainedPercentage {
  week: number;
  league: number;
  percentage: number;
}

export function averagePercentage(
  percentages: readonly number[],
  count: number
): number | null {
  const entries = percentages.slice(-count);
  if (!entries.length) return null;
  return (
    entries.reduce((sum, percentage) => sum + percentage, 0) / entries.length
  );
}

export function formatHistoryAverage(
  history: readonly RetainedPercentage[],
  count: number
): string {
  const average = averagePercentage(
    history.map((entry) => entry.percentage),
    count
  );
  const entries = Math.min(history.length, count);
  return average === null
    ? "No history"
    : `${average.toFixed(2)}% (${entries} ${entries === 1 ? "entry" : "entries"})`;
}

export function formatPercentage(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}
