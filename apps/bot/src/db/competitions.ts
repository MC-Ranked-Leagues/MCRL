import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from ".";
import { competitions } from "./schema";

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

export function toggleRegistration(guildId: string, leagueNumber: number) {
  // Flip in SQL so concurrent commands cannot overwrite a toggle with a stale value.
  return getDatabase()
    .update(competitions)
    .set({ registrationOpen: sql`not ${competitions.registrationOpen}` })
    .where(
      and(
        eq(competitions.guildId, guildId),
        eq(competitions.leagueNumber, leagueNumber),
        eq(competitions.status, "active")
      )
    )
    .returning()
    .get();
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
