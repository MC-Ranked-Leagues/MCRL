import { and, eq } from "drizzle-orm";

import { getDatabase } from ".";
import { competitions, registrations, matches, matchResults } from "./schema";

type RegistrationInput = Omit<typeof registrations.$inferInsert, "id">;

export function registerPlayer(
  input: RegistrationInput,
  { bypassClosure = false } = {}
) {
  // The API lookup happens before this transaction. Recheck the exact competition
  // so a closure, deletion, or replacement during that lookup cannot admit a player.
  return getDatabase().transaction((transaction) => {
    const competition = transaction
      .select()
      .from(competitions)
      .where(eq(competitions.id, input.competitionId))
      .get();
    if (!competition || competition.status !== "active")
      return "inactive" as const;
    if (!competition.registrationOpen && !bypassClosure)
      return "closed" as const;
    const existing = transaction
      .select({ id: registrations.id })
      .from(registrations)
      .where(
        and(
          eq(registrations.competitionId, input.competitionId),
          eq(registrations.discordUserId, input.discordUserId)
        )
      )
      .get();
    if (existing) return "already_registered" as const;

    const created = transaction
      .insert(registrations)
      .values(input)
      .onConflictDoNothing()
      .returning({ id: registrations.id })
      .get();
    return created ? ("registered" as const) : ("account_registered" as const);
  });
}

export function unregisterPlayer(
  competitionId: number,
  discordUserId: string,
  { admin = false } = {}
) {
  return getDatabase().transaction((transaction) => {
    const competition = transaction
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .get();
    if (!competition || competition.status !== "active")
      return { status: "inactive" } as const;
    const player = transaction
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.competitionId, competitionId),
          eq(registrations.discordUserId, discordUserId)
        )
      )
      .get();
    if (!player) return { status: "not_registered" } as const;
    if (!admin) {
      if (!competition.registrationOpen) return { status: "closed" } as const;
      const importedResult = transaction
        .select({ id: matchResults.registrationId })
        .from(matchResults)
        .innerJoin(matches, eq(matches.id, matchResults.matchId))
        .where(
          and(
            eq(matchResults.registrationId, player.id),
            eq(matches.imported, true)
          )
        )
        .get();
      if (importedResult) return { status: "has_results" } as const;
    }
    // Delete only this competition's registration; dependent match results cascade.
    transaction
      .delete(registrations)
      .where(eq(registrations.id, player.id))
      .run();
    return { status: "unregistered", ign: player.ign } as const;
  });
}
