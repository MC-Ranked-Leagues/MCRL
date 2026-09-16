export function calculateMatchPoints(
  playerCount: number,
  placement: number
): number {
  const topHalf = Math.floor(playerCount / 2);
  // Only top-half finishers receive podium bonuses. Every other finisher earns one point.
  if (placement > topHalf) return 1;

  const podiumBonus = [5, 3, 1][placement - 1] ?? 0;
  return topHalf - placement + 1 + podiumBonus;
}
