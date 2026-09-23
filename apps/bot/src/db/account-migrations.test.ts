import { assignPlayerLeague, getPlayer } from "./players";
import {
  createMigration,
  decideMigration,
  getMigrationHistory,
  getMigration,
  setTestMigrationAccount,
} from "./account-migrations";
import { guildConfiguration } from "../../config/guilds";
import { registerPlayer, unregisterPlayer } from "./registrations";
import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  getActiveCompetition,
  getCompetitionRegistration,
  startCompetition,
  toggleRegistration,
} from "./competitions";
import { getCompetitionMovement, relegateGuild } from "./relegation";
import { competitions, registrations, players } from "./schema";
import {
  resetDatabase,
  database,
  input,
  deleteCompetition,
  registerMember,
  migrationInput,
  endedMovementCompetition,
} from "../testing/competition";

beforeEach(resetDatabase);

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
