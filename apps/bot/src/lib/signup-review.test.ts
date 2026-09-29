import { mockWebsite } from "../testing/website";
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { MessageFlags, type ButtonInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { createSignup, getPlayer, saveSignupMessage } from "../db/players";
import { resetDatabase } from "../testing/competition";
import { createMemberRoles } from "../testing/discord";
import { ranked } from "./ranked";
import { handleSignupReview } from "./signup-review";

const guildId = Object.keys(guildConfiguration)[0]!;
const config = guildConfiguration[guildId]!;
const leagueRoleId = config.leagues[5]!.leagueRoleId;
const lookup = spyOn(ranked.users, "get");

mockWebsite();

beforeEach(() => {
  resetDatabase();
  lookup.mockResolvedValue({
    uuid: "uuid",
  } as Awaited<ReturnType<typeof ranked.users.get>>);
});

afterEach(() => lookup.mockReset());

function review(roleEditable = true) {
  const player = createSignup({
    guildId,
    discordUserId: "member",
    discordUsername: "Member",
    minecraftUuid: "uuid",
    ign: "MinecraftName",
  })!;
  saveSignupMessage(player.id, "review-message");
  const message = { id: "review-message", content: "Signup for **Member**" };
  const edits: { content?: string; components?: unknown[] }[] = [];
  const followUps: { content: string; flags: MessageFlags }[] = [];
  const applicantMessages: string[] = [];
  const role = { id: leagueRoleId, editable: roleEditable };
  const client = {
    guilds: {
      fetch: async () => ({
        members: {
          fetch: async () => ({
            roles: createMemberRoles([]).roles,
          }),
        },
        roles: { fetch: async () => role },
      }),
    },
    users: {
      fetch: async () => ({
        send: async (content: string) => {
          applicantMessages.push(content);
        },
      }),
    },
  };
  function interaction(action: string) {
    return {
      customId: `signup:${action}:${player.id}:5`,
      user: { id: config.signup!.reviewerId },
      message,
      client,
      deferUpdate: async () => {},
      editReply: async (payload: {
        content?: string;
        components?: unknown[];
      }) => {
        edits.push(payload);
        if (payload.content) message.content = payload.content;
      },
      followUp: async (payload: { content: string; flags: MessageFlags }) => {
        followUps.push(payload);
      },
    } as unknown as ButtonInteraction;
  }
  return { interaction, edits, followUps, applicantMessages };
}

test("choosing and approving a signup only edit the review message", async () => {
  const { interaction, edits, followUps, applicantMessages } = review();

  await handleSignupReview(interaction("pick"));
  expect(edits).toHaveLength(1);
  expect(edits[0]!.components).toHaveLength(1);
  expect(followUps).toEqual([]);

  await handleSignupReview(interaction("approve"));
  expect(edits).toHaveLength(2);
  expect(edits[1]).toMatchObject({
    content: "Signup for **Member**\n\nSignup approved.",
    components: [],
  });
  expect(followUps).toEqual([]);
  expect(applicantMessages).toHaveLength(1);
  expect(getPlayer(guildId, "member")).toMatchObject({
    status: "active",
    leagueNumber: 5,
  });
});

test("approval alerts the reviewer when the league role cannot be assigned", async () => {
  const { interaction, edits, followUps } = review(false);
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  try {
    await handleSignupReview(interaction("approve"));
  } finally {
    errorLog.mockRestore();
  }

  expect(edits[0]!.content).toContain("Signup approved.");
  expect(followUps).toEqual([
    {
      content:
        "Membership is saved. Retry the role update with /assign or /signup.",
      flags: MessageFlags.Ephemeral,
    },
  ]);
});
