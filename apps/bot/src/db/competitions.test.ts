import {
  assignPlayerLeague,
  createSignup,
  decideSignup,
  getPlayer,
  setPlayerTwitchUsername,
} from "./players";
import {
  createMigration,
  decideMigration,
  getMigrationHistory,
  getMigration,
  setTestMigrationAccount,
} from "./account-migrations";
import { guildConfiguration } from "../../config/guilds";
import {
  clearMatch,
  getCompetitionStandings,
  importMatch,
  type RankedMatchInput,
} from "./matches";
import { replyWithCompetitionUpdate } from "../lib/competition-messages";
import {
  formatLeaderboardMessages,
  updateLeaderboardMessages,
} from "../lib/leaderboard-messages";
import {
  clearTestRegistrations,
  fillTestRegistrations,
  registerPlayer,
  unregisterPlayer,
} from "./registrations";
import { afterAll, beforeEach, expect, spyOn, test } from "bun:test";
import {
  Collection,
  type ChatInputCommandInteraction,
  type SendableChannels,
} from "discord.js";
import { relegateCommand } from "../commands/relegate";
import { updateRegistrationMessages } from "../lib/registration-messages";
import { and, eq } from "drizzle-orm";
import { devChangeWeekCommand } from "../commands/dev-change-week";
import { nmCommand } from "../commands/nm";

import { applyDatabaseMigrations } from "../../scripts/migrate-database";
import { getDatabase } from ".";
import {
  advanceGuildWeek,
  endCompetition,
  getActiveCompetition,
  getCompetitionExport,
  getLatestEndedCompetition,
  getCompetitionRegistration,
  getAdvanceWeekPreview,
  startCompetition,
  toggleRegistration,
  unendCompetition,
} from "./competitions";
import { getCurrentWeek, setCurrentWeek } from "./guilds";
import { getCompetitionMovement, relegateGuild } from "./relegation";
import { formatRegistrationMessages } from "../lib/registration-messages";
import {
  competitions,
  registrations,
  matches,
  matchResults,
  players,
  accountMigrations,
  guilds,
} from "./schema";

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

function deleteCompetition(guildId: string, competitionId: number): boolean {
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

beforeEach(() => {
  database.delete(competitions).run();
  database.delete(players).run();
  database.delete(accountMigrations).run();
  database.delete(guilds).run();
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
  expect(toggleRegistration(input.guildId, 5)).toMatchObject({
    registrationOpen: true,
  });
  expect(getActiveCompetition("other-guild", 5)?.registrationOpen).toBe(false);
  expect(toggleRegistration(input.guildId, 5)).toMatchObject({
    registrationOpen: false,
  });
});

test("guild weeks default to one and can be explicitly changed", () => {
  expect(getCurrentWeek(input.guildId)).toBe(1);
  setCurrentWeek(input.guildId, 8);
  expect(getCurrentWeek(input.guildId)).toBe(8);
  expect(() => setCurrentWeek(input.guildId, 0)).toThrow();
  expect(() => setCurrentWeek(input.guildId, 1.5)).toThrow();
});

test("the developer week command denies other users and changes only the stored week", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[guildId]!;
  const mutableConfig = config as typeof config & { developerId?: string };
  const previousDeveloperId = mutableConfig.developerId;
  const replies: string[] = [];
  const interaction = {
    guildId,
    user: { id: "other-user" },
    options: { getInteger: () => 6 },
    editReply: async (message: string) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;

  try {
    mutableConfig.developerId = "developer";
    await devChangeWeekCommand.execute(interaction);
    expect(replies.at(-1)).toBe("Only the configured developer can do this.");
    expect(getCurrentWeek(guildId)).toBe(1);

    await devChangeWeekCommand.execute({
      ...interaction,
      user: { id: "developer" },
    } as unknown as ChatInputCommandInteraction<"cached">);
    expect(getCurrentWeek(guildId)).toBe(6);
    expect(replies.at(-1)).toContain("from 1 to 6");
  } finally {
    mutableConfig.developerId = previousDeveloperId;
  }
});

test("new competitions use the stored guild week", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[guildId]!;
  const [leagueNumberText, league] = Object.entries(config.leagues)[0]!;
  const leagueNumber = Number(leagueNumberText);
  const { channel } = registrationChannel();
  const replies: string[] = [];
  setCurrentWeek(guildId, 12);

  await nmCommand.execute({
    guildId,
    channelId: league.infoChannelId,
    member: { roles: { cache: { has: () => true } } },
    guild: { channels: { fetch: async () => channel } },
    editReply: async (message: string) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">);

  expect(getActiveCompetition(guildId, leagueNumber)?.weekNumber).toBe(12);
  expect(replies.at(-1)).toContain("Week 12");
});

test("week advancement requires relegation unless forced", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  const preview = getAdvanceWeekPreview(input.guildId);

  expect(preview.competitions[0]?.hasUsedRelegate).toBe(false);
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, false)).toBe(
    "unprocessed"
  );
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "advanced"
  );
  expect(getCurrentWeek(input.guildId)).toBe(5);
});

test("week cleanup uses completion flags and cascades results while preserving player history", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  startCompetition({ ...input, guildId: "other-guild" });
  const competition = getActiveCompetition(input.guildId, 5)!;
  database
    .update(competitions)
    .set({ hasUsedRelegate: true })
    .where(eq(competitions.id, competition.id))
    .run();
  const preview = getAdvanceWeekPreview(input.guildId);
  const registration = database
    .insert(registrations)
    .values({
      competitionId: competition.id,
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
      competitionId: competition.id,
      number: 1,
      timeLimitMs: 1000,
      createdAt: new Date(),
    })
    .returning()
    .get();
  database
    .insert(matchResults)
    .values({ matchId: match.id, registrationId: registration.id, points: 5 })
    .run();
  database
    .insert(players)
    .values({
      guildId: input.guildId,
      discordUserId: "user",
      discordUsername: "player",
      minecraftUuid: "uuid",
      ign: "player",
      percentageHistory: [{ week: 3, league: 5, percentage: 2 }],
    })
    .run();

  expect(advanceGuildWeek(input.guildId, preview.currentWeek, false)).toBe(
    "advanced"
  );
  expect(database.select().from(registrations).all()).toEqual([]);
  expect(database.select().from(matches).all()).toEqual([]);
  expect(database.select().from(matchResults).all()).toEqual([]);
  expect(getActiveCompetition("other-guild", 5)).toBeDefined();
  expect(getPlayer(input.guildId, "user")?.percentageHistory).toEqual([
    { week: 3, league: 5, percentage: 2 },
  ]);
});

test("a newly unprocessed competition blocks confirmed advancement", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  database
    .update(competitions)
    .set({ hasUsedRelegate: true })
    .where(eq(competitions.guildId, input.guildId))
    .run();
  const preview = getAdvanceWeekPreview(input.guildId);
  startCompetition({ ...input, leagueNumber: 6, weekNumber: 4 });

  expect(advanceGuildWeek(input.guildId, preview.currentWeek, false)).toBe(
    "unprocessed"
  );
  expect(getAdvanceWeekPreview(input.guildId).competitions).toHaveLength(2);
});

test("a stale week blocks forced and repeated advancement", () => {
  setCurrentWeek(input.guildId, 4);
  startCompetition({ ...input, weekNumber: 4 });
  const preview = getAdvanceWeekPreview(input.guildId);
  setCurrentWeek(input.guildId, 5);
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "stale_week"
  );
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
  setCurrentWeek(input.guildId, 4);
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "advanced"
  );
  expect(advanceGuildWeek(input.guildId, preview.currentWeek, true)).toBe(
    "stale_week"
  );
  expect(getCurrentWeek(input.guildId)).toBe(5);
});

// Only emulate the Discord methods the updater uses; all persistence uses real SQLite.
function registrationChannel() {
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
    "account_mismatch"
  );
  expect(registerPlayer({ ...player, discordUserId: "another-user" })).toBe(
    "account_owned"
  );
  const saved = database.select().from(registrations).all();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    minecraftUuid: "minecraft1",
    ign: "MinecraftPlayer",
    elo: null,
    peakElo: 1800,
  });
});

