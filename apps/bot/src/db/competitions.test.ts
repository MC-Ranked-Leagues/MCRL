import {
  clearMatch,
  getCompetitionStandings,
  importMatch,
  type RankedMatchInput,
} from "./matches";
import { updateLeaderboardMessages } from "../lib/leaderboard-messages";
import {
  fillTestRegistrations,
  registerPlayer,
  unregisterPlayer,
} from "./registrations";
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
  expect(registerPlayer(player, { bypassClosure: true })).toBe("registered");
  expect(registerPlayer(player, { bypassClosure: true })).toBe(
    "already_registered"
  );
  expect(
    registerPlayer(
      { ...player, discordUserId: "other" },
      { bypassClosure: true }
    )
  ).toBe("account_registered");
  database
    .update(competitions)
    .set({ status: "ended" })
    .where(eq(competitions.id, active.id))
    .run();
  expect(registerPlayer(player, { bypassClosure: true })).toBe("inactive");
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
    registerPlayer(
      {
        competitionId,
        discordUserId: "user",
        discordUsername: "player",
        minecraftUuid: "uuid",
        ign: "Player",
        registeredAt: new Date(),
      },
      { bypassClosure: true }
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
      participantCount: 2,
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
      { bypassClosure: true }
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
  deleteActiveCompetition(input.guildId, competition.id);
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
    "League 5 Week 1 Leaderboard\nStatus: active\nCurrent seed: 2"
  );
  expect([...messages.values()].join("\n")).toContain(
    "player4(Player4) - 8 pts - 0:00.550"
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
  expect([...messages.values()].join("\n")).toContain(
    "No submitted results yet."
  );
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
  // A later registration must not acquire results in an already imported match.
  registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: "late",
      discordUsername: "late",
      minecraftUuid: "late",
      ign: "Late",
      registeredAt: new Date(),
    },
    { bypassClosure: true }
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
      participantCount: 0,
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
  deleteActiveCompetition(input.guildId, competition.id);
  startCompetition({ ...input, weekNumber: 2 });
  expect(fillTestRegistrations(competition.id, match.players)).toEqual({
    status: "inactive",
  });
  expect(database.select().from(registrations).all()).toHaveLength(0);
});
