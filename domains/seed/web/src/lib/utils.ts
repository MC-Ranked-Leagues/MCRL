import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Doc } from "../../../convex/_generated/dataModel";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sortLeaguesByNumberAndName(
  leagues: Doc<"leagues">[]
): Doc<"leagues">[] {
  return [...leagues].sort(
    (a, b) =>
      a.leagueNumber - b.leagueNumber ||
      a.leagueName.localeCompare(b.leagueName)
  );
}

export function getLeagueCountLabel(leagueCount: number) {
  return leagueCount === 1 ? "1 league" : `${leagueCount} leagues`;
}
export function getSeedCountLabel(seedCount: number) {
  return seedCount === 1 ? "1 seed" : `${seedCount} seeds`;
}
