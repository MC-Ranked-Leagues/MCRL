// League estimates from Ranked stats. Shared with
// `scripts/generate-league-summary.ts`, which builds the league ranges from
// Ranked stats of current league players and checks the estimate against them,
// so this file can't use `@/` imports.
import type { User } from "mcsrranked-sdk";

export type Stats = {
  elo: number | null;
  average: number | null;
  best: number | null;
};

export type Range = { low: number; median: number; high: number };
export type Stat = keyof Stats;

export type LeagueSummary = {
  league: number;
  players: number;
} & Record<Stat, Range | null>;

const STAT_NAMES: Stat[] = ["elo", "average", "best"];

// A best time is one lucky seed, so it counts for less than Elo or an average.
const STAT_WEIGHTS: Record<Stat, number> = { elo: 1, average: 1, best: 0.4 };

// Past this many spreads from a league's middle, a stat counts against the
// league linearly instead of squared. One far-off stat then can't outweigh the
// others agreeing.
const OUTLIER_GAP = 1.5;

// League 7 has too few players to compare against, so only these limits place
// anyone there.
export const LEAGUE_7 = 7;
const LEAGUE_7_AVERAGE = 30 * 60;
const LEAGUE_7_BEST = 25 * 60;

// A new season starts empty, so older totals fill in until they've played.
// Times are in seconds.
export function rankedStats(user: User) {
  const { season, total } = user.statistics;
  const stats = (season.completions.ranked ?? 0) > 0 ? season : total;
  const completions = stats.completions.ranked ?? 0;
  const completionTime = stats.completionTime.ranked;
  const best = stats.bestTime.ranked;

  return {
    completions,
    elo: user.eloRate ?? user.seasonResult.highest,
    average:
      completions > 0 && completionTime !== null
        ? Math.round(completionTime / completions / 1000)
        : null,
    best: best === null ? null : Math.round(best / 1000),
  };
}

// A 10% time difference matters the same at 8 minutes as at 20.
function toScale(stat: Stat, value: number) {
  return stat === "elo" ? value : Math.log(value);
}

// Lower means a closer fit. Treats each league's middle half as a bell curve, so
// a wide league like 6 forgives more than a narrow one like 2.
function fitScore(entry: LeagueSummary, stats: Stats) {
  let score = 0;
  for (const stat of STAT_NAMES) {
    const value = stats[stat];
    if (value === null) continue;
    const range = entry[stat];
    if (!range) return null;
    const spread = Math.max(
      (toScale(stat, range.high) - toScale(stat, range.low)) / 1.35,
      1e-6
    );
    const gap = Math.abs(
      (toScale(stat, value) - toScale(stat, range.median)) / spread
    );
    const penalty =
      gap <= OUTLIER_GAP ? gap ** 2 : OUTLIER_GAP * (2 * gap - OUTLIER_GAP);
    score += STAT_WEIGHTS[stat] * (penalty + 2 * Math.log(spread));
  }
  return score;
}

export function estimateLeague(leagues: LeagueSummary[], stats: Stats) {
  if (
    (stats.average ?? 0) >= LEAGUE_7_AVERAGE ||
    (stats.best ?? 0) >= LEAGUE_7_BEST
  ) {
    return { league: LEAGUE_7, shares: [{ league: LEAGUE_7, share: 1 }] };
  }

  const scores = leagues.flatMap((entry) => {
    const score = entry.league === LEAGUE_7 ? null : fitScore(entry, stats);
    return score === null ? [] : [{ league: entry.league, score }];
  });
  // Relative likelihood of each league, so the closest one always comes first.
  const lowest = Math.min(...scores.map(({ score }) => score));
  const weights = scores.map(({ league, score }) => ({
    league,
    weight: Math.exp((lowest - score) / 2),
  }));
  const total = weights.reduce((sum, { weight }) => sum + weight, 0);
  const shares = weights
    .map(({ league, weight }) => ({ league, share: weight / total }))
    .sort((a, b) => b.share - a.share);

  return { league: shares[0]?.league ?? LEAGUE_7, shares };
}
