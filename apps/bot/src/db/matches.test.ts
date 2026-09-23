import { clearMatch, getCompetitionStandings, importMatch } from "./matches";
import { updateLeaderboardMessages } from "../lib/leaderboard-messages";
import { registerPlayer } from "./registrations";
import { beforeEach, expect, test } from "bun:test";
import { updateRegistrationMessages } from "../lib/registration-messages";
import { eq } from "drizzle-orm";
import { getActiveCompetition, startCompetition } from "./competitions";
import {
  competitions,
  registrations,
  matches,
  matchResults,
} from "./schema";
import {
  resetDatabase,
  database,
  input,
  deleteCompetition,
  registrationChannel,
  setupMatchPlayers,
  rankedMatch,
} from "../testing/competition";

beforeEach(resetDatabase);

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
