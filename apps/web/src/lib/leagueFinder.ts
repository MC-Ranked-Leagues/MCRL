import { mcsrranked, RankedError } from "mcsrranked-sdk";
// Regenerate with `bun run league-summary <snapshot.zip>`.
import summary from "@/data/league-summary.json";
import { formatRunTime } from "@/lib/format";
import {
  estimateLeague as estimate,
  rankedStats,
  type Range,
  type Stat,
  type Stats,
} from "@/lib/leagueEstimate";

export type { Stats };

export const LEAGUES = [1, 2, 3, 4, 5, 6, 7];

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
  return formatRunTime(seconds * 1000, { hundredths: false })
    .replace(":", "")
    .padStart(4, "0");
}

// The middle half of a league's players for one stat.
export function typicalRange(league: number, stat: Stat): Range | null {
  const entry = summary.leagues.find((row) => row.league === league);
  return entry?.[stat] ?? null;
}

export function estimateLeague(stats: Stats) {
  return estimate(summary.leagues, stats);
}

export type RankedLookup =
  | { status: "not-found" }
  | { status: "failed" }
  | ({ status: "found"; uuid: string } & Stats);

export async function lookUpRanked(name: string): Promise<RankedLookup> {
  try {
    const user = await mcsrranked.users.get(name);
    const { elo, average, best } = rankedStats(user);
    return { status: "found", uuid: user.uuid, elo, average, best };
  } catch (error) {
    return error instanceof RankedError &&
      (error.status === 400 || error.status === 404)
      ? { status: "not-found" }
      : { status: "failed" };
  }
}
