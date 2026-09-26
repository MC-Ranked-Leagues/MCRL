import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { meCommand } from "../../src/commands/me";
import { signupCommand } from "../../src/commands/signup";
import { twitchCommand } from "../../src/commands/twitch";
import {
  getActiveCompetition,
  startCompetition,
  toggleRegistration,
} from "../../src/db/competitions";
import { createSignup, getPlayer } from "../../src/db/players";
import { registerPlayer } from "../../src/db/registrations";
import { ranked } from "../../src/lib/ranked";
import { input, resetDatabase } from "../../src/testing/competition";

const guildId = Object.keys(guildConfiguration)[0]!;
const config = guildConfiguration[guildId]!;
const leagueRoleId = config.leagues[5]!.leagueRoleId;
const replies: unknown[] = [];
const lookup = spyOn(ranked.users, "get");
let roleIds = [leagueRoleId];

function interaction() {
  return {
    guildId,
    channelId: config.signup!.channelId,
    user: { id: "member", username: "Member" },
    guild: {
      members: {
        fetch: async () => ({
          roles: { cache: { has: (id: string) => roleIds.includes(id) } },
        }),
      },
    },
    options: { getString: () => "MyChannel" },
    editReply: async (reply: unknown) => {
      replies.push(reply);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;
}

beforeEach(() => {
  resetDatabase();
  replies.length = 0;
  roleIds = [leagueRoleId];
  lookup.mockResolvedValue({
    uuid: "AB-CD",
    nickname: "MinecraftName",
  } as Awaited<ReturnType<typeof ranked.users.get>>);
});

afterEach(() => lookup.mockReset());

test("signup saves a player with one league role without review", async () => {
  await signupCommand.execute(interaction());

  expect(getPlayer(guildId, "member")).toMatchObject({
    minecraftUuid: "abcd",
    ign: "MinecraftName",
    leagueNumber: 5,
    status: "active",
  });
  expect(replies).toEqual([
    "Saved your League 5 account from your league role.",
  ]);
});

test("twitch saves a missing player before streaming registration", async () => {
  await twitchCommand.execute(interaction());
  const player = getPlayer(guildId, "member")!;
  expect(player).toMatchObject({
    leagueNumber: 5,
    status: "active",
    twitch: "mychannel",
  });

  startCompetition({ ...input, guildId });
  toggleRegistration(guildId, 5);
  const competition = getActiveCompetition(guildId, 5)!;
  expect(
    registerPlayer({
      competitionId: competition.id,
      discordUserId: "member",
      discordUsername: "Member",
      minecraftUuid: "abcd",
      ign: "MinecraftName",
      streaming: true,
      registeredAt: new Date(),
    })
  ).toBe("registered");

  await meCommand.execute(interaction());
  expect(getPlayer(guildId, "member")?.id).toBe(player.id);
  expect((replies.at(-1) as { content: string }).content).toContain(
    "League: 5"
  );
});

test("me creates a missing player with one league role", async () => {
  await meCommand.execute(interaction());
  expect(getPlayer(guildId, "member")?.status).toBe("active");
  expect((replies.at(-1) as { content: string }).content).toContain(
    "MinecraftName"
  );
});

test("no role and conflicting roles do not create a player", async () => {
  roleIds = [];
  await meCommand.execute(interaction());
  expect(getPlayer(guildId, "member")).toBeUndefined();
  expect(replies.at(-1)).toContain("Use /signup");

  roleIds = [leagueRoleId, config.leagues[6]!.leagueRoleId];
  await twitchCommand.execute(interaction());
  expect(getPlayer(guildId, "member")).toBeUndefined();
  expect(replies.at(-1)).toContain("multiple league roles");
});

test("a role cannot claim another player's Minecraft account", async () => {
  createSignup({
    guildId,
    discordUserId: "owner",
    discordUsername: "Owner",
    minecraftUuid: "abcd",
    ign: "MinecraftName",
  });

  await meCommand.execute(interaction());
  expect(getPlayer(guildId, "member")).toBeUndefined();
  expect(replies.at(-1)).toContain("already belongs to another player");
});

test("an existing signup is not activated by a league role", async () => {
  const signup = createSignup({
    guildId,
    discordUserId: "member",
    discordUsername: "Member",
    minecraftUuid: "abcd",
    ign: "MinecraftName",
  })!;

  await meCommand.execute(interaction());
  expect(getPlayer(guildId, "member")).toMatchObject({
    id: signup.id,
    status: "pending",
    leagueNumber: null,
  });
  expect(lookup).not.toHaveBeenCalled();
});
