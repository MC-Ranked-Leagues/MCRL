import { registerPlayer } from "./registrations";
import { afterAll, beforeEach, expect, test } from "bun:test";
import type { SendableChannels } from "discord.js";
import { updateRegistrationMessages } from "../lib/registration-messages";
import { eq } from "drizzle-orm";

import { applyDatabaseMigrations } from "../../scripts/migrate-database";
import { getDatabase } from ".";
import {
  deleteActiveCompetition,
  getActiveCompetition,
  getCompetitionRegistration,
  startCompetition,
  toggleRegistration,
} from "./competitions";
import { competitions, registrations, matches, matchResults } from "./schema";

// Open the lazy database connection in memory, using the real migrations and constraints.
const previousDatabase = process.env.DB_FILE_NAME;
process.env.DB_FILE_NAME = ":memory:";
applyDatabaseMigrations();
const database = getDatabase();
const input = {
  guildId: "test-guild",
  leagueNumber: 5,
  weekNumber: 1,
  maxTimeLimitMs: 1000,
  startedAt: new Date(),
};

beforeEach(() => {
  database.delete(competitions).run();
});

afterAll(() => {
  database.$client.close();
  if (previousDatabase === undefined) delete process.env.DB_FILE_NAME;
  else process.env.DB_FILE_NAME = previousDatabase;
});

test("only one active week per guild and league, while ended weeks remain unique", () => {
  expect(startCompetition(input)).toBe(true);
  expect(startCompetition({ ...input, weekNumber: 2 })).toBe(false);
  expect(startCompetition({ ...input, leagueNumber: 6 })).toBe(true);
  expect(startCompetition({ ...input, guildId: "other-guild" })).toBe(true);
  const active = getActiveCompetition(input.guildId, 5)!;
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(startCompetition(input)).toBe(false);
  expect(startCompetition({ ...input, weekNumber: 2 })).toBe(true);
});

test("registration toggles only the active competition in the requested guild and league", () => {
  expect(toggleRegistration(input.guildId, 5)).toBeUndefined();
  startCompetition(input);
  startCompetition({ ...input, guildId: "other-guild" });
  expect(toggleRegistration(input.guildId, 5)?.registrationOpen).toBe(true);
  expect(getActiveCompetition("other-guild", 5)?.registrationOpen).toBe(false);
  expect(toggleRegistration(input.guildId, 5)?.registrationOpen).toBe(false);
});

test("deletion cascades and an old confirmation cannot delete a replacement competition", () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  // Build the full dependency chain to exercise cascading deletion through results.
  const registration = database
    .insert(registrations)
    .values({
      competitionId: active.id,
      discordUserId: "user",
      discordUsername: "player",
      minecraftUuid: "uuid",
      ign: "player",
      registeredAt: new Date(),
    })
    .returning()
    .get();
  const match = database
    .insert(matches)
    .values({
      competitionId: active.id,
      number: 1,
      participantCount: 1,
      timeLimitMs: 1000,
      createdAt: new Date(),
    })
    .returning()
    .get();
  database
    .insert(matchResults)
    .values({ matchId: match.id, registrationId: registration.id })
    .run();
  expect(deleteActiveCompetition("other-guild", active.id)).toBe(false);
  expect(deleteActiveCompetition(input.guildId, active.id)).toBe(true);
  expect(database.select().from(registrations).all()).toHaveLength(0);
  expect(database.select().from(matches).all()).toHaveLength(0);
  expect(database.select().from(matchResults).all()).toHaveLength(0);
  // Recreate the same week, then simulate confirming the old deletion prompt.
  expect(startCompetition(input)).toBe(true);
  expect(deleteActiveCompetition(input.guildId, active.id)).toBe(false);
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
});

test("an ended competition cannot be deleted through an active-competition confirmation", () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(deleteActiveCompetition(input.guildId, active.id)).toBe(false);
});

// Only emulate the Discord methods the updater uses; all persistence uses real SQLite.
function registrationChannel() {
  const messages = new Map<string, string>();
  let nextId = 1;
  const channel = {
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
  return { channel: channel as unknown as SendableChannels, messages };
}

test("registration toggles edit tracked messages and cleanup preserves Discord history", async () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  const { channel, messages } = registrationChannel();
  expect(active.registrationMessageIds).toEqual([]);
  await updateRegistrationMessages(channel, active.id);
  const ids = getActiveCompetition(input.guildId, 5)!.registrationMessageIds;
  expect(ids).toHaveLength(1);
  expect(messages.get(ids[0]!)).toContain("Registration: **OFF**");
  toggleRegistration(input.guildId, 5);
  await updateRegistrationMessages(channel, active.id);
  expect(
    getActiveCompetition(input.guildId, 5)!.registrationMessageIds
  ).toEqual(ids);
  expect(messages.size).toBe(1);
  expect(messages.get(ids[0]!)).toContain("Registration: **ON**");

  // A replacement competition gets its own list; the old week's messages remain.
  deleteActiveCompetition(input.guildId, active.id);
  startCompetition(input);
  await updateRegistrationMessages(
    channel,
    getActiveCompetition(input.guildId, 5)!.id
  );
  expect(messages.size).toBe(2);
  expect(messages.has(ids[0]!)).toBe(true);
});

