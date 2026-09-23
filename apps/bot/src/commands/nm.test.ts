import { guildConfiguration } from "../../config/guilds";
import { beforeEach, expect, test } from "bun:test";
import { type ChatInputCommandInteraction } from "discord.js";
import { nmCommand } from "./nm";
import { getActiveCompetition } from "../db/competitions";
import { setCurrentWeek } from "../db/guilds";
import { resetDatabase, registrationChannel } from "../testing/competition";

beforeEach(resetDatabase);

test("new competitions use the stored guild week", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const config = guildConfiguration[guildId]!;
  const [leagueNumberText, league] = Object.entries(config.leagues)[0]!;
  const leagueNumber = Number(leagueNumberText);
  const { channel } = registrationChannel();
  const replies: string[] = [];
  setCurrentWeek(guildId, 12);

  await nmCommand.execute({
    guildId,
    channelId: league.infoChannelId,
    member: { roles: { cache: { has: () => true } } },
    guild: { channels: { fetch: async () => channel } },
    editReply: async (message: string) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">);

  expect(getActiveCompetition(guildId, leagueNumber)?.weekNumber).toBe(12);
  expect(replies.at(-1)).toContain("Week 12");
});
