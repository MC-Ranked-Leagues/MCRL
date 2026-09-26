import { beforeEach, expect, test } from "bun:test";
import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import {
  getActiveCompetition,
  startCompetition,
  toggleRegistration,
} from "../db/competitions";
import { registerPlayer } from "../db/registrations";
import { getPlayer } from "../db/players";
import { updateRegistrationMessages } from "../lib/registration-messages";
import {
  input,
  registrationChannel,
  resetDatabase,
} from "../testing/competition";
import { twitchCommand } from "./twitch";

beforeEach(resetDatabase);

test("changing a streamer's Twitch username refreshes the registration message", async () => {
  const guildId = Object.keys(guildConfiguration)[0]!;
  input.guildId = guildId;
  startCompetition(input);
  toggleRegistration(guildId, input.leagueNumber);
  const competition = getActiveCompetition(guildId, input.leagueNumber)!;
  expect(
    registerPlayer(
      {
        competitionId: competition.id,
        discordUserId: "streamer",
        discordUsername: "streamer",
        minecraftUuid: "streamer-uuid",
        ign: "Streamer",
        streaming: true,
        registeredAt: new Date(),
      },
      { twitch: "old_channel" }
    )
  ).toBe("registered");
  const { channel, messages } = registrationChannel();
  await updateRegistrationMessages(channel, competition.id);

  const replies: unknown[] = [];
  await twitchCommand.execute({
    guildId,
    user: { id: "streamer" },
    options: { getString: () => "new_channel" },
    guild: { channels: { fetch: async () => channel } },
    editReply: async (message: unknown) => {
      replies.push(message);
    },
  } as unknown as ChatInputCommandInteraction<"cached">);

  expect(getPlayer(guildId, "streamer")?.twitch).toBe("new_channel");
  expect([...messages.values()].join("\n")).toContain("Twitch: new\\_channel");
  expect([...messages.values()].join("\n")).not.toContain("old\\_channel");
  expect(replies).toHaveLength(1);
});
