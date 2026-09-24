import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { getActiveCompetition, setCompetitionHost } from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { ranked, rankedLookupErrorMessage } from "../lib/ranked";
import type { BotCommand } from "./command";

export const hostCommand = {
  data: new SlashCommandBuilder()
    .setName("host")
    .setDescription("Set the Minecraft host for this competition.")
    .addStringOption((option) =>
      option
        .setName("mc_name")
        .setDescription(
          "Minecraft name. Defaults to your Discord-linked account."
        )
        .setMinLength(1)
        .setMaxLength(16)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply("No competition is active for this league.");
      return;
    }

    const mcName = interaction.options.getString("mc_name")?.trim();
    if (mcName !== undefined && !/^[a-zA-Z0-9_]{1,16}$/.test(mcName)) {
      await interaction.editReply(
        "Enter a Minecraft name using letters, numbers, or underscores."
      );
      return;
    }

    let profile;
    try {
      profile = await ranked.users.get(
        mcName ?? `discord.${interaction.user.id}`
      );
    } catch (error) {
      console.error("Could not look up the competition host account.", error);
      await interaction.editReply(
        mcName !== undefined
          ? "Could not find that Minecraft account on MCSR Ranked. Check the name and try again."
          : rankedLookupErrorMessage(error)
      );
      return;
    }

    if (
      !setCompetitionHost(interaction.guildId, competition.id, profile.uuid)
    ) {
      await interaction.editReply(
        "That competition is no longer active. No host was saved."
      );
      return;
    }
    await interaction.editReply(
      `Host set to **${escapeMarkdown(profile.nickname)}** for League ${context.leagueNumber}, Week ${competition.weekNumber}.`
    );
  },
} satisfies BotCommand;
