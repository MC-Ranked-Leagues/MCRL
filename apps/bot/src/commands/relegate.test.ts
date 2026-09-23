import { getPlayer } from "../db/players";
import { guildConfiguration } from "../../config/guilds";
import { beforeEach, expect, spyOn, test } from "bun:test";
import { Collection, type ChatInputCommandInteraction } from "discord.js";
import { relegateCommand } from "./relegate";
import { players } from "../db/schema";
import {
  resetDatabase,
  database,
  input,
  endedMovementCompetition,
} from "../testing/competition";

beforeEach(resetDatabase);

test("relegate applies roles once and reports failures for manual correction", async () => {
  const originalGuildId = input.guildId;
  input.guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[input.guildId]!;
  const replies: string[] = [];
  const updatedRoles: string[] = [];
  const attemptedUsers: string[] = [];
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    endedMovementCompetition();
    const interaction = {
      guildId: input.guildId,
      member: { roles: { cache: { has: () => true } } },
      options: { getBoolean: () => true },
      guild: {
        members: {
          fetch: async ({ user }: { user: string }) => {
            attemptedUsers.push(user);
            if (user === "league5player0")
              throw new Error("Missing Discord member");
            return {
              roles: {
                cache: new Collection([
                  [
                    config.leagues[5]!.leagueRoleId,
                    { id: config.leagues[5]!.leagueRoleId, editable: true },
                  ],
                  ["unrelated", { id: "unrelated", editable: false }],
                ]),
                add: async (role: { id: string }) => {
                  updatedRoles.push(`add:${role.id}`);
                },
                remove: async (ids: string[]) => {
                  updatedRoles.push(...ids.map((id) => `remove:${id}`));
                },
              },
            };
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
    await relegateCommand.execute(interaction);
    expect(attemptedUsers).toEqual(["league5player0", "league5player6"]);
    expect(updatedRoles).toEqual([
      `add:${config.leagues[6]!.leagueRoleId}`,
      `remove:${config.leagues[5]!.leagueRoleId}`,
    ]);
    expect(replies.at(-1)).toContain("1 league roles updated.");
    expect(replies.at(-1)).toContain("<@league5player0> → League 4");
    expect(replies.at(-1)).toContain("manually");
    expect(getPlayer(input.guildId, "league5player0")?.leagueNumber).toBe(4);
    const savedPlayers = database.select().from(players).all();
    await relegateCommand.execute(interaction);
    expect(attemptedUsers).toHaveLength(2);
    expect(database.select().from(players).all()).toEqual(savedPlayers);
  } finally {
    input.guildId = originalGuildId;
    log.mockRestore();
  }
});
