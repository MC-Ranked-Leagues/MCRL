import { guildConfiguration } from "../../config/guilds";
import { beforeEach, expect, test } from "bun:test";
import { type ChatInputCommandInteraction } from "discord.js";
import { devChangeWeekCommand } from "./dev-change-week";
import { getCurrentWeek } from "../db/guilds";
import { resetDatabase } from "../testing/competition";

beforeEach(resetDatabase);

test("the developer week command denies other users and changes only the stored week", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[guildId]!;
  const mutableConfig = config as typeof config & { developerId?: string };
  const previousDeveloperId = mutableConfig.developerId;
  const replies: string[] = [];
  const interaction = {
    guildId,
    user: { id: "other-user" },
    options: { getInteger: () => 6 },
    editReply: async (message: string) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;

  try {
    mutableConfig.developerId = "developer";
    await devChangeWeekCommand.execute(interaction);
    expect(replies.at(-1)).toBe("Only the configured developer can do this.");
    expect(getCurrentWeek(guildId)).toBe(1);

    await devChangeWeekCommand.execute({
      ...interaction,
      user: { id: "developer" },
    } as unknown as ChatInputCommandInteraction<"cached">);
    expect(getCurrentWeek(guildId)).toBe(6);
    expect(replies.at(-1)).toContain("from 1 to 6");
  } finally {
    mutableConfig.developerId = previousDeveloperId;
  }
});
