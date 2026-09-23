import { and, asc, desc, eq, getTableColumns, sql } from "drizzle-orm";

import { getDatabase } from ".";
import {
  competitions,
  guilds,
  matches,
  players as persistentPlayers,
  registrations,
} from "./schema";

import { getImportedMatches } from "./matches";
import { getCurrentWeek } from "./guilds";

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

export function getLatestEndedCompetition(
  guildId: string,
  leagueNumber: number
) {
  return getDatabase()
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.guildId, guildId),
        eq(competitions.leagueNumber, leagueNumber),
        eq(competitions.status, "ended")
      )
    )
    .orderBy(desc(competitions.endedAt), desc(competitions.id))
    .get();
}

export function endCompetition(guildId: string, competitionId: number) {
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
    if (!competition) return { status: "not_found" } as const;
    if (competition.status === "ended")
      return { status: "already_ended" } as const;
    const importedMatch = tx
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.competitionId, competitionId),
          eq(matches.imported, true)
        )
      )
      .get();
    if (!importedMatch) return { status: "no_matches" } as const;

    tx.update(competitions)
      .set({ status: "ended", registrationOpen: false, endedAt: new Date() })
      .where(eq(competitions.id, competitionId))
      .run();
    return { status: "ended" } as const;
  });
}

export function unendCompetition(guildId: string, competitionId: number) {
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
    if (!competition) return { status: "not_found" } as const;
    // Keep processed competitions ended so write operations only need the active-status guard.
    if (competition.hasUsedRelegate) return { status: "relegated" } as const;
    if (competition.status === "active")
      return { status: "already_active" } as const;

    const activeCompetition = tx
      .select({ id: competitions.id })
      .from(competitions)
      .where(
        and(
          eq(competitions.guildId, guildId),
          eq(competitions.leagueNumber, competition.leagueNumber),
          eq(competitions.status, "active")
        )
      )
      .get();
    if (activeCompetition) return { status: "has_active" } as const;

    tx.update(competitions)
      .set({ status: "active", registrationOpen: false, endedAt: null })
      .where(eq(competitions.id, competitionId))
      .run();
    return { status: "active" } as const;
  });
}

export function toggleRegistration(guildId: string, leagueNumber: number) {
  return getDatabase().transaction((tx) => {
    const competition = getActiveCompetition(guildId, leagueNumber);
    if (!competition) return;
    if (
      !competition.registrationOpen &&
      getImportedMatches(competition.id).length
    )
      return "has_results" as const;
    return tx
      .update(competitions)
      .set({ registrationOpen: !competition.registrationOpen })
      .where(eq(competitions.id, competition.id))
      .returning()
      .get();
  });
}

export function getAdvanceWeekPreview(guildId: string) {
  const database = getDatabase();
  const currentWeek = getCurrentWeek(guildId);
  const guildCompetitions = database
    .select({
      id: competitions.id,
      leagueNumber: competitions.leagueNumber,
      weekNumber: competitions.weekNumber,
      status: competitions.status,
      hasUsedRelegate: competitions.hasUsedRelegate,
    })
    .from(competitions)
    .where(eq(competitions.guildId, guildId))
    .orderBy(asc(competitions.leagueNumber), asc(competitions.weekNumber))
    .all();

  return {
    currentWeek,
    competitions: guildCompetitions,
  };
}

export function advanceGuildWeek(
  guildId: string,
  expectedWeek: number,
  force: boolean
): "advanced" | "stale_week" | "unprocessed" {
  return getDatabase().transaction((tx) => {
    const guild = tx
      .select({ currentWeek: guilds.currentWeek })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .get();
    if (guild?.currentWeek !== expectedWeek) {
      return "stale_week" as const;
    }
    const unprocessedCompetition = tx
      .select({ id: competitions.id })
      .from(competitions)
      .where(
        and(
          eq(competitions.guildId, guildId),
          eq(competitions.hasUsedRelegate, false)
        )
      )
      .get();
    if (unprocessedCompetition && !force) {
      return "unprocessed" as const;
    }

    // Foreign keys remove registrations, matches, and results. Discord messages are external and remain untouched.
    tx.delete(competitions).where(eq(competitions.guildId, guildId)).run();
    tx.update(guilds)
      .set({ currentWeek: expectedWeek + 1 })
      .where(eq(guilds.id, guildId))
      .run();
    return "advanced" as const;
  });
}

export function getCompetitionRegistration(competitionId: number) {
  const database = getDatabase();
  const competition = database
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!competition) return;
  const players = database
    .select({
      ...getTableColumns(registrations),
      percentageHistory: persistentPlayers.percentageHistory,
    })
    .from(registrations)
    .leftJoin(
      persistentPlayers,
      and(
        eq(persistentPlayers.guildId, competition.guildId),
        eq(persistentPlayers.discordUserId, registrations.discordUserId),
        eq(persistentPlayers.minecraftUuid, registrations.minecraftUuid),
        eq(persistentPlayers.accountVersion, registrations.accountVersion)
      )
    )
    .where(eq(registrations.competitionId, competitionId))
    // Ranked may omit peak Elo; use the current Elo captured at registration.
    .orderBy(
      desc(sql`coalesce(${registrations.peakElo}, ${registrations.elo})`),
      asc(registrations.ign),
      asc(registrations.id)
    )
    .all();
  return { competition, players };
}

export function getCompetitionExport(competitionId: number) {
  const database = getDatabase();
  const competition = database
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!competition) return;
  const players = database
    .select({
      ign: registrations.ign,
      streaming: registrations.streaming,
      twitch: persistentPlayers.twitch,
    })
    .from(registrations)
    .leftJoin(
      persistentPlayers,
      and(
        eq(persistentPlayers.guildId, competition.guildId),
        eq(persistentPlayers.discordUserId, registrations.discordUserId)
      )
    )
    .where(eq(registrations.competitionId, competitionId))
    .orderBy(
      desc(sql`coalesce(${registrations.peakElo}, ${registrations.elo})`),
      asc(registrations.ign),
      asc(registrations.id)
    )
    .all();
  return { competition, players };
}

export function saveRegistrationMessageIds(
  competitionId: number,
  messageIds: string[]
) {
  getDatabase()
    .update(competitions)
    .set({ registrationMessageIds: messageIds })
    .where(eq(competitions.id, competitionId))
    .run();
}
