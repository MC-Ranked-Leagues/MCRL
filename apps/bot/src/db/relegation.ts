import { and, eq } from "drizzle-orm";

import { getDatabase } from ".";
import { getCompetitionRegistration } from "./competitions";
import { getCompetitionStandings } from "./matches";
import { competitions, guilds, players, registrations } from "./schema";
import { websiteMovementStatus } from "./publication-snapshots";
import {
  calculateLeagueMovement,
  calculateLeague7Qualification,
} from "../lib/league-movement";

function getMovementParticipants(competitionId: number) {
  const data = getCompetitionStandings(competitionId);
  const registration = getCompetitionRegistration(competitionId);
  if (!data || !registration) return;
  const registered = new Map(
    registration.players.map((player) => [player.id, player])
  );
  const participants = data.standings.map((player) => ({
    ...player,
    history: registered.get(player.registrationId)?.percentageHistory ?? [],
  }));
  return { data, registered, participants };
}

export function getCompetitionMovement(competitionId: number) {
  const prepared = getMovementParticipants(competitionId);
  if (!prepared) return;
  const { data, registered, participants } = prepared;
  const decisions = data.competition.hasUsedRelegate
    ? data.standings.map((player) => {
        const saved = registered.get(player.registrationId)!;
        return {
          registrationId: player.registrationId,
          averageUsed: saved.averageUsed,
          movement: saved.movement,
        };
      })
    : data.competition.leagueNumber === 7
      ? calculateLeague7Qualification(participants)
      : calculateLeagueMovement(data.competition.leagueNumber, participants);
  return { ...data, decisions };
}

export function getRelegatedRoleAssignments(guildId: string, week: number) {
  // Saved movements are authoritative; this only re-reads them for Discord repair.
  const rows = getDatabase()
    .select({
      discordUserId: registrations.discordUserId,
      movement: registrations.movement,
      leagueNumber: competitions.leagueNumber,
      isTest: players.isTest,
    })
    .from(registrations)
    .innerJoin(competitions, eq(competitions.id, registrations.competitionId))
    .leftJoin(
      players,
      and(
        eq(players.guildId, competitions.guildId),
        eq(players.discordUserId, registrations.discordUserId),
        eq(players.minecraftUuid, registrations.minecraftUuid)
      )
    )
    .where(
      and(
        eq(competitions.guildId, guildId),
        eq(competitions.weekNumber, week),
        eq(competitions.hasUsedRelegate, true)
      )
    )
    .all();
  const assignments: { discordUserId: string; leagueNumber: number }[] = [];
  for (const row of rows) {
    if (row.isTest) continue;
    if (row.movement === "promote") {
      assignments.push({
        discordUserId: row.discordUserId,
        leagueNumber: row.leagueNumber - 1,
      });
    } else if (row.movement === "demote") {
      assignments.push({
        discordUserId: row.discordUserId,
        leagueNumber: row.leagueNumber + 1,
      });
    }
  }
  return assignments;
}

