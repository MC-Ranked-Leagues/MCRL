import { and, eq } from "drizzle-orm";
import { getDatabase } from ".";
import { players } from "./schema";
import { normalizeUuid } from "../lib/ranked";

export function getPlayer(guildId: string, discordUserId: string) {
  return getDatabase()
    .select()
    .from(players)
    .where(
      and(
        eq(players.guildId, guildId),
        eq(players.discordUserId, discordUserId)
      )
    )
    .get();
}

export function getPlayerById(id: number) {
  return getDatabase().select().from(players).where(eq(players.id, id)).get();
}

export function getAccountOwner(guildId: string, uuid: string) {
  return getDatabase()
    .select()
    .from(players)
    .where(
      and(
        eq(players.guildId, guildId),
        eq(players.minecraftUuid, normalizeUuid(uuid))
      )
    )
    .get();
}

export function assignPlayerLeague(
  guildId: string,
  discordUserId: string,
  leagueNumber: number
) {
  getDatabase()
    .update(players)
    .set({ leagueNumber, status: "active" })
    .where(
      and(
        eq(players.guildId, guildId),
        eq(players.discordUserId, discordUserId)
      )
    )
    .run();
}

export function createSignup(
  input: Pick<
    typeof players.$inferInsert,
    | "guildId"
    | "discordUserId"
    | "discordUsername"
    | "minecraftUuid"
    | "ign"
    | "signupDetails"
  >
) {
  return getDatabase().transaction((tx) => {
    const existing = getPlayer(input.guildId, input.discordUserId);
    if (existing) return existing;
    // Check if someone already owns this account
    if (getAccountOwner(input.guildId, input.minecraftUuid)) return;
    return tx
      .insert(players)
      .values({
        ...input,
        minecraftUuid: normalizeUuid(input.minecraftUuid),
        status: "pending",
      })
      .returning()
      .get();
  });
}

export function saveSignupMessage(id: number, messageId: string) {
  getDatabase()
    .update(players)
    .set({ signupMessageId: messageId })
    .where(eq(players.id, id))
    .run();
}

export function decideSignup(
  id: number,
  leagueNumber?: number,
  linkedUuid?: string
) {
  return getDatabase().transaction((tx) => {
    const player = getPlayerById(id);
    if (!player || player.status !== "pending") return "resolved";
    if (
      leagueNumber !== undefined &&
      (!linkedUuid || normalizeUuid(linkedUuid) !== player.minecraftUuid)
    )
      return "link_changed";
    tx.update(players)
      .set({
        status: leagueNumber === undefined ? "rejected" : "active",
        leagueNumber,
      })
      .where(eq(players.id, id))
      .run();
    return leagueNumber === undefined ? "rejected" : "approved";
  });
}
