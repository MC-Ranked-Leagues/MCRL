import { importMatch, type RankedMatchInput } from "../db/matches";
import { registerPlayer } from "../db/registrations";
import { expect } from "bun:test";
import { type SendableChannels } from "discord.js";
import { and, eq } from "drizzle-orm";
import { applyDatabaseMigrations } from "../../scripts/migrate-database";
import { getDatabase } from "../db";
import {
  endCompetition,
  getActiveCompetition,
  startCompetition,
  toggleRegistration,
} from "../db/competitions";
import { competitions, players, accountMigrations, guilds } from "../db/schema";

// Open the lazy database connection in memory, using the real migrations and constraints.
const previousDatabase = process.env.DB_FILE_NAME;

process.env.DB_FILE_NAME = ":memory:";

applyDatabaseMigrations();

export const database = getDatabase();
if (previousDatabase === undefined) delete process.env.DB_FILE_NAME;
else process.env.DB_FILE_NAME = previousDatabase;

export const input = {
  guildId: "test-guild",
  leagueNumber: 5,
  weekNumber: 1,
  maxTimeLimitMs: 1000,
  startedAt: new Date(),
};

export function deleteCompetition(
  guildId: string,
  competitionId: number
): boolean {
  return (
    database
      .delete(competitions)
      .where(
        and(
          eq(competitions.guildId, guildId),
          eq(competitions.id, competitionId)
        )
      )
      .returning({ id: competitions.id })
      .get() !== undefined
  );
}

export function resetDatabase() {
  input.guildId = "test-guild";
  database.delete(competitions).run();
  database.delete(players).run();
  database.delete(accountMigrations).run();
  database.delete(guilds).run();
}

// Only emulate the Discord methods the updater uses; all persistence uses real SQLite.
export function registrationChannel() {
  const messages = new Map<string, string>();
  let nextId = 1;
  const channel = {
    isSendable: () => true,
    async send({ content }: { content: string }) {
      const id = String(nextId++);
      messages.set(id, content);
      return { id };
    },
    messages: {
      async fetch(id: string) {
        if (!messages.has(id)) throw new Error("Unexpected message ID");
        return {
          async edit({ content }: { content: string }) {
            messages.set(id, content);
          },
          async delete() {
            messages.delete(id);
          },
        };
      },
    },
  };
  return {
    channel: channel as unknown as SendableChannels,
    messages,
    rawChannel: channel,
  };
}

export function setupMatchPlayers(count = 6) {
  startCompetition(input);
  const competition = getActiveCompetition(input.guildId, 5)!;
  for (let index = 0; index < count; index++) {
    registerPlayer(
      {
        competitionId: competition.id,
        discordUserId: `player${index}`,
        discordUsername: `player${index}`,
        minecraftUuid: `uuid${index}`,
        ign: `Player${index}`,
        registeredAt: new Date(),
      },
      { mode: "admin" }
    );
  }
  return competition;
}

export function rankedMatch(id = 100): RankedMatchInput {
  return {
    id,
    players: [0, 1, 2, 3, 4, 99].map((index) => ({
      uuid: `uuid${index}`,
      nickname: `Player${index}`,
      roleType: 0,
      eloRate: null,
      eloRank: null,
      country: null,
    })),
    // Player 3 exceeds the limit, Player 4 has no completion, and Player 5 is absent.
    completions: [
      { uuid: "UUID-0", time: 500 },
      { uuid: "uuid1", time: 500 },
      { uuid: "uuid2", time: 1000 },
      { uuid: "uuid3", time: 1001 },
      { uuid: "uuid99", time: 100 },
    ],
  };
}

export function registerMember() {
  startCompetition(input);
  toggleRegistration(input.guildId, input.leagueNumber);
  const competition = getActiveCompetition(input.guildId, input.leagueNumber)!;
  const registration = {
    competitionId: competition.id,
    discordUserId: "member",
    discordUsername: "member",
    minecraftUuid: "AB-CD",
    ign: "OldName",
    registeredAt: new Date(),
  };
  expect(registerPlayer(registration)).toBe("registered");
  return { competition, registration };
}

export const migrationInput = {
  guildId: input.guildId,
  discordUserId: "member",
  discordUsername: "member",
  minecraftUuid: "new-uuid",
  ign: "NewName",
  reviewerId: "host",
};

export function endedMovementCompetition(leagueNumber = 5, weekNumber = 1) {
  startCompetition({ ...input, leagueNumber, weekNumber });
  const competition = getActiveCompetition(input.guildId, leagueNumber)!;
  const matchPlayers = Array.from({ length: 8 }, (_, index) => ({
    uuid: `league${leagueNumber}player${index}`,
    nickname: `Player${index}`,
    roleType: 0,
    eloRate: null,
    eloRank: null,
    country: null,
  }));
  for (const player of matchPlayers) {
    expect(
      registerPlayer(
        {
          competitionId: competition.id,
          discordUserId: player.uuid,
          minecraftUuid: player.uuid,
          discordUsername: player.nickname,
          ign: player.nickname,
          registeredAt: new Date(),
        },
        { mode: "admin" }
      )
    ).toBe("registered");
  }
  importMatch(competition.id, {
    id: leagueNumber * 100 + weekNumber,
    players: matchPlayers.slice(0, 7),
    completions: matchPlayers
      .slice(0, 6)
      .map((player, index) => ({ uuid: player.uuid, time: 100 + index * 100 })),
  });
  expect(endCompetition(input.guildId, competition.id).status).toBe("ended");
  return competition;
}