test("competition exports read the current Twitch username for streaming registrations", () => {
  startCompetition(input);
  toggleRegistration(input.guildId, 5);
  const active = getActiveCompetition(input.guildId, 5)!;
  for (const registration of [
    {
      discordUserId: "streamer",
      ign: "Streamer",
      streaming: true,
    },
    {
      discordUserId: "private",
      ign: "PrivatePlayer",
      streaming: false,
    },
  ]) {
    expect(
      registerPlayer(
        {
          ...registration,
          competitionId: active.id,
          discordUsername: registration.discordUserId,
          minecraftUuid: registration.discordUserId,
          registeredAt: new Date(),
        },
        registration.streaming
          ? { twitch: `${registration.discordUserId}_linked` }
          : undefined
      )
    ).toBe("registered");
    expect(
      setPlayerTwitchUsername(
        input.guildId,
        registration.discordUserId,
        `${registration.discordUserId}_live`
      )
    ).toBe(true);
  }

  expect(
    getCompetitionExport(active.id)!.players.map((player) => ({
      ign: player.ign,
      streaming: player.streaming,
      twitch: player.twitch,
    }))
  ).toEqual([
    {
      ign: "PrivatePlayer",
      streaming: false,
      twitch: "private_live",
    },
    {
      ign: "Streamer",
      streaming: true,
      twitch: "streamer_live",
    },
  ]);
  expect(
    setPlayerTwitchUsername(input.guildId, "streamer", "new_channel")
  ).toBe(true);
  expect(
    getCompetitionExport(active.id)!.players.find(
      (player) => player.ign === "Streamer"
    )?.twitch
  ).toBe("new_channel");
  expect(setPlayerTwitchUsername(input.guildId, "missing", "no_account")).toBe(
    false
  );
});

test("streaming registration requires and saves a resolved Twitch username", () => {
  startCompetition(input);
  toggleRegistration(input.guildId, 5);
  const active = getActiveCompetition(input.guildId, 5)!;
  const registration = {
    competitionId: active.id,
    discordUserId: "streamer",
    discordUsername: "streamer",
    minecraftUuid: "streamer",
    ign: "Streamer",
    streaming: true,
    registeredAt: new Date(),
  };

  expect(registerPlayer(registration)).toBe("twitch_required");
  expect(getPlayer(input.guildId, "streamer")).toBeUndefined();
  expect(registerPlayer(registration, { twitch: "linked_channel" })).toBe(
    "registered"
  );
  expect(getPlayer(input.guildId, "streamer")?.twitch).toBe("linked_channel");

  expect(
    assignPlayerLeague(input.guildId, "saved-streamer", 5, {
      discordUsername: "saved-streamer",
      minecraftUuid: "saved-streamer",
      ign: "SavedStreamer",
    })
  ).toBe("assigned");
  expect(
    setPlayerTwitchUsername(input.guildId, "saved-streamer", "saved_channel")
  ).toBe(true);
  expect(
    registerPlayer(
      {
        ...registration,
        discordUserId: "saved-streamer",
        discordUsername: "saved-streamer",
        minecraftUuid: "saved-streamer",
        ign: "SavedStreamer",
      },
      { twitch: "linked_channel" }
    )
  ).toBe("registered");
  expect(getPlayer(input.guildId, "saved-streamer")?.twitch).toBe(
    "saved_channel"
  );
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
  deleteCompetition(input.guildId, active.id);
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

test("admin registration bypasses closure but retains duplicate and active competition checks", () => {
  startCompetition(input);
  const active = getActiveCompetition(input.guildId, 5)!;
  const player = {
    competitionId: active.id,
    discordUserId: "user",
    discordUsername: "player",
    minecraftUuid: "uuid",
    ign: "Player",
    registeredAt: new Date(),
  };
  expect(registerPlayer(player)).toBe("closed");
  expect(registerPlayer(player, { mode: "admin" })).toBe("registered");
  expect(registerPlayer(player, { mode: "admin" })).toBe("already_registered");
  expect(
    registerPlayer({ ...player, discordUserId: "other" }, { mode: "admin" })
  ).toBe("account_owned");
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(registerPlayer(player, { mode: "admin" })).toBe("inactive");
  expect(unregisterPlayer(active.id, "user", { admin: true }).status).toBe(
    "inactive"
  );
});

test("self unregistration requires open registration and preserves registrations in other competitions", async () => {
  startCompetition(input);
  startCompetition({ ...input, leagueNumber: 6 });
  const active = getActiveCompetition(input.guildId, 5)!;
  const other = getActiveCompetition(input.guildId, 6)!;
  for (const competitionId of [active.id, other.id]) {
    if (competitionId === other.id)
      assignPlayerLeague(input.guildId, "user", 6);
    registerPlayer(
      {
        competitionId,
        discordUserId: "user",
        discordUsername: "player",
        minecraftUuid: "uuid",
        ign: "Player",
        registeredAt: new Date(),
      },
      { mode: "admin" }
    );
  }
  expect(unregisterPlayer(active.id, "unknown").status).toBe("not_registered");
  expect(unregisterPlayer(active.id, "user").status).toBe("closed");
  toggleRegistration(input.guildId, 5);
  const { channel, messages } = registrationChannel();
  await updateRegistrationMessages(channel, active.id);
  expect(unregisterPlayer(active.id, "user")).toEqual({
    status: "unregistered",
    ign: "Player",
  });
  await updateRegistrationMessages(channel, active.id);
  expect([...messages.values()].join("\n")).toContain(
    "No registered players yet."
  );
  expect(getCompetitionRegistration(other.id)!.players).toHaveLength(1);
  expect(unregisterPlayer(active.id, "user").status).toBe("not_registered");
  expect(unregisterPlayer(other.id, "user", { admin: true }).status).toBe(
    "unregistered"
  );
});

test("imported results block self removal, while admin removal cascades only the target player's results", () => {
  startCompetition(input);
  toggleRegistration(input.guildId, 5);
  const active = getActiveCompetition(input.guildId, 5)!;
  for (const discordUserId of ["user", "other"]) {
    registerPlayer({
      competitionId: active.id,
      discordUserId,
      discordUsername: discordUserId,
      minecraftUuid: discordUserId,
      ign: discordUserId,
      registeredAt: new Date(),
    });
  }
  const players = getCompetitionRegistration(active.id)!.players;
  const match = database
    .insert(matches)
    .values({
      competitionId: active.id,
      number: 1,
      timeLimitMs: 1000,
      imported: true,
      createdAt: new Date(),
    })
    .returning()
    .get();
  // A DNF still counts as an imported result and must not let a player erase it.
  for (const player of players)
    database
      .insert(matchResults)
      .values({ matchId: match.id, registrationId: player.id, status: "dnf" })
      .run();
  expect(unregisterPlayer(active.id, "user").status).toBe("has_results");
  expect(database.select().from(matchResults).all()).toHaveLength(2);
  expect(unregisterPlayer(active.id, "user", { admin: true }).status).toBe(
    "unregistered"
  );
  expect(database.select().from(matchResults).all()).toHaveLength(1);
  expect(database.select().from(matches).all()).toHaveLength(1);
  expect(getCompetitionRegistration(active.id)!.players[0]!.discordUserId).toBe(
    "other"
  );
});

function setupMatchPlayers(count = 6) {
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

function rankedMatch(id = 100): RankedMatchInput {
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

test("imports rank only registered finishers, share tied places, and distinguish DNF from missed", () => {
  const competition = setupMatchPlayers();
  expect(importMatch(competition.id, rankedMatch())).toEqual({
    status: "imported",
    number: 1,
    matched: 5,
    total: 6,
    unmatched: ["Player99"],
  });
  const results = database.select().from(matchResults).all();
  expect(
    results.map((row) => [row.status, row.placement, row.points, row.timeMs])
  ).toEqual([
    ["finished", 1, 8, 500],
    ["finished", 1, 8, 500],
    ["finished", 3, 2, 1000],
    ["dnf", null, 0, null],
    ["dnf", null, 0, null],
    ["missed", null, 0, null],
  ]);
  expect(results[4]!.submittedAt).toBeInstanceOf(Date);
  expect(results[5]!.submittedAt).toBeNull();
  const standings = getCompetitionStandings(competition.id)!.standings;
  expect(standings.map((player) => player.ign)).toEqual([
    "Player0",
    "Player1",
    "Player2",
    "Player3",
    "Player4",
  ]);
  expect(standings[3]).toMatchObject({ played: 1, averageTimeMs: 1000 });
});

test("explicit import replaces all results, creates exact numbers, and next uses the largest number", () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch(), 4);
  const original = database.select().from(matches).get()!;
  const replacement = rankedMatch(101);
  replacement.completions = [{ uuid: "uuid4", time: 200 }];
  expect(importMatch(competition.id, replacement, 4).status).toBe("imported");
  expect(database.select().from(matches).all()).toHaveLength(1);
  expect(database.select().from(matches).get()).toMatchObject({
    id: original.id,
    rankedMatchId: "101",
    number: 4,
  });
  const results = database.select().from(matchResults).all();
  expect(results).toHaveLength(6);
  expect(results.filter((row) => row.status === "finished")).toHaveLength(1);
  expect(importMatch(competition.id, rankedMatch(102))).toMatchObject({
    status: "imported",
    number: 5,
  });
  expect(importMatch(competition.id, rankedMatch(103), 2)).toMatchObject({
    status: "imported",
    number: 2,
  });
  expect(importMatch(competition.id, rankedMatch(104))).toMatchObject({
    status: "imported",
    number: 6,
  });
});

test("invalid and duplicate imports preserve saved matches and a stale import cannot change a new competition", () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch());
  importMatch(competition.id, rankedMatch(101), 2);
  const before = database.select().from(matchResults).all();
  expect(importMatch(competition.id, rankedMatch(100), 2)).toEqual({
    status: "duplicate",
    number: 1,
  });
  expect(
    importMatch(competition.id, { id: 102, players: [], completions: [] }, 1)
      .status
  ).toBe("empty_match");
  const unrelated = rankedMatch(103);
  unrelated.players = unrelated.players.filter(
    (player) => player.uuid === "uuid99"
  );
  expect(importMatch(competition.id, unrelated, 1).status).toBe(
    "no_matching_players"
  );
  expect(database.select().from(matchResults).all()).toEqual(before);
  deleteCompetition(input.guildId, competition.id);
  startCompetition(input);
  expect(importMatch(competition.id, rankedMatch()).status).toBe("inactive");
  expect(database.select().from(matches).all()).toHaveLength(0);
});

