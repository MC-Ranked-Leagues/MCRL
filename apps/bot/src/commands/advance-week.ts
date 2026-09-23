import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { advanceGuildWeek, getAdvanceWeekPreview } from "../db/competitions";
import { getGuildRegistrationDiscordIds } from "../db/registrations";
import { chunkMessage } from "../lib/chunk-message";
import { requireCommandGuild } from "../lib/command-context";
import { clearCurrentWeekRole } from "../lib/current-week-role";
import type { BotCommand } from "./command";

export const advanceWeekCommand = {
  data: new SlashCommandBuilder()
    .setName("advance_week")
    .setDescription("Delete this server's competitions and advance its week.")
    .addBooleanOption((option) =>
      option
        .setName("force")
        .setDescription("Delete competitions that have not used /relegate.")
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;

    const force = interaction.options.getBoolean("force") ?? false;
    const preview = getAdvanceWeekPreview(interaction.guildId);
    const unprocessedCompetitions = preview.competitions.filter(
      (competition) => !competition.hasUsedRelegate
    );
    if (unprocessedCompetitions.length && !force) {
      await interaction.editReply(
        `${unprocessedCompetitions.length} competition${unprocessedCompetitions.length === 1 ? " has" : "s have"} not used /relegate. Run /advance_week with force:true to delete them anyway.`
      );
      return;
    }
    const competitionList = preview.competitions.length
      ? preview.competitions
          .map(
            (competition) =>
              `- League ${competition.leagueNumber}, Week ${competition.weekNumber} (${competition.status}, ${competition.hasUsedRelegate ? "relegated" : "not relegated"})`
          )
          .join("\n")
      : "- No competitions";
    const confirmId = `advance-week:confirm:${interaction.id}`;
    const cancelId = `advance-week:cancel:${interaction.id}`;
    const reply = await interaction.editReply({
      content: `Advance from Week ${preview.currentWeek} to Week ${preview.currentWeek + 1}?\n\nThis permanently deletes every competition in this server with all registrations, matches, and results${force ? ", including competitions that have not used /relegate" : ""}:\n${competitionList}\n\n${guild.currentWeekRoleId ? "The configured current week role will be removed from registered players who hold it.\n\n" : ""}Confirmation expires in 60 seconds.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel("Delete and advance")
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
        content: "Week advancement expired. Nothing was deleted or changed.",
        components: [],
      });
      return;
    }

    await confirmation.deferUpdate();
    await interaction.editReply({ components: [] });
    if (confirmation.customId === cancelId) {
      await interaction.editReply(
        "Week advancement cancelled. Nothing was deleted or changed."
      );
      return;
    }

    // Permissions may have changed while the confirmation prompt was open.
    const actor = await interaction.guild.members.fetch({
      user: interaction.user.id,
      force: true,
    });
    if (!actor.roles.cache.has(guild.commandRoleId)) {
      await interaction.editReply(
        "You no longer have the required role to advance the week."
      );
      return;
    }

    const playerIds = guild.currentWeekRoleId
      ? getGuildRegistrationDiscordIds(interaction.guildId)
      : [];
    const result = advanceGuildWeek(
      interaction.guildId,
      preview.currentWeek,
      force
    );
    if (result === "stale_week") {
      await interaction.editReply(
        "The current week changed while confirmation was open. Nothing was deleted or changed; run /advance_week again."
      );
      return;
    }
    if (result === "unprocessed") {
      await interaction.editReply(
        "A competition that has not used /relegate appeared while confirmation was open. Nothing was deleted or changed; run /advance_week again to review it."
      );
      return;
    }
    let content = `Deleted all competitions and advanced the server to Week ${preview.currentWeek + 1}. Existing Discord messages were preserved.`;
    if (guild.currentWeekRoleId) {
      try {
        await interaction.editReply(
          `${content} Clearing the current week role...`
        );
        const { removed, failures } = await clearCurrentWeekRole(
          interaction.guild,
          guild,
          playerIds
        );
        content += ` Removed the current week role from ${removed} player${removed === 1 ? "" : "s"}.`;
        if (failures.length)
          content += `\nCould not remove the role from these players. Clear it manually:\n${failures.map((id) => `<@${id}>`).join("\n")}`;
      } catch (error) {
        console.error(
          "Week advanced, but the current week role could not be cleared.",
          error
        );
        content +=
          " Could not clear the current week role. Check the role configuration and permissions, then remove it manually from affected players.";
      }
    }
    const chunks = chunkMessage(content);
    await interaction.editReply({
      content: chunks[0]!,
      allowedMentions: { parse: [] },
    });
    for (const part of chunks.slice(1)) {
      await interaction.followUp({
        content: part,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
  },
} satisfies BotCommand;
