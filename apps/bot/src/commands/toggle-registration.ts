import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { updateRegistrationMessages } from "../lib/registration-messages";
import { toggleRegistration } from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import type { BotCommand } from "./command";

export const toggleRegistrationCommand = {
  data: new SlashCommandBuilder()
    .setName("toggle_registration")
    .setDescription(
      "Open or close registration for this league's active competition."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition = toggleRegistration(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply(
        `League ${context.leagueNumber} has no active competition. Start one with /nm first.`
      );
      return;
    }
    const content = `Registration is now ${competition.registrationOpen ? "open" : "closed"} for League ${competition.leagueNumber}, Week ${competition.weekNumber}.`;
    try {
      const channel = await interaction.guild.channels.fetch(
        context.league.infoChannelId
      );
      if (!channel?.isSendable())
        throw new Error("Information channel cannot receive messages.");
      await updateRegistrationMessages(channel, competition.id);
    } catch (error) {
      console.error(
        "Registration changed, but its registration message could not be updated.",
        error
      );
      await interaction.editReply(
        `${content} I could not update its registration message in <#${context.league.infoChannelId}>.`
      );
      return;
    }
    await interaction.editReply(content);
  },
} satisfies BotCommand;
