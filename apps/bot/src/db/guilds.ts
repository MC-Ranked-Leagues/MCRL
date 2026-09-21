import { eq } from "drizzle-orm";

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