test("clear deletes only the selected match and results, defaults to latest, and refreshes standings", async () => {
  const competition = setupMatchPlayers();
  const { channel, messages } = registrationChannel();
  await updateRegistrationMessages(channel, competition.id);
  const registrationIds = getActiveCompetition(
    input.guildId,
    5
  )!.registrationMessageIds;
  importMatch(competition.id, rankedMatch());
  const second = rankedMatch(101);
  second.completions = [{ uuid: "uuid4", time: 100 }];
  importMatch(competition.id, second);
  await Promise.all([
    updateLeaderboardMessages(channel, competition.id),
    updateLeaderboardMessages(channel, competition.id),
  ]);
  expect(messages.size).toBe(2);
  expect([...messages.values()].join("\n")).toContain(
    "**League 5 Week 1 Leaderboard**\n**Status:** active\n**Current seed:** 2"
  );
  expect([...messages.values()].join("\n")).toContain(
    "Player4(player4) - 8 pts - 0:00.550"
  );
  expect(clearMatch(competition.id, 1)).toEqual({
    status: "cleared",
    number: 1,
  });
  expect(database.select().from(matchResults).all()).toHaveLength(6);
  expect(getCompetitionStandings(competition.id)!.standings[0]!.ign).toBe(
    "Player4"
  );
  expect(clearMatch(competition.id, 1).status).toBe("not_found");
  expect(clearMatch(competition.id)).toEqual({ status: "cleared", number: 2 });
  await updateLeaderboardMessages(channel, competition.id);
  expect(database.select().from(matchResults).all()).toHaveLength(0);
  expect(database.select().from(registrations).all()).toHaveLength(6);
  expect([...messages.values()].join("\n")).not.toContain("Leaderboard");
  expect(messages.has(registrationIds[0]!)).toBe(true);
  expect(clearMatch(competition.id).status).toBe("not_found");
  expect(importMatch(competition.id, rankedMatch())).toMatchObject({
    number: 1,
  });
});

test("one player still earns a point and missed matches count toward average but not participation", () => {
  const competition = setupMatchPlayers(1);
  importMatch(competition.id, rankedMatch());
  expect(database.select().from(matchResults).get()!.points).toBe(1);
  // A late registration receives missed results for earlier matches.
  registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: "late",
      discordUsername: "late",
      minecraftUuid: "late",
      ign: "Late",
      registeredAt: new Date(),
    },
    { mode: "admin" }
  );
  const later = rankedMatch(101);
  later.players = [{ ...later.players[0]!, uuid: "late", nickname: "Late" }];
  later.completions = [{ uuid: "late", time: 100 }];
  importMatch(competition.id, later);
  expect(
    getCompetitionStandings(competition.id)!.standings.find(
      (player) => player.ign === "Player0"
    )
  ).toMatchObject({ played: 1, averageTimeMs: 750 });
});

test("a failed replacement rolls back both match metadata and deleted results", () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch());
  const savedMatches = database.select().from(matches).all();
  const savedResults = database.select().from(matchResults).all();
  // Fail after the old results have been deleted to verify the transaction restores them.
  database.$client
    .exec(`CREATE TRIGGER reject_result BEFORE INSERT ON match_results
    BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`);
  try {
    expect(() => importMatch(competition.id, rankedMatch(101), 1)).toThrow();
  } finally {
    database.$client.exec("DROP TRIGGER reject_result");
  }
  expect(database.select().from(matches).all()).toEqual(savedMatches);
  expect(database.select().from(matchResults).all()).toEqual(savedResults);
});

test("clearing a match preserves other competitions and rejects ended competitions", () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch());
  startCompetition({ ...input, guildId: "other-guild" });
  const other = getActiveCompetition("other-guild", 5)!;
  database
    .insert(matches)
    .values({
      competitionId: other.id,
      number: 1,
      timeLimitMs: 1000,
      createdAt: new Date(),
    })
    .run();
  clearMatch(competition.id);
  expect(database.select().from(matches).all()).toHaveLength(1);
  expect(database.select().from(matches).get()!.competitionId).toBe(other.id);
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, other.id))
    .run();
  expect(clearMatch(other.id).status).toBe("inactive");
  expect(importMatch(other.id, rankedMatch()).status).toBe("inactive");
  expect(database.select().from(matches).all()).toHaveLength(1);
});

test("a player who misses a round remains registered and can play a later round", () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch());
  const absent = database
    .select()
    .from(registrations)
    .all()
    .find((player) => player.minecraftUuid === "uuid5")!;
  expect(
    database
      .select()
      .from(matchResults)
      .where(eq(matchResults.registrationId, absent.id))
      .get()!.status
  ).toBe("missed");
  const later = rankedMatch(101);
  later.players.push({
    ...later.players[0]!,
    uuid: "uuid5",
    nickname: "Player5",
  });
  later.completions.push({ uuid: "uuid5", time: 100 });
  importMatch(competition.id, later);
  expect(database.select().from(registrations).all()).toHaveLength(6);
  expect(
    getCompetitionStandings(competition.id)!.standings.find(
      (player) => player.ign === "Player5"
    )
  ).toMatchObject({ played: 1, averageTimeMs: 550 });
});

test("test fill preserves registrations, handles UUID variants, and supports normal import", () => {
  const competition = setupMatchPlayers();
  const before = database.select().from(registrations).all();
  const match = rankedMatch();
  match.players[0]!.uuid = "UUID-0";
  expect(fillTestRegistrations(competition.id, match.players)).toEqual({
    status: "filled",
    added: 1,
    skipped: 5,
  });
  const after = database.select().from(registrations).all();
  expect(after.slice(0, before.length)).toEqual(before);
  expect(after.at(-1)?.discordUserId).toBe("test:uuid99");
  expect(database.select().from(matches).all()).toHaveLength(0);
  expect(fillTestRegistrations(competition.id, match.players)).toEqual({
    status: "filled",
    added: 0,
    skipped: 6,
  });
  expect(importMatch(competition.id, match)).toMatchObject({
    status: "imported",
    matched: 6,
  });
  deleteCompetition(input.guildId, competition.id);
  startCompetition({ ...input, weekNumber: 2 });
  expect(fillTestRegistrations(competition.id, match.players)).toEqual({
    status: "inactive",
  });
  expect(database.select().from(registrations).all()).toHaveLength(0);
});

test("finalization preserves results, ranks played DNFs, and lists all nonparticipants", async () => {
  const competition = setupMatchPlayers();
  toggleRegistration(input.guildId, 5);
  importMatch(competition.id, rankedMatch());
  registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: "late",
      discordUsername: "LateDiscord",
      minecraftUuid: "late-uuid",
      ign: "LateMinecraft",
      registeredAt: new Date(),
    },
    { mode: "admin" }
  );
  const originalResults = database.select().from(matchResults).all();
  const { channel, messages } = registrationChannel();
  await updateLeaderboardMessages(channel, competition.id);
  expect([...messages.values()].join("\n")).toContain(
    "-----\nLateMinecraft - missed\nPlayer5 - missed"
  );

  expect(endCompetition(input.guildId, competition.id).status).toBe("ended");
  expect(getActiveCompetition(input.guildId, 5)).toBeUndefined();
  const ended = getLatestEndedCompetition(input.guildId, 5)!;
  expect(ended.registrationOpen).toBe(false);
  expect(ended.endedAt).toBeInstanceOf(Date);
  expect(database.select().from(matchResults).all()).toEqual(originalResults);
  expect(getCompetitionRegistration(competition.id)!.players).toHaveLength(7);
  await updateLeaderboardMessages(channel, competition.id);
  await updateRegistrationMessages(channel, competition.id);
  const content = [...messages.values()].join("\n");
  expect(content).toContain("**Status:** ended");
  expect(content).toContain("5. Player4(player4)");
  expect(content).toContain("-----\nLateMinecraft - missed\nPlayer5 - missed");
  expect(content).toContain("Registration: **OFF**");
  expect(endCompetition(input.guildId, competition.id).status).toBe(
    "already_ended"
  );
  expect(getLatestEndedCompetition(input.guildId, 5)!.endedAt).toEqual(
    ended.endedAt
  );
  expect(importMatch(competition.id, rankedMatch(200)).status).toBe("inactive");
  expect(clearMatch(competition.id).status).toBe("inactive");
  expect(
    unregisterPlayer(competition.id, "player0", { admin: true }).status
  ).toBe("inactive");
});

