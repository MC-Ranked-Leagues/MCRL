import { beforeEach, expect, spyOn, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";
import { guildConfiguration } from "../config/guilds";
import { advanceWeekCommand } from "../src/commands/advance-week";
import { emCommand } from "../src/commands/em";
import { unendCommand } from "../src/commands/unend";
import {
  getActiveCompetition,
  getAdvanceWeekPreview,
  startCompetition,
} from "../src/db/competitions";
import { importMatch } from "../src/db/matches";
import { registerPlayer } from "../src/db/registrations";
import {
  input,
  rankedMatch,
  registrationChannel,
  resetDatabase,
  setupMatchPlayers,
} from "../src/testing/competition";
import { mockWebsite } from "../src/testing/website";

mockWebsite();
beforeEach(resetDatabase);

function setup() {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[guildId]!;
  input.guildId = guildId;
  const competition = setupMatchPlayers();
  startCompetition({ ...input, leagueNumber: 6 });
  expect(
    registerPlayer(
      {
        competitionId: getActiveCompetition(guildId, 6)!.id,
        discordUserId: "other-league-player",
        discordUsername: "Other",
        minecraftUuid: "other",
        ign: "Other",
        registeredAt: new Date(),
      },
      { mode: "admin" }
    )
  ).toBe("registered");
  expect(
    registerPlayer(
      {
        competitionId: competition.id,
        discordUserId: "test:fake",
        discordUsername: "fake",
        minecraftUuid: "fake",
        ign: "Fake",
        registeredAt: new Date(),
      },
      { mode: "test" }
    )
  ).toBe("registered");
  importMatch(competition.id, rankedMatch());
  const { channel } = registrationChannel();
  const holders = new Set([
    ...Array.from({ length: 6 }, (_, index) => `player${index}`),
    "other-league-player",
  ]);
  const fetchedMembers: string[] = [];
  const replies: string[] = [];
  const failedRemovals = new Set<string>();
  let roleFetches = 0;
  const interaction = {
    id: "command",
    guildId,
    channelId: config.leagues[5]!.infoChannelId,
    user: { id: "host" },
    member: { roles: { cache: { has: () => true } } },
    options: { getBoolean: () => true },
    guild: {
      roles: {
        fetch: async () => {
          roleFetches++;
          return { id: config.currentWeekRoleId, editable: true };
        },
      },
      members: {
        fetch: async ({ user }: { user: string }) => {
          fetchedMembers.push(user);
          return {
            roles: {
              cache: {
                has: (id: string) =>
                  user === "host"
                    ? id === config.commandRoleId
                    : id === config.currentWeekRoleId && holders.has(user),
              },
              remove: async () => {
                if (failedRemovals.has(user)) throw new Error("Cannot remove");
                holders.delete(user);
              },
              add: async () => {
                throw new Error("These commands must not add roles");
              },
            },
          };
        },
      },
      channels: { fetch: async () => channel },
    },
    editReply: async (reply: string | { content?: string }) => {
      const content = typeof reply === "string" ? reply : reply.content;
      if (content) replies.push(content);
      return {
        awaitMessageComponent: async () => ({
          customId: "advance-week:confirm:command",
          deferUpdate: async () => {},
        }),
      };
    },
  } as unknown as ChatInputCommandInteraction<"cached">;
  return {
    competition,
    interaction,
    holders,
    fetchedMembers,
    replies,
    failedRemovals,
    roleFetches: () => roleFetches,
  };
}

test("ending clears only this competition's real players, including missed players; reopening leaves roles alone", async () => {
  const state = setup();
  await emCommand.execute(state.interaction);
  expect(state.fetchedMembers.sort()).toEqual(
    Array.from({ length: 6 }, (_, index) => `player${index}`)
  );
  expect([...state.holders]).toEqual(["other-league-player"]);
  state.fetchedMembers.length = 0;
  const roleFetches = state.roleFetches();

  await unendCommand.execute(state.interaction);
  expect(getActiveCompetition(input.guildId, 5)?.id).toBe(state.competition.id);
  expect(state.fetchedMembers).toEqual([]);
  expect(state.roleFetches()).toBe(roleFetches);
  expect([...state.holders]).toEqual(["other-league-player"]);
});

test("failed ending removals keep the competition ended and can be retried", async () => {
  const state = setup();
  state.failedRemovals.add("player0");
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    await emCommand.execute(state.interaction);
    expect(getActiveCompetition(input.guildId, 5)).toBeUndefined();
    expect(state.replies.at(-1)).toContain("Run /em again to retry");
    expect([...state.holders]).toEqual(["player0", "other-league-player"]);
    state.failedRemovals.clear();
    await emCommand.execute(state.interaction);
    expect([...state.holders]).toEqual(["other-league-player"]);
  } finally {
    log.mockRestore();
  }
});

test("confirmed forced week advancement deletes competitions without touching roles", async () => {
  const state = setup();
  const holders = [...state.holders];
  await advanceWeekCommand.execute(state.interaction);
  expect(getAdvanceWeekPreview(input.guildId)).toMatchObject({
    currentWeek: 2,
    competitions: [],
  });
  expect(state.fetchedMembers).toEqual(["host"]);
  expect(state.roleFetches()).toBe(0);
  expect([...state.holders]).toEqual(holders);
  expect(state.replies.join("\n")).not.toContain("current week role");
});
