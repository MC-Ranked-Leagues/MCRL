import { assignPlayerLeague, getPlayer } from "./players";
import {
  formatLeaderboardMessages,
  updateLeaderboardMessages,
} from "../lib/leaderboard-messages";
import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  endCompetition,
  getActiveCompetition,
  getCompetitionRegistration,
  startCompetition,
  unendCompetition,
} from "./competitions";
import { getCurrentWeek, setCurrentWeek } from "./guilds";
import { getCompetitionMovement, relegateGuild } from "./relegation";
import { competitions, registrations, players } from "./schema";
import {
  resetDatabase,
  database,
  input,
  registrationChannel,
  endedMovementCompetition,
} from "../testing/competition";

beforeEach(resetDatabase);

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
