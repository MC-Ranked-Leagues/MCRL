import {
  assignPlayerLeague,
  getPlayer,
  setPlayerTwitchUsername,
} from "./players";
import { clearMatch, getCompetitionStandings, importMatch } from "./matches";
import { updateLeaderboardMessages } from "../lib/leaderboard-messages";
import {
  clearTestRegistrations,
  fillTestRegistrations,
  registerPlayer,
  unregisterPlayer,
} from "./registrations";
import { beforeEach, expect, test } from "bun:test";
import { updateRegistrationMessages } from "../lib/registration-messages";
import { eq } from "drizzle-orm";
import {
  getActiveCompetition,
  getCompetitionRegistration,
  startCompetition,
  toggleRegistration,
} from "./competitions";
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
  registerMember,
} from "../testing/competition";

beforeEach(resetDatabase);

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