test("finalization rejects unknown competitions, other guilds, and competitions without imported matches", () => {
  const competition = setupMatchPlayers();
  expect(endCompetition(input.guildId, -1).status).toBe("not_found");
  expect(endCompetition("other-guild", competition.id).status).toBe(
    "not_found"
  );
  expect(endCompetition(input.guildId, competition.id).status).toBe(
    "no_matches"
  );
  expect(getActiveCompetition(input.guildId, 5)).toBeDefined();
});

test("unending restores an ended competition without reopening registration or changing results", async () => {
  const competition = setupMatchPlayers();
  importMatch(competition.id, rankedMatch());
  expect(endCompetition(input.guildId, competition.id).status).toBe("ended");
  const savedResults = database.select().from(matchResults).all();

  expect(unendCompetition(input.guildId, competition.id).status).toBe("active");
  const active = getActiveCompetition(input.guildId, input.leagueNumber)!;
  expect(active.id).toBe(competition.id);
  expect(active.registrationOpen).toBe(false);
  expect(active.endedAt).toBeNull();
  expect(database.select().from(matchResults).all()).toEqual(savedResults);
  expect(getLatestEndedCompetition(input.guildId, input.leagueNumber)).toBe(
    undefined
  );

  const { channel, messages } = registrationChannel();
  await updateLeaderboardMessages(channel, competition.id);
  await updateRegistrationMessages(channel, competition.id);
  const content = [...messages.values()].join("\n");
  expect(content).toContain("**Status:** active");
  expect(content).toContain("Registration: **OFF**");
});

test("unending rejects unknown, active, cross-guild, and superseded competitions", () => {
  const competition = setupMatchPlayers();
  expect(unendCompetition(input.guildId, -1).status).toBe("not_found");
  expect(unendCompetition("other-guild", competition.id).status).toBe(
    "not_found"
  );
  expect(unendCompetition(input.guildId, competition.id).status).toBe(
    "already_active"
  );

  importMatch(competition.id, rankedMatch());
  endCompetition(input.guildId, competition.id);
  expect(startCompetition({ ...input, weekNumber: 2 })).toBe(true);
  expect(unendCompetition(input.guildId, competition.id).status).toBe(
    "has_active"
  );
  expect(getLatestEndedCompetition(input.guildId, input.leagueNumber)?.id).toBe(
    competition.id
  );
  expect(
    getActiveCompetition(input.guildId, input.leagueNumber)?.weekNumber
  ).toBe(2);
});

test("final leaderboard omits the missed section when everyone participated and retries after Discord failure", async () => {
  const competition = setupMatchPlayers(2);
  importMatch(competition.id, rankedMatch());
  endCompetition(input.guildId, competition.id);
  const failingChannel = {
    async send() {
      throw new Error("Discord unavailable");
    },
  } as unknown as SendableChannels;
  const error: unknown = await updateLeaderboardMessages(
    failingChannel,
    competition.id
  ).catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({ message: "Discord unavailable" });
  expect(endCompetition(input.guildId, competition.id).status).toBe(
    "already_ended"
  );
  const { channel, messages } = registrationChannel();
  await updateLeaderboardMessages(channel, competition.id);
  expect([...messages.values()].join("\n")).not.toContain("-----");
  expect([...messages.values()].join("\n")).not.toContain(" - missed");
});

test("test clear removes only test registrations and their results, preserving matches and real players", async () => {
  const competition = setupMatchPlayers();
  const match = rankedMatch();
  fillTestRegistrations(competition.id, match.players);
  importMatch(competition.id, match);
  const realPlayers = database
    .select()
    .from(registrations)
    .all()
    .filter((player) => !player.discordUserId.startsWith("test:"));
  const realPlayerIds = new Set(realPlayers.map((player) => player.id));
  const realResults = database
    .select()
    .from(matchResults)
    .all()
    .filter((result) => realPlayerIds.has(result.registrationId));
  const savedMatches = database.select().from(matches).all();
  const { channel, messages } = registrationChannel();
  await updateRegistrationMessages(channel, competition.id);
  await updateLeaderboardMessages(channel, competition.id);
  expect([...messages.values()].join("\n")).toContain("Player99");
  const savedCompetition = getActiveCompetition(input.guildId, 5);

  expect(clearTestRegistrations(input.guildId, competition.id)).toEqual({
    status: "cleared",
    removed: 1,
  });
  expect(getActiveCompetition(input.guildId, 5)).toEqual(savedCompetition);
  expect(database.select().from(registrations).all()).toEqual(realPlayers);
  expect(database.select().from(matchResults).all()).toEqual(realResults);
  expect(database.select().from(matches).all()).toEqual(savedMatches);
  await updateRegistrationMessages(channel, competition.id);
  await updateLeaderboardMessages(channel, competition.id);
  expect([...messages.values()].join("\n")).not.toContain("Player99");
  expect(messages.size).toBe(2);
  expect(clearTestRegistrations(input.guildId, competition.id)).toEqual({
    status: "cleared",
    removed: 0,
  });
});

test("test clear respects guild, competition and active-state boundaries", () => {
  startCompetition(input);
  startCompetition({ ...input, leagueNumber: 6 });
  const competition = getActiveCompetition(input.guildId, 5)!;
  const other = getActiveCompetition(input.guildId, 6)!;
  for (const id of [competition.id, other.id])
    fillTestRegistrations(id, rankedMatch().players);
  const before = database.select().from(registrations).all();
  expect(clearTestRegistrations("other-guild", competition.id).status).toBe(
    "inactive"
  );
  expect(database.select().from(registrations).all()).toEqual(before);
  expect(clearTestRegistrations(input.guildId, competition.id).status).toBe(
    "cleared"
  );
  expect(getCompetitionRegistration(other.id)!.players).toHaveLength(6);
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, other.id))
    .run();
  expect(clearTestRegistrations(input.guildId, other.id).status).toBe(
    "inactive"
  );
  expect(getCompetitionRegistration(other.id)!.players).toHaveLength(6);
  deleteCompetition(input.guildId, competition.id);
  startCompetition(input);
  const replacement = getActiveCompetition(input.guildId, 5)!;
  fillTestRegistrations(replacement.id, rankedMatch().players);
  expect(clearTestRegistrations(input.guildId, competition.id).status).toBe(
    "inactive"
  );
  expect(getCompetitionRegistration(replacement.id)!.players).toHaveLength(6);
});

// These scenarios share the migrated in-memory database with competition tests
// because they verify membership across registration, cleanup, and review.

