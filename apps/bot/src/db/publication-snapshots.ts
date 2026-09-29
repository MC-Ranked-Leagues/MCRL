import { and, asc, eq } from "drizzle-orm";

import { getDatabase } from ".";
import { matches, matchResults, registrations } from "./schema";

type Competition = {
  leagueNumber: number;
  weekNumber: number;
  id: number;
};

export function getMatchSnapshot(competition: Competition, matchId: number) {
  const tx = getDatabase();
  const match = tx.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!match?.rankedMatchId)
    throw new Error("Imported match has no Ranked ID.");
  const results = tx
    .select({ result: matchResults, registration: registrations })
    .from(matchResults)
    .innerJoin(registrations, eq(registrations.id, matchResults.registrationId))
    .where(eq(matchResults.matchId, matchId))
    .orderBy(asc(registrations.id))
    .all()
    // Convex adds missed rows for registrations absent from this snapshot.
    .filter(({ result }) => result.status !== "missed")
    .map(({ result, registration }) => ({
      uuid: registration.minecraftUuid,
      timeMs: result.timeMs,
      dnf: result.status === "dnf",
      placement: result.placement,
      pointsWon: result.points,
    }));
  return {
    leagueTier: competition.leagueNumber,
    weekNumber: competition.weekNumber,
    matchNumber: match.number,
    rankedMatchId: match.rankedMatchId,
    results,
  };
}

export function getAllMatchSnapshots(competition: Competition) {
  const tx = getDatabase();
  return tx
    .select({ id: matches.id, rankedMatchId: matches.rankedMatchId })
    .from(matches)
    .where(
      and(eq(matches.competitionId, competition.id), eq(matches.imported, true))
    )
    .orderBy(asc(matches.number))
    .all()
    .filter((match) => match.rankedMatchId !== null)
    .map((match) => getMatchSnapshot(competition, match.id));
}

export function websiteMovementStatus(
  movement: "promote" | "demote" | "none" | null | undefined
) {
  return movement === "promote"
    ? ("promoted" as const)
    : movement === "demote"
      ? ("demoted" as const)
      : ("none" as const);
}
