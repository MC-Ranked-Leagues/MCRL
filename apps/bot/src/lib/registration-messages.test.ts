import { registerPlayer } from "../db/registrations";
import { beforeEach, expect, test } from "bun:test";
import { updateRegistrationMessages } from "./registration-messages";
import { eq } from "drizzle-orm";
import {
  getActiveCompetition,
  getCompetitionRegistration,
  startCompetition,
  toggleRegistration,
} from "../db/competitions";
import { formatRegistrationMessages } from "./registration-messages";
import { registrations, players } from "../db/schema";
import {
  resetDatabase,
  database,
  input,
  deleteCompetition,
  registrationChannel,
  setupMatchPlayers,
} from "../testing/competition";

beforeEach(resetDatabase);

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
  deleteCompetition(input.guildId, active.id);
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
  expect(content).toContain("2. PeakLeader - Peak Elo: 2000");
  expect(content).toContain("5. Unrated - unrated");
});

test("registration history display keeps existing Elo order and distinguishes 0% from no history", () => {
  const competition = setupMatchPlayers();
  database
    .update(players)
    .set({ percentageHistory: [{ week: 1, league: 5, percentage: 0 }] })
    .where(eq(players.discordUserId, "player1"))
    .run();
  const data = getCompetitionRegistration(competition.id)!;
  const before = data.players.map((player) => player.id);
  const content = formatRegistrationMessages(data).join("\n");
  expect(content).toContain("PreAvg: No history");
  expect(content).toContain("PreAvg: 0% (0%)");
  data.players[0]!.percentageHistory = [
    { week: 1, league: 5, percentage: 99 },
    { week: 2, league: 5, percentage: 50 },
    { week: 3, league: 5, percentage: 20 },
  ];
  expect(formatRegistrationMessages(data).join("\n")).toContain(
    "PreAvg: 35% (50%, 20%)"
  );
  expect(
    getCompetitionRegistration(competition.id)!.players.map(
      (player) => player.id
    )
  ).toEqual(before);
});