function registerMember() {
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

const migrationInput = {
  guildId: input.guildId,
  discordUserId: "member",
  discordUsername: "member",
  minecraftUuid: "new-uuid",
  ign: "NewName",
  reviewerId: "host",
};

test("test migration isolates the dev guild and supports migration back to the real account", () => {
  const { registration } = registerMember();
  const mainPlayer = getPlayer(input.guildId, "member")!;
  const guildId = Object.keys(guildConfiguration).find(
    (id) => guildConfiguration[id]?.dev === true
  )!;
  assignPlayerLeague(guildId, "member", 5, registration);
  const devPlayer = getPlayer(guildId, "member")!;
  const percentageHistory = [{ week: 1, league: 5, percentage: 2 }];
  database
    .update(players)
    .set({ percentageHistory })
    .where(eq(players.id, devPlayer.id))
    .run();
  const account = {
    guildId,
    discordUserId: "member",
    minecraftUuid: "FA-KE",
    ign: "Fake",
  };
  expect(setTestMigrationAccount({ ...account, guildId: input.guildId })).toBe(
    "not_dev"
  );
  expect(setTestMigrationAccount(account)).toBe("updated");
  expect(getPlayer(input.guildId, "member")).toEqual(mainPlayer);
  expect(getPlayer(guildId, "member")).toMatchObject({
    minecraftUuid: "fake",
    ign: "Fake",
    percentageHistory,
    leagueNumber: 5,
    accountVersion: devPlayer.accountVersion + 1,
  });
  startCompetition({ ...input, guildId });
  toggleRegistration(guildId, 5);
  const competition = getActiveCompetition(guildId, 5)!;
  const devRegistration = { ...registration, competitionId: competition.id };
  expect(registerPlayer(devRegistration)).toBe("account_mismatch");
  const migration = createMigration({
    ...migrationInput,
    guildId,
    minecraftUuid: registration.minecraftUuid,
    ign: registration.ign,
  });
  expect(migration.status).toBe("created");
  if (migration.status !== "created")
    throw new Error("Expected migration request");
  expect(
    decideMigration(
      migration.request.id,
      "host",
      true,
      registration.minecraftUuid
    )
  ).toBe("approved");
  expect(getPlayer(guildId, "member")?.percentageHistory).toEqual([]);
  expect(registerPlayer(devRegistration)).toBe("registered");
  expect(getPlayer(input.guildId, "member")).toEqual(mainPlayer);
});

test("test migration rejects missing players, owned accounts, active registrations, and pending reviews", () => {
  const guildId = Object.keys(guildConfiguration).find(
    (id) => guildConfiguration[id]?.dev === true
  )!;
  const account = {
    guildId,
    discordUserId: "member",
    minecraftUuid: "fake",
    ign: "Fake",
  };
  expect(setTestMigrationAccount(account)).toBe("not_player");
  assignPlayerLeague(guildId, "member", 5, {
    discordUsername: "member",
    minecraftUuid: "real",
    ign: "Real",
  });
  assignPlayerLeague(guildId, "other", 5, {
    discordUsername: "other",
    minecraftUuid: "owned",
    ign: "Owned",
  });
  const original = getPlayer(guildId, "member");
  expect(setTestMigrationAccount({ ...account, minecraftUuid: "real" })).toBe(
    "same_account"
  );
  expect(setTestMigrationAccount({ ...account, minecraftUuid: "owned" })).toBe(
    "account_owned"
  );
  startCompetition({ ...input, guildId });
  toggleRegistration(guildId, 5);
  const competition = getActiveCompetition(guildId, 5)!;
  expect(
    registerPlayer({
      competitionId: competition.id,
      discordUserId: "member",
      discordUsername: "member",
      minecraftUuid: "real",
      ign: "Real",
      registeredAt: new Date(),
    })
  ).toBe("registered");
  expect(setTestMigrationAccount(account)).toBe("active_registration");
  expect(deleteCompetition(guildId, competition.id)).toBe(true);
  expect(createMigration({ ...account, reviewerId: "host" }).status).toBe(
    "created"
  );
  expect(setTestMigrationAccount(account)).toBe("pending");
  expect(getPlayer(guildId, "member")).toEqual(original);
});

test("membership survives competition deletion and normal registration follows the role-authorized league", () => {
  const { competition, registration } = registerMember();
  const first = getPlayer(input.guildId, "member")!;
  expect(first).toMatchObject({ minecraftUuid: "abcd", leagueNumber: 5 });
  expect(deleteCompetition(input.guildId, competition.id)).toBe(true);
  expect(getPlayer(input.guildId, "member")?.id).toBe(first.id);
  startCompetition({ ...input, leagueNumber: 6 });
  const next = getActiveCompetition(input.guildId, 6)!;
  toggleRegistration(input.guildId, 6);
  expect(
    registerPlayer({
      ...registration,
      competitionId: next.id,
      minecraftUuid: "different",
    })
  ).toBe("account_mismatch");
  expect(getPlayer(input.guildId, "member")?.leagueNumber).toBe(5);
  expect(registerPlayer({ ...registration, competitionId: next.id })).toBe(
    "registered"
  );
  expect(getPlayer(input.guildId, "member")?.leagueNumber).toBe(6);
});

test("admin registration requires matching membership and account identity", () => {
  const { registration } = registerMember();
  startCompetition({ ...input, leagueNumber: 6 });
  const next = getActiveCompetition(input.guildId, 6)!;
  const target = { ...registration, competitionId: next.id };
  expect(registerPlayer(target, { mode: "admin" })).toBe("league_mismatch");
  expect(
    registerPlayer({ ...target, minecraftUuid: "other" }, { mode: "admin" })
  ).toBe("account_mismatch");
  expect(
    registerPlayer({ ...target, discordUserId: "other" }, { mode: "admin" })
  ).toBe("account_owned");
  expect(
    registerPlayer(target, {
      mode: "admin",
    })
  ).toBe("league_mismatch");
  expect(getPlayer(input.guildId, "member")?.leagueNumber).toBe(5);
});

test("migration approval resets percentage history, preserves league and snapshots, and retains history", () => {
  const { competition } = registerMember();
  expect(createMigration(migrationInput).status).toBe("active_registration");
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, competition.id))
    .run();
  const member = getPlayer(input.guildId, "member")!;
  database
    .update(players)
    .set({ percentageHistory: [{ week: 1, league: 5, percentage: 2 }] })
    .where(eq(players.id, member.id))
    .run();
  const result = createMigration(migrationInput);
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("Expected request");
  expect(createMigration(migrationInput).status).toBe("pending");
  expect(decideMigration(result.request.id, "intruder", true, "newuuid")).toBe(
    "forbidden"
  );
  expect(decideMigration(result.request.id, "host", true, "another")).toBe(
    "link_changed"
  );
  assignPlayerLeague(input.guildId, "member", 4);
  expect(decideMigration(result.request.id, "host", true, "NEW-UUID")).toBe(
    "approved"
  );
  expect(getPlayer(input.guildId, "member")).toMatchObject({
    id: member.id,
    minecraftUuid: "newuuid",
    ign: "NewName",
    leagueNumber: 4,
    percentageHistory: [],
    accountVersion: 2,
  });
  expect(database.select().from(registrations).get()).toMatchObject({
    minecraftUuid: "abcd",
    ign: "OldName",
    accountVersion: 1,
  });
  expect(getMigrationHistory(input.guildId, "member")[0]).toMatchObject({
    previousUuid: "abcd",
    previousIgn: "OldName",
    status: "approved",
    reviewerId: "host",
  });
  expect(
    getMigrationHistory(input.guildId, "member")[0]?.decidedAt
  ).toBeInstanceOf(Date);
  expect(decideMigration(result.request.id, "host", true, "newuuid")).toBe(
    "resolved"
  );
});

test("approval rechecks active registrations and destination ownership", () => {
  const { competition, registration } = registerMember();
  unregisterPlayer(competition.id, "member");
  const result = createMigration(migrationInput);
  if (result.status !== "created") throw new Error("Expected request");
  registerPlayer(registration);
  expect(decideMigration(result.request.id, "host", true, "newuuid")).toBe(
    "active_registration"
  );
  unregisterPlayer(competition.id, "member");
  registerPlayer({
    ...registration,
    discordUserId: "other",
    minecraftUuid: "newuuid",
  });
  expect(decideMigration(result.request.id, "host", true, "newuuid")).toBe(
    "account_owned"
  );
  expect(getMigration(result.request.id)?.status).toBe("pending");
  expect(getPlayer(input.guildId, "member")?.minecraftUuid).toBe("abcd");
});

test("denied requests remain in history and allow another request without altering membership", () => {
  const { competition } = registerMember();
  unregisterPlayer(competition.id, "member");
  const result = createMigration(migrationInput);
  if (result.status !== "created") throw new Error("Expected request");
  expect(decideMigration(result.request.id, "host", false)).toBe("denied");
  expect(getPlayer(input.guildId, "member")?.minecraftUuid).toBe("abcd");
  expect(createMigration(migrationInput).status).toBe("created");
  expect(
    getMigrationHistory(input.guildId, "member").map((row) => row.status)
  ).toEqual(["pending", "denied"]);
});

test("signup lives on the player row and cannot overwrite later assignment", () => {
  const signup = {
    guildId: input.guildId,
    discordUserId: "member",
    discordUsername: "member",
    minecraftUuid: "newuuid",
    ign: "NewName",
  };
  const player = createSignup(signup)!;
  expect(player.status).toBe("pending");
  expect(createSignup(signup)?.id).toBe(player.id);
  expect(createSignup({ ...signup, discordUserId: "other" })).toBeUndefined();
  expect(decideSignup(player.id, 7, "different")).toBe("link_changed");
  expect(decideSignup(player.id, 7, "newuuid")).toBe("approved");
  assignPlayerLeague(input.guildId, "member", 6);
  expect(decideSignup(player.id, 7, "newuuid")).toBe("resolved");
  expect(getPlayer(input.guildId, "member")).toMatchObject({
    status: "active",
    leagueNumber: 6,
  });
  expect(createSignup({ ...signup, guildId: "other-guild" })?.status).toBe(
    "pending"
  );
});

test("role-authorized registration activates pending signup on the same player row", () => {
  const player = createSignup({
    guildId: input.guildId,
    discordUserId: "member",
    discordUsername: "member",
    minecraftUuid: "AB-CD",
    ign: "OldName",
  })!;
  registerMember();
  expect(getPlayer(input.guildId, "member")).toMatchObject({
    id: player.id,
    status: "active",
    leagueNumber: 5,
  });
  expect(decideSignup(player.id, 7, "abcd")).toBe("resolved");
});

