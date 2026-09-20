import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from ".";
import { competitions, matches, registrations } from "./schema";

import { getImportedMatches } from "./matches";

interface StartCompetitionInput {
  guildId: string;
  leagueNumber: number;
  weekNumber: number;
  maxTimeLimitMs: number;
  startedAt: Date;
}

export function startCompetition(input: StartCompetitionInput): boolean {
  // Both unique indexes reject duplicate weeks or overlapping active competitions, even on concurrent starts.
  const competition = getDatabase()
    .insert(competitions)
    .values(input)
    .onConflictDoNothing()
    .returning({ id: competitions.id })
    .get();

  return competition !== undefined;
}

export function getActiveCompetition(guildId: string, leagueNumber: number) {
  return getDatabase()
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.guildId, guildId),
        eq(competitions.leagueNumber, leagueNumber),
        eq(competitions.status, "active")
      )
    )
    .get();
}

export function getLatestEndedCompetition(
  guildId: string,
  leagueNumber: number
) {
  return getDatabase()
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.guildId, guildId),
        eq(competitions.leagueNumber, leagueNumber),
        eq(competitions.status, "ended")
      )
    )
    .orderBy(desc(competitions.endedAt), desc(competitions.id))
    .get();
}

export function endCompetition(guildId: string, competitionId: number) {
  return getDatabase().transaction((tx) => {
    const competition = tx
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.id, competitionId),
          eq(competitions.guildId, guildId)
        )
      )
      .get();
    if (!competition) return { status: "not_found" } as const;
    if (competition.status === "ended")
      return { status: "already_ended" } as const;
    const importedMatch = tx
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.competitionId, competitionId),
          eq(matches.imported, true)
        )
      )
      .get();
    if (!importedMatch) return { status: "no_matches" } as const;

    tx.update(competitions)
      .set({ status: "ended", registrationOpen: false, endedAt: new Date() })
      .where(eq(competitions.id, competitionId))
      .run();
    return { status: "ended" } as const;
  });
}

export function toggleRegistration(guildId: string, leagueNumber: number) {
  return getDatabase().transaction((tx) => {
    const competition = getActiveCompetition(guildId, leagueNumber);
    if (!competition) return;
    if (
      !competition.registrationOpen &&
      getImportedMatches(competition.id).length
    )
      return "has_results" as const;
    return tx
      .update(competitions)
      .set({ registrationOpen: !competition.registrationOpen })
      .where(eq(competitions.id, competition.id))
      .returning()
      .get();
  });
}

export function deleteActiveCompetition(
  guildId: string,
  competitionId: number
): boolean {
  // Use the ID shown in the prompt so a stale confirmation cannot delete a replacement.
  // Foreign keys cascade the deletion to registrations, matches, and results.
  return (
    getDatabase()
      .delete(competitions)
      .where(
        and(
          eq(competitions.guildId, guildId),
          eq(competitions.id, competitionId),
          eq(competitions.status, "active")
        )
      )
      .returning({ id: competitions.id })
      .get() !== undefined
  );
}

export function getCompetitionRegistration(competitionId: number) {
  const database = getDatabase();
  const competition = database
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!competition) return;
  const players = database
    .select()
    .from(registrations)
    .where(eq(registrations.competitionId, competitionId))
    // Ranked may omit peak Elo; use the current Elo captured at registration.
    .orderBy(
      desc(sql`coalesce(${registrations.peakElo}, ${registrations.elo})`),
      asc(registrations.ign),
      asc(registrations.id)
    )
    .all();
  return { competition, players };
}

export function saveRegistrationMessageIds(
  competitionId: number,
  messageIds: string[]
) {
  getDatabase()
    .update(competitions)
    .set({ registrationMessageIds: messageIds })
    .where(eq(competitions.id, competitionId))
    .run();
}
