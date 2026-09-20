import { and, count, eq, like, or } from "drizzle-orm";
import type { MatchDetail } from "mcsrranked-sdk";

import { getDatabase } from ".";
import {
  competitions,
  registrations,
  matches,
  matchResults,
  players as persistentPlayers,
} from "./schema";

import { getPlayer, getAccountOwner } from "./players";
import { normalizeUuid } from "../lib/ranked";

import { getImportedMatches } from "./matches";
import { calculateMatchPoints } from "../lib/match-points";

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
      const result = registerPlayer(
        {
          competitionId,
          discordUserId: `test:${uuid}`,
          discordUsername: "test player",
          minecraftUuid: uuid,
          ign: player.nickname,
          elo: player.eloRate,
          peakElo: null,
          registeredAt: new Date(),
        },
        {
          mode: "test",
          initialLeague: competition.leagueNumber,
        }
      );
      if (result !== "registered") continue;
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
  {
    mode = "self",
    initialLeague,
    twitch,
  }: {
    mode?: "self" | "admin" | "forced" | "test";
    initialLeague?: number;
    twitch?: string | null;
  } = {}
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
    const importedMatches = getImportedMatches(competition.id);
    if (
      mode === "self" &&
      (!competition.registrationOpen || importedMatches.length > 0)
    )
      return "closed" as const;
    const uuid = normalizeUuid(input.minecraftUuid);
    const player = getPlayer(competition.guildId, input.discordUserId);
    if (player?.status === "rejected") return "signup_rejected" as const;
    if (player && player.minecraftUuid !== uuid)
      return "account_mismatch" as const;
    if (
      mode === "admin" &&
      player &&
      player.leagueNumber !== competition.leagueNumber
    )
      return "league_mismatch" as const;
    const owner = getAccountOwner(competition.guildId, uuid);
    if (owner && owner.discordUserId !== input.discordUserId)
      return "account_owned" as const;
    const existing = transaction
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.competitionId, input.competitionId),
          or(
            eq(registrations.discordUserId, input.discordUserId),
            eq(registrations.minecraftUuid, uuid)
          )
        )
      )
      .get();
    if (existing)
      return existing.discordUserId === input.discordUserId
        ? ("already_registered" as const)
        : ("account_registered" as const);
    const resolvedTwitch = player?.twitch?.trim() || twitch?.trim() || null;
    if (input.streaming && !resolvedTwitch) return "twitch_required" as const;
    const preserveLeague = mode === "forced" || mode === "test";
    const membership = player
      ? transaction
          .update(persistentPlayers)
          .set({
            discordUsername: input.discordUsername,
            ign: input.ign,
            status: "active",
            ...(preserveLeague
              ? {}
              : { leagueNumber: competition.leagueNumber }),
            ...(resolvedTwitch ? { twitch: resolvedTwitch } : {}),
          })
          .where(eq(persistentPlayers.id, player.id))
          .returning()
          .get()
      : transaction
          .insert(persistentPlayers)
          .values({
            guildId: competition.guildId,
            discordUserId: input.discordUserId,
            discordUsername: input.discordUsername,
            minecraftUuid: uuid,
            ign: input.ign,
            leagueNumber: preserveLeague
              ? initialLeague
              : competition.leagueNumber,
            isTest: mode === "test",
            twitch: resolvedTwitch,
          })
          .returning()
          .get();
    const registration = transaction
      .insert(registrations)
      .values({
        ...input,
        minecraftUuid: uuid,
        accountVersion: membership.accountVersion,
      })
      .returning()
      .get();

    // recalculate points for the imported matches
    if (importedMatches.length) {
      const registeredCount = transaction
        .select({ value: count() })
        .from(registrations)
        .where(eq(registrations.competitionId, competition.id))
        .get()!.value;
      // Late additions missed earlier matches unless a host explicitly re-imports them.
      for (const match of importedMatches) {
        transaction
          .insert(matchResults)
          .values({
            matchId: match.id,
            registrationId: registration.id,
            status: "missed",
          })
          .run();
        const results = transaction
          .select()
          .from(matchResults)
          .where(eq(matchResults.matchId, match.id))
          .all();
        for (const result of results) {
          transaction
            .update(matchResults)
            .set({
              points:
                result.status === "finished" && result.placement !== null
                  ? calculateMatchPoints(registeredCount, result.placement)
                  : 0,
            })
            .where(
              and(
                eq(matchResults.matchId, match.id),
                eq(matchResults.registrationId, result.registrationId)
              )
            )
            .run();
        }
      }
    }
    return "registered" as const;
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

export function clearTestRegistrations(guildId: string, competitionId: number) {
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
    if (!competition || competition.status !== "active")
      return { status: "inactive" } as const;
    // Clear players assigned to this league even after a previous week's cleanup.
    // Registration snapshots belong to competitions and remain independent.
    const testPlayers = tx
      .select()
      .from(persistentPlayers)
      .where(
        and(
          eq(persistentPlayers.guildId, guildId),
          eq(persistentPlayers.isTest, true)
        )
      )
      .all();
    const currentTestIds = new Set(
      tx
        .select({ discordUserId: registrations.discordUserId })
        .from(registrations)
        .where(eq(registrations.competitionId, competitionId))
        .all()
        .map((row) => row.discordUserId)
    );
    for (const player of testPlayers) {
      if (
        player.leagueNumber === competition.leagueNumber ||
        currentTestIds.has(player.discordUserId)
      ) {
        tx.delete(persistentPlayers)
          .where(eq(persistentPlayers.id, player.id))
          .run();
      }
    }
    // Real Discord IDs are snowflakes; only test_fill creates this prefix.
    // Dependent result rows cascade, matching admin unregistration behavior.
    const deleted = tx
      .delete(registrations)
      .where(
        and(
          eq(registrations.competitionId, competitionId),
          like(registrations.discordUserId, "test:%")
        )
      )
      .returning({ id: registrations.id })
      .all();
    return { status: "cleared", removed: deleted.length } as const;
  });
}
