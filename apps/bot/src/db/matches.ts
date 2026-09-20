import { and, asc, desc, eq } from "drizzle-orm";
import type { MatchDetail } from "mcsrranked-sdk";

import { getDatabase } from ".";
import { calculateMatchPoints } from "../lib/match-points";
import { competitions, matches, matchResults, registrations } from "./schema";

export type RankedMatchInput = Pick<
  MatchDetail,
  "id" | "players" | "completions"
>;

const normalizeUuid = (uuid: string) => uuid.replaceAll("-", "").toLowerCase();

export function getImportedMatches(competitionId: number) {
  return getDatabase()
    .select()
    .from(matches)
    .where(
      and(eq(matches.competitionId, competitionId), eq(matches.imported, true))
    )
    .all();
}

export function importMatch(
  competitionId: number,
  data: RankedMatchInput,
  number?: number
) {
  return getDatabase().transaction((tx) => {
    // Recheck after the Ranked request, before replacing any existing results.
    const competition = tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .get();
    if (!competition || competition.status !== "active")
      return { status: "inactive" } as const;
    const existingMatches = tx
      .select()
      .from(matches)
      .where(eq(matches.competitionId, competitionId))
      .orderBy(desc(matches.number))
      .all();
    const matchNumber = number ?? (existingMatches[0]?.number ?? 0) + 1;
    const duplicate = existingMatches.find(
      (match) =>
        match.rankedMatchId === String(data.id) && match.number !== matchNumber
    );
    // Return if the ranked match id is already imported
    if (duplicate)
      return { status: "duplicate", number: duplicate.number } as const;
    const players = tx
      .select()
      .from(registrations)
      .where(eq(registrations.competitionId, competitionId))
      .all();
    if (!players.length) return { status: "no_registrations" } as const;
    if (!data.players.length) return { status: "empty_match" } as const;
    const participants = new Set(
      data.players.map((player) => normalizeUuid(player.uuid))
    );
    const completions = new Map(
      data.completions.map((completion) => [
        normalizeUuid(completion.uuid),
        completion.time,
      ])
    );
    const registeredUuids = new Set(
      players.map((player) => normalizeUuid(player.minecraftUuid))
    );
    const unmatched = data.players
      .filter((player) => !registeredUuids.has(normalizeUuid(player.uuid)))
      .map((player) => player.nickname);
    const matched = players.filter((player) =>
      participants.has(normalizeUuid(player.minecraftUuid))
    ).length;
    if (!matched) return { status: "no_matching_players" } as const;
    const existing = existingMatches.find(
      (match) => match.number === matchNumber
    );
    const timeLimitMs = existing?.timeLimitMs ?? competition.maxTimeLimitMs;
    // A played DNF counts as participation; a missed placeholder does not.
    const rows = players.map((player) => {
      const uuid = normalizeUuid(player.minecraftUuid);
      const played = participants.has(uuid);
      const time = completions.get(uuid);
      const finished =
        played &&
        time !== undefined &&
        Number.isSafeInteger(time) &&
        time >= 0 &&
        time <= timeLimitMs;
      return {
        registrationId: player.id,
        status: finished
          ? ("finished" as const)
          : played
            ? ("dnf" as const)
            : ("missed" as const),
        timeMs: finished ? time : null,
        placement: null as number | null,
        points: 0,
        submittedAt: played ? new Date() : null,
      };
    });
    const finishers = rows
      .filter((row) => row.status === "finished")
      .sort((a, b) => a.timeMs! - b.timeMs!);
    let placement = 0;
    let previousTimeMs: number | null = null;
    for (const [index, finisher] of finishers.entries()) {
      // Equal times share placement and points. After 1, 2, 2, the next place is 4.
      if (finisher.timeMs !== previousTimeMs) placement = index + 1;
      finisher.placement = placement;
      finisher.points = calculateMatchPoints(players.length, placement);
      previousTimeMs = finisher.timeMs;
    }

    const match = tx
      .insert(matches)
      .values({
        competitionId,
        number: matchNumber,
        participantCount: players.length,
        timeLimitMs,
        imported: true,
        rankedMatchId: String(data.id),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [matches.competitionId, matches.number],
        set: {
          participantCount: players.length,
          imported: true,
          rankedMatchId: String(data.id),
        },
      })
      .returning()
      .get();
    // Delete old results for this match before adding the new ones
    tx.delete(matchResults).where(eq(matchResults.matchId, match.id)).run();
    for (const row of rows)
      tx.insert(matchResults)
        .values({ ...row, matchId: match.id })
        .run();
    // Turn off registration on match import
    tx.update(competitions)
      .set({ registrationOpen: false })
      .where(eq(competitions.id, competitionId))
      .run();
    return {
      status: "imported",
      number: matchNumber,
      matched,
      total: players.length,
      unmatched,
    } as const;
  });
}