export function relegateGuild(
  guildId: string,
  leagueNumbers: readonly number[],
  force = false
) {
  return getDatabase().transaction(
    (tx) => {
      const week =
        tx.select().from(guilds).where(eq(guilds.id, guildId)).get()
          ?.currentWeek ?? 1;
      const guildCompetitions = tx
        .select()
        .from(competitions)
        .where(eq(competitions.guildId, guildId))
        .all();
      const skipped: {
        leagueNumber: number;
        reason: "missing" | "active" | "processed";
      }[] = [];
      const eligible: (typeof competitions.$inferSelect)[] = [];
      for (const leagueNumber of new Set(leagueNumbers)) {
        const leagueCompetitions = guildCompetitions.filter(
          (competition) => competition.leagueNumber === leagueNumber
        );
        const current = leagueCompetitions.find(
          (competition) => competition.weekNumber === week
        );
        if (
          leagueCompetitions.some(
            (competition) => competition.status === "active"
          )
        ) {
          skipped.push({ leagueNumber, reason: "active" });
        } else if (!current) {
          skipped.push({ leagueNumber, reason: "missing" });
        } else if (current.hasUsedRelegate) {
          skipped.push({ leagueNumber, reason: "processed" });
        } else {
          eligible.push(current);
        }
      }
      if (!force && skipped.some((league) => league.reason !== "processed")) {
        return { status: "blocked", week, skipped } as const;
      }

      // Read every league's history before changing any memberships or retained percentages.
      const calculations = eligible.map((competition) => {
        const { registered, participants } = getMovementParticipants(
          competition.id
        )!;
        const decisions =
          competition.leagueNumber === 7
            ? calculateLeague7Qualification(participants)
            : calculateLeagueMovement(competition.leagueNumber, participants);
        return { competition, decisions, registered };
      });

      const processed = [];
      const roleAssignments: { discordUserId: string; leagueNumber: number }[] =
        [];
      for (const { competition, decisions, registered } of calculations) {
        const playerUpdates = new Map<
          number,
          {
            leagueTier: number;
            percentageHistory: {
              week: number;
              league: number;
              percentage: number;
            }[];
          }
        >();
        // Absent registrations get an explicit no-movement decision, but no average.
        tx.update(registrations)
          .set({ movement: "none", currentPercentage: null, averageUsed: null })
          .where(eq(registrations.competitionId, competition.id))
          .run();
        for (const decision of decisions) {
          tx.update(registrations)
            .set({
              currentPercentage: decision.percentage,
              averageUsed: decision.averageUsed,
              movement: decision.movement,
            })
            .where(eq(registrations.id, decision.registrationId))
            .run();
          const registration = registered.get(decision.registrationId)!;
          const history = registration.percentageHistory ?? [];
          const update: Pick<
            typeof players.$inferInsert,
            "percentageHistory" | "leagueNumber"
          > = {};
          if (decision.movement === "promote") {
            update.percentageHistory = [];
            update.leagueNumber = competition.leagueNumber - 1;
          } else if (decision.movement === "demote") {
            update.percentageHistory = [
              { week, league: competition.leagueNumber, percentage: 85 },
            ];
            update.leagueNumber = competition.leagueNumber + 1;
          } else if (decision.percentage !== null) {
            update.percentageHistory = [
              ...history,
              {
                week,
                league: competition.leagueNumber,
                percentage: decision.percentage,
              },
            ].slice(-3);
          } else {
            // Nonqualifying League 7 players have no percentage history to append.
            continue;
          }
          const updated = tx
            .update(players)
            .set(update)
            .where(
              and(
                eq(players.guildId, guildId),
                eq(players.discordUserId, registration.discordUserId),
                eq(players.minecraftUuid, registration.minecraftUuid),
                // Ended snapshots must never modify a subsequently migrated account.
                eq(players.accountVersion, registration.accountVersion)
              )
            )
            .returning({
              discordUserId: players.discordUserId,
              isTest: players.isTest,
              leagueNumber: players.leagueNumber,
              percentageHistory: players.percentageHistory,
            })
            .get();
          if (updated && updated.leagueNumber !== null)
            playerUpdates.set(registration.id, {
              leagueTier: updated.leagueNumber,
              percentageHistory: updated.percentageHistory,
            });
          if (updated && !updated.isTest && update.leagueNumber !== undefined) {
            roleAssignments.push({
              discordUserId: updated.discordUserId,
              leagueNumber: update.leagueNumber!,
            });
          }
        }
        tx.update(competitions)
          .set({ hasUsedRelegate: true })
          .where(eq(competitions.id, competition.id))
          .run();
        const decisionById = new Map(
          decisions.map((decision) => [decision.registrationId, decision])
        );
        processed.push({
          movements: [...registered.values()].map((registration) => {
            const decision = decisionById.get(registration.id);
            const playerUpdate = playerUpdates.get(registration.id);
            return {
              uuid: registration.minecraftUuid,
              movementStatus: websiteMovementStatus(decision?.movement),
              currentPercentage: decision?.percentage ?? null,
              averagePercentage: decision?.averageUsed ?? null,
              ...(playerUpdate ? { playerUpdate } : {}),
            };
          }),
          leagueNumber: competition.leagueNumber,
          promoted: decisions.filter(
            (decision) => decision.movement === "promote"
          ).length,
          demoted: decisions.filter(
            (decision) => decision.movement === "demote"
          ).length,
        });
      }
      return {
        status: "processed",
        week,
        processed,
        skipped,
        roleAssignments,
      } as const;
    },
    { behavior: "immediate" }
  );
}