test("rejected signup retains its player row and a host can assign it", () => {
  const signup = {
    guildId: input.guildId,
    discordUserId: "member",
    discordUsername: "member",
    minecraftUuid: "abcd",
    ign: "OldName",
  };
  const player = createSignup(signup)!;
  expect(decideSignup(player.id)).toBe("rejected");
  expect(createSignup(signup)).toMatchObject({
    id: player.id,
    status: "rejected",
  });
  startCompetition(input);
  toggleRegistration(input.guildId, input.leagueNumber);
  const competition = getActiveCompetition(input.guildId, input.leagueNumber)!;
  expect(
    registerPlayer({
      competitionId: competition.id,
      discordUserId: signup.discordUserId,
      discordUsername: signup.discordUsername,
      minecraftUuid: signup.minecraftUuid,
      ign: signup.ign,
      registeredAt: new Date(),
    })
  ).toBe("signup_rejected");
  expect(createMigration(migrationInput).status).toBe("not_player");
  assignPlayerLeague(input.guildId, "member", 7);
  expect(getPlayer(input.guildId, "member")).toMatchObject({
    id: player.id,
    status: "active",
    leagueNumber: 7,
  });
});

test("test membership and percentage history survive weekly competition cleanup and clear together", () => {
  startCompetition(input);
  let competition = getActiveCompetition(input.guildId, 5)!;
  const matchPlayers = [
    {
      uuid: "testuuid",
      nickname: "Fake",
      eloRate: 1000,
      roleType: 0,
      eloRank: 1,
      country: null,
    },
  ];
  // Use the same match fixture shape as the existing test-fill coverage.
  fillTestRegistrations(competition.id, matchPlayers);
  const member = getPlayer(input.guildId, "test:testuuid")!;
  expect(member.isTest).toBe(true);
  database
    .update(players)
    .set({ percentageHistory: [{ week: 1, league: 5, percentage: 1 }] })
    .where(eq(players.id, member.id))
    .run();
  deleteCompetition(input.guildId, competition.id);
  startCompetition({ ...input, weekNumber: 2 });
  competition = getActiveCompetition(input.guildId, 5)!;
  fillTestRegistrations(competition.id, matchPlayers);
  expect(getPlayer(input.guildId, "test:testuuid")).toMatchObject({
    id: member.id,
    percentageHistory: [{ week: 1, league: 5, percentage: 1 }],
  });
  clearTestRegistrations(input.guildId, competition.id);
  expect(getPlayer(input.guildId, "test:testuuid")).toBeUndefined();
});

test("migration back to an earlier UUID still starts a distinct account version", () => {
  const { competition } = registerMember();
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, competition.id))
    .run();
  const first = createMigration(migrationInput);
  if (first.status !== "created") throw new Error("Expected request");
  expect(decideMigration(first.request.id, "host", true, "newuuid")).toBe(
    "approved"
  );
  const second = createMigration({
    ...migrationInput,
    minecraftUuid: "AB-CD",
    ign: "RenamedOriginal",
  });
  if (second.status !== "created") throw new Error("Expected request");
  expect(decideMigration(second.request.id, "host", true, "abcd")).toBe(
    "approved"
  );
  expect(getPlayer(input.guildId, "member")).toMatchObject({
    minecraftUuid: "abcd",
    accountVersion: 3,
  });
  expect(database.select().from(registrations).get()?.accountVersion).toBe(1);
  expect(getMigrationHistory(input.guildId, "member")).toHaveLength(2);
});

test("assignment creates a missing player from the linked account", () => {
  assignPlayerLeague(input.guildId, "new-member", 7, {
    discordUsername: "NewMember",
    minecraftUuid: "NEW-UUID",
    ign: "NewName",
  });
  expect(getPlayer(input.guildId, "new-member")).toMatchObject({
    discordUsername: "NewMember",
    minecraftUuid: "newuuid",
    ign: "NewName",
    leagueNumber: 7,
    status: "active",
  });
});

test("assignment rejects owned accounts and resets history when changing league", () => {
  const { competition } = registerMember();
  const member = getPlayer(input.guildId, "member")!;
  const percentageHistory = [{ week: 1, league: 5, percentage: 2 }];
  database
    .update(players)
    .set({ percentageHistory })
    .where(eq(players.id, member.id))
    .run();
  expect(
    assignPlayerLeague(input.guildId, "other", 7, {
      discordUsername: "Other",
      minecraftUuid: member.minecraftUuid,
      ign: member.ign,
    })
  ).toBe("account_owned");
  expect(getPlayer(input.guildId, "other")).toBeUndefined();
  // A player may be created while the command is awaiting its Ranked lookup.
  expect(
    assignPlayerLeague(input.guildId, "member", 6, {
      discordUsername: "Changed",
      minecraftUuid: "different-uuid",
      ign: "Different",
    })
  ).toBe("assigned");
  expect(getPlayer(input.guildId, "member")).toMatchObject({
    id: member.id,
    minecraftUuid: member.minecraftUuid,
    accountVersion: member.accountVersion,
    leagueNumber: 6,
    percentageHistory: [],
  });
  expect(getCompetitionRegistration(competition.id)!.players).toHaveLength(1);
});

test("successful imports close registration and prevent reopening until imports are cleared", () => {
  const competition = setupMatchPlayers();
  toggleRegistration(input.guildId, 5);
  expect(
    importMatch(competition.id, { id: 200, players: [], completions: [] })
      .status
  ).toBe("empty_match");
  expect(getActiveCompetition(input.guildId, 5)!.registrationOpen).toBe(true);
  importMatch(competition.id, rankedMatch());
  expect(getActiveCompetition(input.guildId, 5)!.registrationOpen).toBe(false);
  expect(toggleRegistration(input.guildId, 5)).toBe("has_results");
  expect(unregisterPlayer(competition.id, "player5").status).toBe("closed");
  const late = {
    competitionId: competition.id,
    discordUserId: "late",
    discordUsername: "late",
    minecraftUuid: "late",
    ign: "Late",
    registeredAt: new Date(),
  };
  expect(registerPlayer(late)).toBe("closed");
  // Even an old database with registration still open cannot admit self registrations.
  database
    .update(competitions)
    .set({ registrationOpen: true })
    .where(eq(competitions.id, competition.id))
    .run();
  expect(registerPlayer(late)).toBe("closed");
  toggleRegistration(input.guildId, 5);
  clearMatch(competition.id);
  expect(getActiveCompetition(input.guildId, 5)!.registrationOpen).toBe(false);
  expect(toggleRegistration(input.guildId, 5)).toMatchObject({
    registrationOpen: true,
  });
});

test("late registration backfills every imported match, rescales points, and permits explicit re-import", () => {
  const competition = setupMatchPlayers(5);
  importMatch(competition.id, rankedMatch());
  importMatch(competition.id, rankedMatch(101));
  const before = database.select().from(matchResults).all();
  const late = {
    competitionId: competition.id,
    discordUserId: "late",
    discordUsername: "late",
    minecraftUuid: "uuid99",
    ign: "Late",
    registeredAt: new Date(),
  };
  expect(registerPlayer(late, { mode: "admin" })).toBe("registered");
  const registration = database
    .select()
    .from(registrations)
    .where(eq(registrations.discordUserId, "late"))
    .get()!;
  const missed = database
    .select()
    .from(matchResults)
    .where(eq(matchResults.registrationId, registration.id))
    .all();
  expect(missed).toHaveLength(2);
  for (const result of missed)
    expect(result).toMatchObject({
      status: "missed",
      points: 0,
      placement: null,
      timeMs: null,
      submittedAt: null,
    });
  const after = database
    .select()
    .from(matchResults)
    .all()
    .filter((row) => row.registrationId !== registration.id);
  expect(after.map(({ points: _points, ...result }) => result)).toEqual(
    before.map(({ points: _points, ...result }) => result)
  );
  expect(after.map((row) => row.points)).toEqual([
    8, 8, 2, 0, 0, 8, 8, 2, 0, 0,
  ]);
  expect(
    getCompetitionStandings(competition.id)!.standings.some(
      (row) => row.ign === "Late"
    )
  ).toBe(false);
  expect(registerPlayer(late, { mode: "admin" })).toBe("already_registered");
  expect(database.select().from(matchResults).all()).toHaveLength(12);

  const later = rankedMatch(102);
  importMatch(competition.id, later);
  expect(
    getCompetitionStandings(competition.id)!.standings.find(
      (row) => row.ign === "Late"
    )
  ).toMatchObject({ played: 1, averageTimeMs: 700 });
  importMatch(competition.id, rankedMatch(), 1);
  expect(
    getCompetitionStandings(competition.id)!.standings.find(
      (row) => row.ign === "Late"
    )
  ).toMatchObject({ played: 2, averageTimeMs: 400 });
});

test("failed late result insertion rolls back registration, membership, and scoring", () => {
  const competition = setupMatchPlayers(5);
  importMatch(competition.id, rankedMatch());
  const savedResults = database.select().from(matchResults).all();
  const savedMatches = database.select().from(matches).all();
  database.$client
    .exec(`CREATE TRIGGER reject_late BEFORE INSERT ON match_results
    BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END`);
  try {
    expect(() =>
      registerPlayer(
        {
          competitionId: competition.id,
          discordUserId: "late",
          discordUsername: "late",
          minecraftUuid: "late",
          ign: "Late",
          registeredAt: new Date(),
        },
        { mode: "admin" }
      )
    ).toThrow();
  } finally {
    database.$client.exec("DROP TRIGGER reject_late");
  }
  expect(getPlayer(input.guildId, "late")).toBeUndefined();
  expect(database.select().from(registrations).all()).toHaveLength(5);
  expect(database.select().from(matches).all()).toEqual(savedMatches);
  expect(database.select().from(matchResults).all()).toEqual(savedResults);
});

