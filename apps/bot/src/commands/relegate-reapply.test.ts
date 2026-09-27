import { guildConfiguration } from "../../config/guilds";
import { beforeEach, expect, spyOn, test } from "bun:test";
import { type ChatInputCommandInteraction } from "discord.js";
import { relegateReapplyCommand } from "./relegate-reapply";
import { relegateGuild } from "../db/relegation";
import { players } from "../db/schema";
import { createMemberRoles, type MemberRolesMock } from "../testing/discord";
import {
  resetDatabase,
  database,
  input,
  endedMovementCompetition,
} from "../testing/competition";

beforeEach(resetDatabase);

function mockInteraction(replies: string[]) {
  const config = guildConfiguration[input.guildId]!;
  const attemptedUsers: string[] = [];
  const members = new Map<string, MemberRolesMock>();
  const interaction = {
    guildId: input.guildId,
    user: { id: "developer" },
    options: { getInteger: () => null },
    guild: {
      members: {
        fetch: async ({ user }: { user: string }) => {
          attemptedUsers.push(user);
          if (user === "league5player0")
            throw new Error("Missing Discord member");
          let member = members.get(user);
          if (!member) {
            member = createMemberRoles([
              { id: config.leagues[5]!.leagueRoleId, editable: true },
              { id: "unrelated", editable: false },
            ]);
            members.set(user, member);
          }
          return { roles: member.roles };
        },
      },
      roles: { fetch: async (id: string) => ({ id, editable: true }) },
    },
    editReply: async (reply: string | { content: string }) => {
      replies.push(typeof reply === "string" ? reply : reply.content);
    },
    followUp: async ({ content }: { content: string }) => {
      replies.push(content);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;
  return { interaction, members, attemptedUsers };
}

test("relegate_reapply is developer-only and repairs roles without touching saved data", async () => {
  const originalGuildId = input.guildId;
  input.guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[input.guildId]!;
  const mutableConfig = config as typeof config & { developerId?: string };
  const previousDeveloperId = mutableConfig.developerId;
  const replies: string[] = [];
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    mutableConfig.developerId = "developer";
    endedMovementCompetition();
    relegateGuild(input.guildId, [5]);
    const savedPlayers = database.select().from(players).all();

    const { interaction, members, attemptedUsers } = mockInteraction(replies);
    await relegateReapplyCommand.execute({
      ...interaction,
      user: { id: "other-user" },
    } as unknown as ChatInputCommandInteraction<"cached">);
    expect(replies.at(-1)).toBe("Only the configured developer can do this.");
    expect(attemptedUsers).toHaveLength(0);

    await relegateReapplyCommand.execute(interaction);
    expect(attemptedUsers).toEqual(["league5player0", "league5player6"]);
    // The demoted member holds the new league role alongside unrelated roles.
    expect([...members.get("league5player6")!.serverRoles].sort()).toEqual(
      [config.leagues[6]!.leagueRoleId, "unrelated"].sort()
    );
    expect(members.get("league5player6")!.calls).toEqual({
      add: 1,
      remove: 1,
      set: 0,
    });
    expect(replies.at(-1)).toContain("1 of 2 league roles re-applied");
    expect(replies.at(-1)).toContain("<@league5player0> → League 4");
    expect(replies.at(-1)).toContain("manually");
    // Repair touches Discord only; saved movements and memberships are unchanged.
    expect(database.select().from(players).all()).toEqual(savedPlayers);
  } finally {
    input.guildId = originalGuildId;
    mutableConfig.developerId = previousDeveloperId;
    log.mockRestore();
  }
});

test("relegate_reapply reports weeks without saved movements", async () => {
  const originalGuildId = input.guildId;
  input.guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[input.guildId]!;
  const mutableConfig = config as typeof config & { developerId?: string };
  const previousDeveloperId = mutableConfig.developerId;
  const replies: string[] = [];
  try {
    mutableConfig.developerId = "developer";
    const { interaction, attemptedUsers } = mockInteraction(replies);
    await relegateReapplyCommand.execute(interaction);
    expect(replies.at(-1)).toContain("no saved relegated movements");
    expect(attemptedUsers).toHaveLength(0);
  } finally {
    input.guildId = originalGuildId;
    mutableConfig.developerId = previousDeveloperId;
  }
});
