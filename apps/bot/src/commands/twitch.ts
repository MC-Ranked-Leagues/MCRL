import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import {
  getActiveCompetition,
  getCompetitionRegistration,
} from "../db/competitions";
import { setPlayerTwitchUsername } from "../db/players";
import { replyWithCompetitionUpdate } from "../lib/competition-messages";
import { getOrCreatePlayerFromRole } from "../lib/player-from-role";
import { normalizeTwitchUsername } from "../lib/twitch";
import type { BotCommand } from "./command";

export const twitchCommand = {
  data: new SlashCommandBuilder()
    .setName("twitch")
    .setDescription("Save your Twitch username for registration exports.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Your Twitch username or profile URL.")
        .setRequired(true)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const username = normalizeTwitchUsername(
      interaction.options.getString("username", true)
    );
    if (!username) {
      await interaction.editReply(
        "Enter a Twitch username or profile URL, such as https://twitch.tv/your_name. Usernames can contain only letters, numbers, and underscores, up to 25 characters."
      );
      return;
    }
    const player = await getOrCreatePlayerFromRole(interaction);
    if (player.status === "error") {
      await interaction.editReply(player.message);
      return;
    }
    if (player.status === "no_role") {
      await interaction.editReply(
        "You have no saved Ranked Leagues account or league role in this server. Use /signup first."
      );
      return;
    }

    const saved = setPlayerTwitchUsername(
      interaction.guildId,
      interaction.user.id,
      username
    );
    if (!saved) {
      await interaction.editReply(
        "You have no saved Ranked Leagues account in this server. Use /signup or /reg first."
      );
      return;
    }

    const content = `Saved Twitch username **${escapeMarkdown(username)}**.`;
    const leagueNumber = player.player.leagueNumber;
    const competition =
      leagueNumber === null
        ? undefined
        : getActiveCompetition(interaction.guildId, leagueNumber);
    const league =
      leagueNumber === null
        ? undefined
        : guildConfiguration[interaction.guildId]?.leagues[leagueNumber];
    const registration = competition
      ? getCompetitionRegistration(competition.id)?.players.find(
          (entry) => entry.discordUserId === interaction.user.id
        )
      : undefined;
    if (competition && league && registration?.streaming) {
      await replyWithCompetitionUpdate(
        interaction,
        competition.id,
        league.infoChannelId,
        content
      );
      return;
    }
    await interaction.editReply(content);
  },
} satisfies BotCommand;