test("competition refresh updates registration and rescored standings even if registration refresh fails", async () => {
  const competition = setupMatchPlayers(5);
  const { channel, messages, rawChannel } = registrationChannel();
  const replies: string[] = [];
  const interaction = {
    guild: {
      channels: {
        fetch: async () => ({
          ...channel,
          isSendable: () => true,
        }),
      },
    },
    editReply: async ({ content }: { content: string }) => {
      replies.push(content);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;
  await replyWithCompetitionUpdate(
    interaction,
    competition.id,
    "info",
    "Registered."
  );
  expect(messages.size).toBe(1);
  importMatch(competition.id, rankedMatch());
  await replyWithCompetitionUpdate(
    interaction,
    competition.id,
    "info",
    "Imported."
  );
  expect([...messages.values()].join("\n")).toContain("Registration: **OFF**");
  expect([...messages.values()].join("\n")).toContain("7 pts");
  registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: "late",
      discordUsername: "late",
      minecraftUuid: "late",
      ign: "Late",
      registeredAt: new Date(),
    },
    { mode: "admin" }
  );
  const registrationId = getActiveCompetition(input.guildId, 5)!
    .registrationMessageIds[0]!;
  const fetchMessage = rawChannel.messages.fetch.bind(rawChannel.messages);
  const fetchSpy = spyOn(rawChannel.messages, "fetch").mockImplementation(
    (id: string) => {
      if (id === registrationId)
        return Promise.reject(new Error("Simulated Discord failure"));
      return fetchMessage(id);
    }
  );
  const logSpy = spyOn(console, "error").mockImplementation(() => {});
  try {
    await replyWithCompetitionUpdate(
      interaction,
      competition.id,
      "info",
      "Registered Late."
    );
  } finally {
    fetchSpy.mockRestore();
    logSpy.mockRestore();
  }
  expect([...messages.values()].join("\n")).toContain("8 pts");
  expect(replies.at(-1)).toContain("The changes are saved");
  expect(database.select().from(registrations).all()).toHaveLength(6);
});

test("assignment preserves same-league history and supports an explicit override", () => {
  registerMember();
  const percentageHistory = [{ week: 1, league: 5, percentage: 60 }];
  database.update(players).set({ percentageHistory }).run();
  assignPlayerLeague(input.guildId, "member", 5);
  expect(getPlayer(input.guildId, "member")?.percentageHistory).toEqual(
    percentageHistory
  );
  assignPlayerLeague(input.guildId, "member", 4, undefined, {
    preserveHistory: true,
  });
  expect(getPlayer(input.guildId, "member")?.percentageHistory).toEqual(
    percentageHistory
  );
  assignPlayerLeague(input.guildId, "member", 5);
  expect(getPlayer(input.guildId, "member")?.percentageHistory).toEqual([]);
});

