import { expect, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { formatRankedRegistrationExport, listCommand } from "./list";

test("only hosts can export registrations", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  const replies: string[] = [];
  const interaction = {
    guildId,
    member: { roles: { cache: { has: () => false } } },
    editReply: async (message: string) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;

  await listCommand.execute(interaction);

  expect(replies).toEqual([
    "You do not have the required role to use this command.",
  ]);
});

test("ranked exports include retained percentages and Twitch usernames only for streaming registrations", () => {
  expect(
    JSON.parse(
      formatRankedRegistrationExport([
        {
          ign: "Streamer",
          streaming: true,
          twitch: "streamer_live",
          percentageHistory: [
            { week: 1, league: 5, percentage: 0 },
            { week: 3, league: 5, percentage: 60.125 },
            { week: 4, league: 5, percentage: 90 },
          ],
        },
        {
          ign: "PrivatePlayer",
          streaming: false,
          twitch: "private_channel",
          percentageHistory: [],
        },
        {
          ign: "NoTwitch",
          streaming: false,
          twitch: null,
          percentageHistory: null,
        },
      ])
    )
  ).toEqual([
    {
      ign: "Streamer",
      twitch_username: "streamer_live",
      display_name: "Streamer",
      history: [0, 60.125, 90],
    },
    {
      ign: "PrivatePlayer",
      twitch_username: "",
      display_name: "PrivatePlayer",
      history: [],
    },
    {
      ign: "NoTwitch",
      twitch_username: "",
      display_name: "NoTwitch",
      history: [],
    },
  ]);
});
