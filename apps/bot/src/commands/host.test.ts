import { beforeEach, expect, spyOn, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition, startCompetition } from "../db/competitions";
import { ranked } from "../lib/ranked";
import { input, resetDatabase } from "../testing/competition";
import { hostCommand } from "./host";

beforeEach(resetDatabase);

test("host resolves the linked account by default and accepts a Minecraft name", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const league = guildConfiguration[guildId]!.leagues[5]!;
  startCompetition({ ...input, guildId });
  const lookup = spyOn(ranked.users, "get").mockResolvedValue({
    uuid: "first-uuid",
    nickname: "FirstHost",
  } as Awaited<ReturnType<typeof ranked.users.get>>);
  const replies: string[] = [];
  let mcName: string | null = null;
  const interaction = {
    guildId,
    channelId: league.infoChannelId,
    user: { id: "helper" },
    member: { roles: { cache: { has: () => true } } },
    options: { getString: () => mcName },
    editReply: async (message: string) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;

  try {
    await hostCommand.execute(interaction);
    expect(lookup).toHaveBeenCalledWith("discord.helper");
    expect(getActiveCompetition(guildId, 5)).toMatchObject({
      hostMinecraftUuid: "first-uuid",
    });

    mcName = "Other_Host";
    lookup.mockResolvedValue({
      uuid: "other-uuid",
      nickname: "Other_Host",
    } as Awaited<ReturnType<typeof ranked.users.get>>);
    await hostCommand.execute(interaction);
    expect(lookup).toHaveBeenCalledWith("Other_Host");
    expect(getActiveCompetition(guildId, 5)).toMatchObject({
      hostMinecraftUuid: "other-uuid",
    });
    expect(replies.at(-1)).toContain("Other\\_Host");
  } finally {
    lookup.mockRestore();
  }
});