function endedMovementCompetition(leagueNumber = 5, weekNumber = 1) {
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

test("assignment waits for participating competitions to be processed", () => {
  const competition = endedMovementCompetition();
  for (const userId of ["league5player0", "league5player6"]) {
    const before = getPlayer(input.guildId, userId);
    expect(assignPlayerLeague(input.guildId, userId, 2)).toBe(
      "unprocessed_competition"
    );
    expect(
      assignPlayerLeague(input.guildId, userId, 5, undefined, {
        preserveHistory: true,
      })
    ).toBe("unprocessed_competition");
    expect(getPlayer(input.guildId, userId)).toEqual(before);
  }
  // A missed week does not count as participation.
  expect(assignPlayerLeague(input.guildId, "league5player7", 2)).toBe(
    "assigned"
  );
  expect(unendCompetition(input.guildId, competition.id).status).toBe("active");
  expect(assignPlayerLeague(input.guildId, "league5player0", 2)).toBe(
    "unprocessed_competition"
  );
  expect(endCompetition(input.guildId, competition.id).status).toBe("ended");
  expect(relegateGuild(input.guildId, [5]).status).toBe("processed");
  expect(assignPlayerLeague(input.guildId, "league5player0", 2)).toBe(
    "assigned"
  );
  expect(getPlayer(input.guildId, "league5player0")?.leagueNumber).toBe(2);
});

test("relegation uses preview values, retains demotion history, trims oldest, and skips absent players", async () => {
  const competition = endedMovementCompetition();
  const history = [20, 30, 40].map((percentage, index) => ({
    week: index + 1,
    league: 5,
    percentage,
  }));
  database.update(players).set({ percentageHistory: history }).run();
  const preview = getCompetitionMovement(competition.id)!;
  expect(preview.standings).toHaveLength(7);
  expect(preview.decisions.map((decision) => decision.movement)).toEqual([
    "promote",
    "none",
    "none",
    "none",
    "none",
    "none",
    "demote",
  ]);
  expect(
    database
      .select()
      .from(registrations)
      .all()
      .every(
        (player) => player.movement === null && player.averageUsed === null
      )
  ).toBe(true);
  expect(relegateGuild(input.guildId, [5])).toMatchObject({
    status: "processed",
    processed: [{ leagueNumber: 5, promoted: 1, demoted: 1 }],
  });
  expect(getPlayer(input.guildId, "league5player0")).toMatchObject({
    leagueNumber: 4,
    percentageHistory: [],
  });
  expect(getPlayer(input.guildId, "league5player6")).toMatchObject({
    leagueNumber: 6,
    percentageHistory: [
      history[1],
      history[2],
      { week: 1, league: 5, percentage: 85 },
    ],
  });
  expect(getPlayer(input.guildId, "league5player7")).toMatchObject({
    leagueNumber: 5,
    percentageHistory: history,
  });
  const staying = getPlayer(input.guildId, "league5player1")!;
  expect(staying.percentageHistory.slice(0, 2)).toEqual(history.slice(1));
  expect(staying.percentageHistory[2]!.percentage).toBeCloseTo((100 * 5) / 6);
  const registered = getCompetitionRegistration(competition.id)!.players;
  expect(
    registered.find((player) => player.discordUserId === "league5player6")
  ).toMatchObject({ movement: "demote", averageUsed: 70 / 3 });
  expect(
    registered.find((player) => player.discordUserId === "league5player7")
  ).toMatchObject({ movement: "none", averageUsed: null });
  expect(getCompetitionMovement(competition.id)!.decisions).toEqual(
    preview.decisions.map(({ registrationId, averageUsed, movement }) => ({
      registrationId,
      averageUsed,
      movement,
    }))
  );
  const { channel, messages } = registrationChannel();
  await updateLeaderboardMessages(channel, competition.id);
  const content = [...messages.values()].join("\n");
  expect(content).toBe(formatLeaderboardMessages(preview).join("\n"));
  expect(content).toContain("Avg: 23.33% ↓");
  expect(content).toContain("Avg: 56.67% ↑");
  const savedPlayers = database.select().from(players).all();
  expect(relegateGuild(input.guildId, [5])).toMatchObject({
    status: "processed",
    processed: [],
    skipped: [{ leagueNumber: 5, reason: "processed" }],
  });
  expect(database.select().from(players).all()).toEqual(savedPlayers);
  expect(getCurrentWeek(input.guildId)).toBe(1);
  expect(database.select().from(competitions).all()).toHaveLength(1);
});

test("missing and active leagues block all writes; forced runs can finish remaining leagues later", () => {
  const ended = endedMovementCompetition(5);
  startCompetition({ ...input, leagueNumber: 6 });
  const active = getActiveCompetition(input.guildId, 6)!;
  const before = database.select().from(players).all();
  expect(relegateGuild(input.guildId, [4, 5, 6])).toMatchObject({
    status: "blocked",
    skipped: [
      { leagueNumber: 4, reason: "missing" },
      { leagueNumber: 6, reason: "active" },
    ],
  });
  expect(database.select().from(players).all()).toEqual(before);
  expect(
    getCompetitionRegistration(ended.id)!.competition.hasUsedRelegate
  ).toBe(false);
  expect(
    getCompetitionRegistration(ended.id)!.players.every(
      (player) => player.movement === null
    )
  ).toBe(true);
  expect(relegateGuild(input.guildId, [4, 5, 6], true)).toMatchObject({
    status: "processed",
    processed: [{ leagueNumber: 5 }],
  });
  const afterFirstRun = database.select().from(players).all();
  // An ended empty competition still needs a durable completion flag.
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(relegateGuild(input.guildId, [4, 5, 6], true)).toMatchObject({
    status: "processed",
    processed: [{ leagueNumber: 6, promoted: 0, demoted: 0 }],
  });
  expect(database.select().from(players).all()).toEqual(afterFirstRun);
  expect(
    getCompetitionRegistration(active.id)!.competition.hasUsedRelegate
  ).toBe(true);
  expect(relegateGuild(input.guildId, [5, 6])).toMatchObject({
    status: "processed",
    processed: [],
  });
});

test("relegation only processes configured current-week ended competitions in the requested guild", () => {
  const old = endedMovementCompetition(4, 1);
  const current = endedMovementCompetition(5, 2);
  const unconfigured = endedMovementCompetition(6, 2);
  startCompetition({ ...input, guildId: "other-guild", weekNumber: 2 });
  setCurrentWeek(input.guildId, 2);
  expect(relegateGuild(input.guildId, [4, 5], true)).toMatchObject({
    status: "processed",
    processed: [{ leagueNumber: 5 }],
    skipped: [{ leagueNumber: 4, reason: "missing" }],
  });
  expect(getCompetitionRegistration(old.id)!.competition.hasUsedRelegate).toBe(
    false
  );
  expect(
    getCompetitionRegistration(current.id)!.competition.hasUsedRelegate
  ).toBe(true);
  expect(
    getCompetitionRegistration(unconfigured.id)!.competition.hasUsedRelegate
  ).toBe(false);
  expect(getActiveCompetition("other-guild", 5)).toBeDefined();
});

test("guild-wide movements use original league results and commit together", () => {
  endedMovementCompetition(4);
  endedMovementCompetition(5);
  expect(relegateGuild(input.guildId, [4, 5])).toMatchObject({
    status: "processed",
    processed: [
      { leagueNumber: 4, promoted: 1, demoted: 1 },
      { leagueNumber: 5, promoted: 1, demoted: 1 },
    ],
  });
  expect(getPlayer(input.guildId, "league5player0")!.leagueNumber).toBe(4);
  expect(getPlayer(input.guildId, "league4player6")!.leagueNumber).toBe(5);
  expect(getPlayer(input.guildId, "league4player6")!.percentageHistory).toEqual(
    [{ week: 1, league: 4, percentage: 85 }]
  );
});

test("a write failure in a later league rolls back all memberships, histories, snapshots and flags", () => {
  endedMovementCompetition(4);
  const second = endedMovementCompetition(5);
  const beforePlayers = database.select().from(players).all();
  const beforeRegistrations = database.select().from(registrations).all();
  const beforeCompetitions = database.select().from(competitions).all();
  database.$client.exec(
    `CREATE TRIGGER fail_relegation BEFORE UPDATE OF has_used_relegate ON competitions WHEN NEW.id = ${second.id} BEGIN SELECT RAISE(ABORT, 'test rollback'); END`
  );
  try {
    expect(() => relegateGuild(input.guildId, [4, 5])).toThrow("test rollback");
  } finally {
    database.$client.exec("DROP TRIGGER fail_relegation");
  }
  expect(database.select().from(players).all()).toEqual(beforePlayers);
  expect(database.select().from(registrations).all()).toEqual(
    beforeRegistrations
  );
  expect(database.select().from(competitions).all()).toEqual(
    beforeCompetitions
  );
});

test("processed competitions reject unend and every result-changing operation", () => {
  const competition = endedMovementCompetition();
  relegateGuild(input.guildId, [5]);
  expect(unendCompetition(input.guildId, competition.id)).toEqual({
    status: "relegated",
  });
  expect(getCompetitionRegistration(competition.id)!.competition.status).toBe(
    "ended"
  );
  expect(importMatch(competition.id, rankedMatch()).status).toBe("inactive");
  expect(clearMatch(competition.id).status).toBe("inactive");
  expect(clearTestRegistrations(input.guildId, competition.id).status).toBe(
    "inactive"
  );
  expect(
    fillTestRegistrations(competition.id, rankedMatch().players).status
  ).toBe("inactive");
  expect(
    unregisterPlayer(competition.id, "league5player0", { admin: true }).status
  ).toBe("inactive");
  expect(
    registerPlayer(
      {
        competitionId: competition.id,
        discordUserId: "late",
        discordUsername: "Late",
        minecraftUuid: "late",
        ign: "Late",
        registeredAt: new Date(),
      },
      { mode: "admin" }
    )
  ).toBe("inactive");
});

test("old account snapshots cannot read new history or change the current membership", () => {
  const competition = endedMovementCompetition();
  const original = getPlayer(input.guildId, "league5player0")!;
  const percentageHistory = [{ week: 1, league: 2, percentage: 42 }];
  // Returning to the same UUID still has a distinct version after migration.
  database
    .update(players)
    .set({
      accountVersion: original.accountVersion + 2,
      leagueNumber: 2,
      percentageHistory,
    })
    .where(eq(players.id, original.id))
    .run();
  expect(
    getCompetitionRegistration(competition.id)!.players.find(
      (player) => player.discordUserId === original.discordUserId
    )!.percentageHistory
  ).toBeNull();
  expect(
    getCompetitionMovement(competition.id)!.decisions[0]!.averageUsed
  ).toBe(100);
  relegateGuild(input.guildId, [5]);
  expect(getPlayer(input.guildId, original.discordUserId)).toMatchObject({
    leagueNumber: 2,
    percentageHistory,
  });
  expect(getCompetitionMovement(competition.id)!.decisions[0]).toMatchObject({
    averageUsed: 100,
    movement: "promote",
  });
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

test("League 7 saves qualification without averages or appended history and renders promotion arrows", () => {
  const competition = endedMovementCompetition(7);
  const history = [{ week: 1, league: 7, percentage: 42 }];
  database.update(players).set({ percentageHistory: history }).run();
  // Give the DNF a nonqualifying average while finishers still qualify by best finish.
  database
    .update(matches)
    .set({ timeLimitMs: 35 * 60_000 })
    .where(eq(matches.competitionId, competition.id))
    .run();
  const preview = getCompetitionMovement(competition.id)!;
  expect(
    preview.decisions.every((decision) => decision.averageUsed === null)
  ).toBe(true);
  const content = formatLeaderboardMessages(preview).join("\n");
  expect(content).toContain(" ↑");
  expect(content).not.toContain("Avg:");
  relegateGuild(input.guildId, [7]);
  expect(getPlayer(input.guildId, "league7player0")).toMatchObject({
    leagueNumber: 6,
    percentageHistory: [],
  });
  expect(getPlayer(input.guildId, "league7player6")).toMatchObject({
    leagueNumber: 7,
    percentageHistory: history,
  });
  expect(
    getCompetitionRegistration(competition.id)!.players.every(
      (player) => player.averageUsed === null
    )
  ).toBe(true);
  expect(
    formatLeaderboardMessages(getCompetitionMovement(competition.id)!)
  ).toEqual(formatLeaderboardMessages(preview));
});

test("relegate applies roles once and reports failures for manual correction", async () => {
  const originalGuildId = input.guildId;
  input.guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[input.guildId]!;
  const replies: string[] = [];
  const updatedRoles: string[] = [];
  const attemptedUsers: string[] = [];
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    endedMovementCompetition();
    const interaction = {
      guildId: input.guildId,
      member: { roles: { cache: { has: () => true } } },
      options: { getBoolean: () => true },
      guild: {
        members: {
          fetch: async ({ user }: { user: string }) => {
            attemptedUsers.push(user);
            if (user === "league5player0")
              throw new Error("Missing Discord member");
            return {
              roles: {
                cache: new Collection([
                  [
                    config.leagues[5]!.leagueRoleId,
                    { id: config.leagues[5]!.leagueRoleId, editable: true },
                  ],
                  ["unrelated", { id: "unrelated", editable: false }],
                ]),
                add: async (role: { id: string }) => {
                  updatedRoles.push(`add:${role.id}`);
                },
                remove: async (ids: string[]) => {
                  updatedRoles.push(...ids.map((id) => `remove:${id}`));
                },
              },
            };
          },
        },
        roles: { fetch: async (id: string) => ({ id, editable: true }) },
      },
      editReply: async (reply: string | { content: string }) => {
        replies.push(typeof reply === "string" ? reply : reply.content);
      },
      followUp: async ({ content }: { content: string }) => {
        replies.push(content);
      },
    } as unknown as ChatInputCommandInteraction<"cached">;
    await relegateCommand.execute(interaction);
    expect(attemptedUsers).toEqual(["league5player0", "league5player6"]);
    expect(updatedRoles).toEqual([
      `add:${config.leagues[6]!.leagueRoleId}`,
      `remove:${config.leagues[5]!.leagueRoleId}`,
    ]);
    expect(replies.at(-1)).toContain("1 league roles updated.");
    expect(replies.at(-1)).toContain("<@league5player0> → League 4");
    expect(replies.at(-1)).toContain("manually");
    expect(getPlayer(input.guildId, "league5player0")?.leagueNumber).toBe(4);
    const savedPlayers = database.select().from(players).all();
    await relegateCommand.execute(interaction);
    expect(attemptedUsers).toHaveLength(2);
    expect(database.select().from(players).all()).toEqual(savedPlayers);
  } finally {
    input.guildId = originalGuildId;
    log.mockRestore();
  }
});
