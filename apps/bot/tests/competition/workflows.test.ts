import { getPlayer } from "../../src/db/players";
import { clearMatch, importMatch } from "../../src/db/matches";
import {
  formatLeaderboardMessages,
  updateLeaderboardMessages,
} from "../../src/lib/leaderboard-messages";
import {
  clearTestRegistrations,
  fillTestRegistrations,
  registerPlayer,
  unregisterPlayer,
} from "../../src/db/registrations";
import { beforeEach, expect, test } from "bun:test";
import { updateRegistrationMessages } from "../../src/lib/registration-messages";
import { eq } from "drizzle-orm";
import {
  advanceGuildWeek,
  endCompetition,
  getActiveCompetition,
  getLatestEndedCompetition,
  getCompetitionRegistration,
  getAdvanceWeekPreview,
  startCompetition,
  toggleRegistration,
  unendCompetition,
} from "../../src/db/competitions";
import { setCurrentWeek } from "../../src/db/guilds";
import { getCompetitionMovement, relegateGuild } from "../../src/db/relegation";
import {
  competitions,
  registrations,
  matches,
  matchResults,
  players,
} from "../../src/db/schema";
import {
  resetDatabase,
  database,
  input,
  deleteCompetition,
  registrationChannel,
  setupMatchPlayers,
  rankedMatch,
  registerMember,
  endedMovementCompetition,
} from "../../src/testing/competition";

beforeEach(resetDatabase);

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