test("overlapping updates share message IDs and long registrations use tracked overflow", async () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  for (let i = 0; i < 100; i++) {
    database
      .insert(registrations)
      .values({
        competitionId: active.id,
        discordUserId: `user-${i}`,
        discordUsername: `discord-player-${i}`,
        minecraftUuid: `uuid-${i}`,
        ign: `minecraft-${i}`,
        registeredAt: new Date(),
      })
      .run();
  }
  const { channel, messages } = registrationChannel();
  await Promise.all([
    updateRegistrationMessages(channel, active.id),
    updateRegistrationMessages(channel, active.id),
  ]);
  const ids = getActiveCompetition(input.guildId, 5)!.registrationMessageIds;
  expect(ids.length).toBeGreaterThan(1);
  expect(messages.size).toBe(ids.length);
  expect(
    [...messages.values()].every((content) => content.length <= 2000)
  ).toBe(true);
  expect([...messages.values()].join("\n")).toContain("100.");

  // Shrinking the list removes only surplus chunks, retaining the first message.
  database
    .delete(registrations)
    .where(eq(registrations.competitionId, active.id))
    .run();
  await updateRegistrationMessages(channel, active.id);
  expect(
    getActiveCompetition(input.guildId, 5)!.registrationMessageIds
  ).toEqual([ids[0]!]);
  expect(messages.size).toBe(1);
});

test("registration saves the account snapshot and rejects duplicate users and accounts", () => {
  startCompetition(input);
  toggleRegistration(input.guildId, 5);
  const active = getActiveCompetition(input.guildId, 5)!;
  const player = {
    competitionId: active.id,
    discordUserId: "discord-1",
    discordUsername: "player",
    minecraftUuid: "minecraft-1",
    ign: "MinecraftPlayer",
    elo: null,
    peakElo: 1800,
    registeredAt: new Date(),
  };
  expect(registerPlayer(player)).toBe("registered");
  expect(registerPlayer({ ...player, minecraftUuid: "another-account" })).toBe(
    "already_registered"
  );
  expect(registerPlayer({ ...player, discordUserId: "another-user" })).toBe(
    "account_registered"
  );
  const saved = database.select().from(registrations).all();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    minecraftUuid: "minecraft-1",
    ign: "MinecraftPlayer",
    elo: null,
    peakElo: 1800,
  });
});

test("registration messages rank peak Elo above current Elo and keep unrated players last", async () => {
  startCompetition(input);
  toggleRegistration(input.guildId, 5);
  const active = getActiveCompetition(input.guildId, 5)!;
  // Insert in a different order, with current ratings that disagree with peak ratings.
  const players = [
    { ign: "Unrated", elo: null, peakElo: null },
    { ign: "CurrentLeader", elo: 1700, peakElo: 1800 },
    { ign: "PeakLeader", elo: 1200, peakElo: 2000 },
    { ign: "Legacy", elo: 1600, peakElo: null },
    { ign: "AnotherPeak", elo: 1500, peakElo: 2000 },
  ];
  for (const player of players) {
    expect(
      registerPlayer({
        ...player,
        competitionId: active.id,
        discordUserId: player.ign,
        discordUsername: player.ign,
        minecraftUuid: player.ign,
        registeredAt: new Date(),
      })
    ).toBe("registered");
  }
  expect(
    getCompetitionRegistration(active.id)!.players.map((player) => player.ign)
  ).toEqual([
    "AnotherPeak",
    "PeakLeader",
    "CurrentLeader",
    "Legacy",
    "Unrated",
  ]);
  const { channel, messages } = registrationChannel();
  await updateRegistrationMessages(channel, active.id);
  const content = [...messages.values()].join("\n");
  expect(content).toContain("2. PeakLeader (PeakLeader) | Peak Elo: 2000");
  expect(content).toContain("5. Unrated (Unrated) | unrated");
});

test("registration rechecks closure and never switches to a replacement competition after an API lookup", () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  const player = {
    competitionId: active.id,
    discordUserId: "discord-1",
    discordUsername: "player",
    minecraftUuid: "minecraft-1",
    ign: "MinecraftPlayer",
    elo: 1500,
    registeredAt: new Date(),
  };
  expect(registerPlayer(player)).toBe("closed");
  toggleRegistration(input.guildId, 5);
  // Simulate a host closing registration while the command awaits the Ranked API.
  toggleRegistration(input.guildId, 5);
  expect(registerPlayer(player)).toBe("closed");
  deleteActiveCompetition(input.guildId, active.id);
  startCompetition({ ...input, weekNumber: 2 });
  toggleRegistration(input.guildId, 5);
  expect(registerPlayer(player)).toBe("inactive");
  expect(database.select().from(registrations).all()).toHaveLength(0);
  const replacement = getActiveCompetition(input.guildId, 5)!;
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, replacement.id))
    .run();
  expect(registerPlayer({ ...player, competitionId: replacement.id })).toBe(
    "inactive"
  );
});
