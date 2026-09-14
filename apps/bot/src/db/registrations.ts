import { and, eq } from "drizzle-orm";

import { getDatabase } from ".";
import { competitions, registrations } from "./schema";

type RegistrationInput = Omit<typeof registrations.$inferInsert, "id">;

export function registerPlayer(input: RegistrationInput) {
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
    if (!competition.registrationOpen) return "closed" as const;
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
