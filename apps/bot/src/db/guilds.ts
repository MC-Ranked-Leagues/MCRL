import { eq, sql } from "drizzle-orm";

import { getDatabase } from ".";
import { guilds } from "./schema";

export function getCurrentWeek(guildId: string): number {
  const database = getDatabase();
  // setup guild for the first time
  database.insert(guilds).values({ id: guildId }).onConflictDoNothing().run();

  return database
    .select({ currentWeek: guilds.currentWeek })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .get()!.currentWeek;
}

export function setCurrentWeek(guildId: string, currentWeek: number): void {
  if (!Number.isSafeInteger(currentWeek) || currentWeek < 1) {
    throw new RangeError("The current week must be a positive integer.");
  }

  getDatabase()
    .insert(guilds)
    .values({ id: guildId, currentWeek })
    .onConflictDoUpdate({ target: guilds.id, set: { currentWeek } })
    .run();
}

export function getTicketMessageId(guildId: string): string | null {
  return (
    getDatabase()
      .select({ ticketMessageId: guilds.ticketMessageId })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .get()?.ticketMessageId ?? null
  );
}

export function saveTicketMessageId(guildId: string, messageId: string) {
  getDatabase()
    .insert(guilds)
    .values({ id: guildId, ticketMessageId: messageId })
    .onConflictDoUpdate({
      target: guilds.id,
      set: { ticketMessageId: messageId },
    })
    .run();
}

// Numbers are never reused, even when creating the ticket thread fails.
export function nextTicketNumber(guildId: string): number {
  return getDatabase()
    .insert(guilds)
    .values({ id: guildId, ticketCount: 1 })
    .onConflictDoUpdate({
      target: guilds.id,
      set: { ticketCount: sql`${guilds.ticketCount} + 1` },
    })
    .returning({ ticketCount: guilds.ticketCount })
    .get().ticketCount;
}
