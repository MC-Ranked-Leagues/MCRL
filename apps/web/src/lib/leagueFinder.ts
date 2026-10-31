import { mcsrranked, RankedError } from "mcsrranked-sdk";
// Regenerate with `bun run league-summary <snapshot.zip>`.
import summary from "@/data/league-summary.json";

export const LEAGUES = [1, 2, 3, 4, 5, 6, 7];

export type Stats = {
  elo: number | null;
  average: number | null;
  best: number | null;
};

type Range = { low: number; median: number; high: number };
type Stat = keyof Stats;

const STAT_NAMES: Stat[] = ["elo", "average", "best"];

// League 7 has too few players to compare against, so only these limits place
// anyone there.
const LEAGUE_7 = 7;
const LEAGUE_7_AVERAGE = 30 * 60;
const LEAGUE_7_BEST = 25 * 60;

export function formatTime(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function cleanTimeDigits(text: string) {
  return text.replace(/\D/g, "").slice(0, 4);
}

export function formatTimeDigits(digits: string) {
  return digits.length > 2
    ? `${digits.slice(0, 2)}:${digits.slice(2)}`
    : digits;
}

// Reads the digits as typed, so 5 is 5:00, 51 is 51:00 and 124 is 12:04.
export function parseTimeDigits(digits: string) {
  const seconds = Number(digits.slice(2));
  const total = Number(digits.slice(0, 2)) * 60 + seconds;
  return seconds < 60 && total >= 3 * 60 ? total : null;
}

export function timeToDigits(seconds: number) {
  return formatTime(seconds).replace(":", "").padStart(4, "0");
}

export function headUrl(player: string) {
  return `https://vzge.me/face/128/${encodeURIComponent(player)}.png`;
}

export const STEVE_HEAD = headUrl("Steve");

// The middle half of a league's players for one stat.
export function typicalRange(league: number, stat: Stat): Range | null {
  const entry = summary.leagues.find((row) => row.league === league);
  return entry?.[stat] ?? null;
}

// A 10% time difference matters the same at 8 minutes as at 20.
function toScale(stat: Stat, value: number) {
  return stat === "elo" ? value : Math.log(value);
}

// Lower means a closer fit. Treats each league's middle half as a bell curve, so
// a wide league like 6 forgives more than a narrow one like 2. Tested on the
// players behind the summary, this picks the exact league 60% of the time and is
// within one league 97% of the time with all three stats. Those players times
// are from league matches and a new player's come from Ranked, so it's a rough
// guide rather than a placement.
function fitScore(league: number, stats: Stats) {
  let score = 0;
  for (const stat of STAT_NAMES) {
    const value = stats[stat];
    if (value === null) continue;
    const range = typicalRange(league, stat);
    if (!range) return null;
    const spread = Math.max(
      (toScale(stat, range.high) - toScale(stat, range.low)) / 1.35,
      1e-6
    );
    const gap = (toScale(stat, value) - toScale(stat, range.median)) / spread;
    score += gap ** 2 + 2 * Math.log(spread);
  }
  return score;
}

export function estimateLeague(stats: Stats) {
  if (
    (stats.average ?? 0) >= LEAGUE_7_AVERAGE ||
    (stats.best ?? 0) >= LEAGUE_7_BEST
  ) {
    return { league: LEAGUE_7, shares: [{ league: LEAGUE_7, share: 1 }] };
  }

  const scores = LEAGUES.flatMap((league) => {
    const score = league === LEAGUE_7 ? null : fitScore(league, stats);
    return score === null ? [] : [{ league, score }];
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

export type RankedLookup =
  | { status: "not-found" }
  | { status: "failed" }
  | ({ status: "found"; uuid: string } & Stats);

export async function lookUpRanked(name: string): Promise<RankedLookup> {
  try {
    const user = await mcsrranked.users.get(name);
    // A new season starts empty, so older totals fill in until they've played.
    const { season, total } = user.statistics;
    const stats = (season.completions.ranked ?? 0) > 0 ? season : total;
    const completions = stats.completions.ranked ?? 0;
    const completionTime = stats.completionTime.ranked;
    const best = stats.bestTime.ranked;

    return {
      status: "found",
      uuid: user.uuid,
      elo: user.eloRate ?? user.seasonResult.highest,
      average:
        completions > 0 && completionTime !== null
          ? Math.round(completionTime / completions / 1000)
          : null,
      best: best === null ? null : Math.round(best / 1000),
    };
  } catch (error) {
    return error instanceof RankedError &&
      (error.status === 400 || error.status === 404)
      ? { status: "not-found" }
      : { status: "failed" };
  }
}
