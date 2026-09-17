import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { getActiveCompetition } from "../db/competitions";
import { guildConfiguration } from "../../config/guilds";
import { getCompetitionStandings } from "../db/matches";
import { clearTestRegistrations } from "../db/registrations";
import { updateRegistrationMessages } from "../lib/registration-messages";
import { updateLeaderboardMessages } from "../lib/leaderboard-messages";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import type { BotCommand } from "./command";

export const testClearCommand = {
  data: new SlashCommandBuilder()
    .setName("test-clear")
    .setDescription(
      "Remove test registrations from this league after confirmation."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    if (guild.dev !== true) {
      await interaction.editReply(
        "Test clear is only available in servers configured with dev: true."
      );
      return;
    }
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply(
        `League ${context.leagueNumber} has no active competition.`
      );
      return;
    }
    const confirmId = `test-clear:confirm:${interaction.id}`;
    const cancelId = `test-clear:cancel:${interaction.id}`;
    const reply = await interaction.editReply({
      content: `Remove all test registrations added by /test_fill from League ${competition.leagueNumber}, Week ${competition.weekNumber}? Their imported results will also be deleted. The competition, matches, and regular registrations will be kept. Confirmation expires in 60 seconds.`,
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
    const currentGuild = guildConfiguration[interaction.guildId];
    if (
      currentGuild?.dev !== true ||
      !actor.roles.cache.has(currentGuild.commandRoleId)
    ) {
      await interaction.editReply(
        "Test clear is no longer allowed for you in this server. Nothing was deleted."
      );
      return;
    }
    const result = clearTestRegistrations(interaction.guildId, competition.id);
    if (result.status === "inactive") {
      await interaction.editReply(
        "That competition is no longer active. Nothing was deleted."
      );
      return;
    }
    const content = `Removed ${result.removed} test registrations and their associated results.`;
    // Include imported matches so a retry can recreate a failed leaderboard send.
    const standings = getCompetitionStandings(competition.id)!;
    const hasLeaderboard =
      standings.currentSeed > 0 ||
      standings.competition.leaderboardMessageIds.length > 0;
    try {
      const channel = await interaction.guild.channels.fetch(
        context.league.infoChannelId
      );
      if (!channel?.isSendable())
        throw new Error("Information channel cannot receive messages.");
      const updates = await Promise.allSettled([
        updateRegistrationMessages(channel, competition.id),
        // Avoid creating a leaderboard for a registration-only test.
        ...(hasLeaderboard
          ? [updateLeaderboardMessages(channel, competition.id)]
          : []),
      ]);
      for (const update of updates)
        if (update.status === "rejected") throw update.reason;
    } catch (error) {
      console.error(
        "Test registrations cleared, but messages could not be refreshed.",
        error
      );
      await interaction.editReply(
        `${content} I could not refresh all messages. The deletion is saved; run /test-clear again to retry the refresh.`
      );
      return;
    }
    await interaction.editReply(content);
  },
} satisfies BotCommand;
