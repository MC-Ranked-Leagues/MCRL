import { and, eq } from "drizzle-orm";
import type { MatchDetail } from "mcsrranked-sdk";

import { getDatabase } from ".";
import { competitions, registrations, matches, matchResults } from "./schema";

type RegistrationInput = Omit<typeof registrations.$inferInsert, "id">;

export function fillTestRegistrations(
  competitionId: number,
  players: MatchDetail["players"]
) {
  return getDatabase().transaction((tx) => {
    const competition = tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .get();
    if (!competition || competition.status !== "active")
      return { status: "inactive" } as const;
    const normalizeUuid = (uuid: string) =>
      uuid.replaceAll("-", "").toLowerCase();
    const existing = new Set(
      tx
        .select()
        .from(registrations)
        .where(eq(registrations.competitionId, competitionId))
        .all()
        .map((player) => normalizeUuid(player.minecraftUuid))
    );
    let added = 0;
    for (const player of players) {
      const uuid = normalizeUuid(player.uuid);
      if (existing.has(uuid)) continue;
      tx.insert(registrations)
        .values({
          competitionId,
          // Non-snowflake IDs cannot be mistaken for real Discord accounts.
          discordUserId: `test:${uuid}`,
          discordUsername: "test player",
          minecraftUuid: uuid,
          ign: player.nickname,
          elo: player.eloRate,
          peakElo: null,
          registeredAt: new Date(),
        })
        .run();
      existing.add(uuid);
      added++;
    }
    return {
      status: "filled",
      added,
      skipped: players.length - added,
    } as const;
  });
}

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
