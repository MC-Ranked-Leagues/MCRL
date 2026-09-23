import {
  assignPlayerLeague,
  createSignup,
  decideSignup,
  getPlayer,
} from "./players";
import { createMigration } from "./account-migrations";
import { registerPlayer } from "./registrations";
import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  getActiveCompetition,
  getCompetitionRegistration,
  startCompetition,
  toggleRegistration,
} from "./competitions";
import { players } from "./schema";
import {
  resetDatabase,
  database,
  input,
  registerMember,
  migrationInput,
} from "../testing/competition";

beforeEach(resetDatabase);

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