export function clearMatch(competitionId: number, number?: number) {
  return getDatabase().transaction((tx) => {
    const competition = tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .get();
    if (!competition || competition.status !== "active")
      return { status: "inactive" } as const;
    const match = tx
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.competitionId, competitionId),
          number === undefined ? undefined : eq(matches.number, number)
        )
      )
      .orderBy(desc(matches.number))
      .get();
    if (!match) return { status: "not_found" } as const;
    // The foreign key deletes this match's results in the same transaction.
    tx.delete(matches).where(eq(matches.id, match.id)).run();
    return { status: "cleared", number: match.number } as const;
  });
}

export function getCompetitionStandings(competitionId: number) {
  const db = getDatabase();
  const competition = db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .get();
  if (!competition) return;
  const latestMatch = db
    .select({ number: matches.number })
    .from(matches)
    .where(
      and(eq(matches.competitionId, competitionId), eq(matches.imported, true))
    )
    .orderBy(desc(matches.number))
    .get();
  const rows = db
    .select({
      result: matchResults,
      player: registrations,
      timeLimitMs: matches.timeLimitMs,
    })
    .from(matchResults)
    .innerJoin(matches, eq(matches.id, matchResults.matchId))
    .innerJoin(registrations, eq(registrations.id, matchResults.registrationId))
    .where(
      and(eq(matches.competitionId, competitionId), eq(matches.imported, true))
    )
    .orderBy(asc(matches.number))
    .all();
  const players = new Map<
    number,
    {
      ign: string;
      discordUsername: string;
      discordUserId: string;
      points: number;
      played: number;
      count: number;
      totalTimeMs: number;
    }
  >();
  for (const { result, player, timeLimitMs } of rows) {
    const entry = players.get(player.id) ?? {
      ign: player.ign,
      discordUsername: player.discordUsername,
      discordUserId: player.discordUserId,
      points: 0,
      played: 0,
      count: 0,
      totalTimeMs: 0,
    };
    entry.points += result.points;
    entry.count++;
    entry.totalTimeMs +=
      result.status === "finished" ? result.timeMs! : timeLimitMs;
    if (result.status === "finished" || result.status === "dnf") entry.played++;
    players.set(player.id, entry);
  }
  // Hide nonparticipants from rankings without removing their registrations or missed results.
  const standings = [...players.values()]
    .filter((player) => player.played > 0)
    .map((player) => ({
      ...player,
      averageTimeMs: player.totalTimeMs / player.count,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.averageTimeMs - b.averageTimeMs ||
        a.ign.localeCompare(b.ign)
    );
  const missed = db
    .select()
    .from(registrations)
    .where(eq(registrations.competitionId, competitionId))
    .orderBy(asc(registrations.ign), asc(registrations.id))
    .all()
    .filter((player) => !players.get(player.id)?.played)
    .map((player) => player.ign);
  return {
    competition,
    standings,
    missed,
    currentSeed: latestMatch?.number ?? 0,
  };
}

export function saveLeaderboardMessageIds(
  competitionId: number,
  ids: string[]
) {
  getDatabase()
    .update(competitions)
    .set({ leaderboardMessageIds: ids })
    .where(eq(competitions.id, competitionId))
    .run();
}
