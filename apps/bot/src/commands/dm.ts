import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import {
  deleteActiveCompetition,
  getActiveCompetition,
} from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import type { BotCommand } from "./command";

export const dmCommand = {
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription(
      "Delete this league's active competition after confirmation."
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
      await interaction.editReply(
        `League ${context.leagueNumber} has no active competition to delete.`
      );
      return;
    }
    const confirmId = `dm:confirm:${interaction.id}`;
    const cancelId = `dm:cancel:${interaction.id}`;
    const reply = await interaction.editReply({
      content: `Delete League ${competition.leagueNumber}, Week ${competition.weekNumber}? This permanently deletes the competition and all its registrations, matches, and results. Confirmation expires in 60 seconds.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel("Confirm deletion")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
    let confirmation;
    try {
      confirmation = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (button) =>
          button.user.id === interaction.user.id &&
          [confirmId, cancelId].includes(button.customId),
        time: 60_000,
      });
    } catch {
      await interaction.editReply({
        content: "Deletion confirmation expired. Nothing was deleted.",
        components: [],
      });
      return;
    }
    await confirmation.deferUpdate();
    // Remove the controls before any further work so failed checks cannot leave a live prompt.
    await interaction.editReply({ components: [] });
    if (confirmation.customId === cancelId) {
      await interaction.editReply("Deletion cancelled. Nothing was deleted.");
      return;
    }
    // Permissions may have changed while the confirmation prompt was open.
    const actor = await interaction.guild.members.fetch({
      user: interaction.user.id,
      force: true,
    });
    if (!actor.roles.cache.has(guild.commandRoleId)) {
      await interaction.editReply(
        "You no longer have the required role to delete this competition."
      );
      return;
    }
    const deleted = deleteActiveCompetition(
      interaction.guildId,
      competition.id
    );
    await interaction.editReply(
      deleted
        ? `Deleted League ${competition.leagueNumber}, Week ${competition.weekNumber}, including its registrations, matches, and results.`
        : "That competition is no longer active or was already deleted. Nothing was deleted."
    );
  },
} satisfies BotCommand;
