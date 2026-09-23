import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from ".";
import {
  competitions,
  matches,
  matchResults,
  players,
  registrations,
} from "./schema";
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

export function setPlayerTwitchUsername(
  guildId: string,
  discordUserId: string,
  twitchUsername: string
): boolean {
  return (
    getDatabase()
      .update(players)
      .set({ twitch: twitchUsername })
      .where(
        and(
          eq(players.guildId, guildId),
          eq(players.discordUserId, discordUserId)
        )
      )
      .returning({ id: players.id })
      .get() !== undefined
  );
}

export function assignPlayerLeague(
  guildId: string,
  discordUserId: string,
  leagueNumber: number,
  account?: Pick<
    typeof players.$inferInsert,
    "discordUsername" | "minecraftUuid" | "ign"
  >,
  { preserveHistory = false } = {}
) {
  return getDatabase().transaction((tx) => {
    const existing = getPlayer(guildId, discordUserId);
    if (existing) {
      const pendingParticipation = tx
        .select({ id: registrations.id })
        .from(registrations)
        .innerJoin(
          competitions,
          eq(competitions.id, registrations.competitionId)
        )
        .innerJoin(
          matchResults,
          eq(matchResults.registrationId, registrations.id)
        )
        .innerJoin(matches, eq(matches.id, matchResults.matchId))
        .where(
          and(
            // Can prob be simplified
            eq(competitions.guildId, guildId),
            eq(competitions.hasUsedRelegate, false),
            eq(registrations.discordUserId, discordUserId),
            eq(registrations.minecraftUuid, existing.minecraftUuid),
            eq(registrations.accountVersion, existing.accountVersion),
            eq(matches.imported, true),
            inArray(matchResults.status, ["finished", "dnf"])
          )
        )
        .get();
      if (pendingParticipation) return "unprocessed_competition";
      tx.update(players)
        .set({
          leagueNumber,
          status: "active",
          ...(existing.leagueNumber !== leagueNumber && !preserveHistory
            ? { percentageHistory: [] }
            : {}),
        })
        .where(eq(players.id, existing.id))
        .run();
      return "assigned";
    }
    if (!account) return "missing_account";
    if (getAccountOwner(guildId, account.minecraftUuid)) return "account_owned";
    tx.insert(players)
      .values({
        ...account,
        guildId,
        discordUserId,
        minecraftUuid: normalizeUuid(account.minecraftUuid),
        leagueNumber,
        status: "active",
      })
      .run();
    return "assigned";
  });
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
    if (leagueNumber !== undefined) {
      if (!linkedUuid || normalizeUuid(linkedUuid) !== player.minecraftUuid)
        return "link_changed";
    }
    tx.update(players)
      .set({
        status: leagueNumber === undefined ? "rejected" : "active",
        leagueNumber,
        signupMessageId: null,
        signupDetails: null,
      })
      .where(eq(players.id, id))
      .run();
    return leagueNumber === undefined ? "rejected" : "approved";
  });
}
