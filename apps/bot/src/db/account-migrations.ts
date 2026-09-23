import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from ".";
import {
  accountMigrations,
  competitions,
  players,
  registrations,
} from "./schema";
import { getAccountOwner, getPlayer, getPlayerById } from "./players";
import { normalizeUuid } from "../lib/ranked";
import { guildConfiguration } from "../../config/guilds";

export function setTestMigrationAccount(input: {
  guildId: string;
  discordUserId: string;
  minecraftUuid: string;
  ign: string;
}) {
  if (guildConfiguration[input.guildId]?.dev !== true) return "not_dev";
  return getDatabase().transaction((tx) => {
    const player = getPlayer(input.guildId, input.discordUserId);
    if (!player || player.status !== "active") return "not_player";
    if (hasActiveRegistration(input.guildId, input.discordUserId))
      return "active_registration";
    const pending = tx
      .select({ id: accountMigrations.id })
      .from(accountMigrations)
      .where(
        and(
          eq(accountMigrations.playerId, player.id),
          eq(accountMigrations.status, "pending")
        )
      )
      .get();
    if (pending) return "pending";
    const uuid = normalizeUuid(input.minecraftUuid);
    if (player.minecraftUuid === uuid) return "same_account";
    if (getAccountOwner(input.guildId, uuid)) return "account_owned";
    // Separate old result snapshots while retaining percentages to test their reset.
    tx.update(players)
      .set({
        minecraftUuid: uuid,
        ign: input.ign,
        accountVersion: player.accountVersion + 1,
      })
      .where(eq(players.id, player.id))
      .run();
    return "updated";
  });
}

export function getMigration(id: number) {
  return getDatabase()
    .select()
    .from(accountMigrations)
    .where(eq(accountMigrations.id, id))
    .get();
}

export function getMigrationHistory(guildId: string, discordUserId: string) {
  const player = getPlayer(guildId, discordUserId);
  if (!player) return [];
  return getDatabase()
    .select()
    .from(accountMigrations)
    .where(eq(accountMigrations.playerId, player.id))
    .orderBy(desc(accountMigrations.id))
    .all();
}

function hasActiveRegistration(guildId: string, discordUserId: string) {
  return (
    getDatabase()
      .select({ id: registrations.id })
      .from(registrations)
      .innerJoin(competitions, eq(competitions.id, registrations.competitionId))
      .where(
        and(
          eq(competitions.guildId, guildId),
          eq(competitions.status, "active"),
          eq(registrations.discordUserId, discordUserId)
        )
      )
      .get() !== undefined
  );
}

export function createMigration(input: {
  guildId: string;
  discordUserId: string;
  minecraftUuid: string;
  ign: string;
  reviewerId: string;
}) {
  return getDatabase().transaction((tx) => {
    const player = getPlayer(input.guildId, input.discordUserId);
    if (!player || player.status !== "active")
      return { status: "not_player" } as const;
    const pending = tx
      .select()
      .from(accountMigrations)
      .where(
        and(
          eq(accountMigrations.playerId, player.id),
          eq(accountMigrations.status, "pending")
        )
      )
      .get();
    if (pending) return { status: "pending", request: pending } as const;
    const uuid = normalizeUuid(input.minecraftUuid);
    if (player.minecraftUuid === uuid)
      return { status: "same_account" } as const;
    if (hasActiveRegistration(input.guildId, input.discordUserId))
      return { status: "active_registration" } as const;
    if (getAccountOwner(input.guildId, uuid))
      return { status: "account_owned" } as const;
    const request = tx
      .insert(accountMigrations)
      .values({
        playerId: player.id,
        previousUuid: player.minecraftUuid,
        previousIgn: player.ign,
        minecraftUuid: uuid,
        ign: input.ign,
        accountVersion: player.accountVersion,
        reviewerId: input.reviewerId,
        createdAt: new Date(),
      })
      .returning()
      .get();
    return { status: "created", request } as const;
  });
}

export function saveMigrationMessage(
  id: number,
  messageId: string,
  reviewerId: string
) {
  getDatabase()
    .update(accountMigrations)
    .set({ reviewMessageId: messageId, reviewerId })
    .where(
      and(eq(accountMigrations.id, id), eq(accountMigrations.status, "pending"))
    )
    .run();
}

export function decideMigration(
  id: number,
  reviewerId: string,
  approve: boolean,
  linkedUuid?: string
) {
  return getDatabase().transaction((tx) => {
    const request = getMigration(id);
    if (!request || request.status !== "pending") return "resolved" as const;
    if (request.reviewerId !== reviewerId) return "forbidden" as const;
    if (approve) {
      const player = getPlayerById(request.playerId)!;
      // A saved review can be approved days later. Validate against current state.
      if (!linkedUuid || normalizeUuid(linkedUuid) !== request.minecraftUuid)
        return "link_changed" as const;
      if (player.accountVersion !== request.accountVersion)
        return "account_changed" as const;
      if (hasActiveRegistration(player.guildId, player.discordUserId))
        return "active_registration" as const;
      if (getAccountOwner(player.guildId, request.minecraftUuid))
        return "account_owned" as const;
      tx.update(players)
        .set({
          minecraftUuid: request.minecraftUuid,
          ign: request.ign,
          accountVersion: player.accountVersion + 1,
          percentageHistory: [],
        })
        .where(eq(players.id, player.id))
        .run();
    }
    tx.update(accountMigrations)
      .set({ status: approve ? "approved" : "denied", decidedAt: new Date() })
      .where(eq(accountMigrations.id, id))
      .run();
    return approve ? ("approved" as const) : ("denied" as const);
  });
}
