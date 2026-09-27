import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { getCurrentWeek } from "../db/guilds";
import { getRelegatedRoleAssignments } from "../db/relegation";
import { LeagueRoleUpdateError, syncLeagueRole } from "../lib/league-roles";
import { chunkMessage } from "../lib/chunk-message";
import type { BotCommand } from "./command";

export const relegateReapplyCommand = {
  data: new SlashCommandBuilder()
    .setName("relegate_reapply")
    .setDescription(
      "Re-apply Discord league roles from saved relegation movements."
    )
    .addIntegerOption((option) =>
      option
        .setName("week")
        .setDescription("Week to re-apply roles for. Defaults to current week.")
        .setMinValue(1)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = guildConfiguration[interaction.guildId];
    if (!guild) {
      await interaction.editReply("This server is not configured.");
      return;
    }
    if (!guild.developerId || interaction.user.id !== guild.developerId) {
      await interaction.editReply("Only the configured developer can do this.");
      return;
    }
    const week =
      interaction.options.getInteger("week") ??
      getCurrentWeek(interaction.guildId);
    const assignments = getRelegatedRoleAssignments(interaction.guildId, week);
    if (!assignments.length) {
      await interaction.editReply(
        `Week ${week} has no saved relegated movements to re-apply.`
      );
      return;
    }
    await interaction.editReply("Re-applying saved Discord league roles...");
    const failures: string[] = [];
    for (const assignment of assignments) {
      try {
        await syncLeagueRole(
          interaction.guild,
          guild,
          assignment.discordUserId,
          assignment.leagueNumber,
          "Re-applied league movement"
        );
      } catch (error) {
        console.error(
          `Could not re-apply league role for ${assignment.discordUserId}.`,
          error
        );
        const step =
          error instanceof LeagueRoleUpdateError
            ? ` (${error.step} failed)`
            : "";
        failures.push(
          `<@${assignment.discordUserId}> → League ${assignment.leagueNumber}${step}`
        );
      }
    }
    const lines = [
      `${assignments.length - failures.length} of ${assignments.length} league roles re-applied for Week ${week}. Saved movements were not changed.`,
    ];
    if (failures.length) {
      lines.push(
        "These role updates failed. Apply the listed league roles manually. Members marked (add failed) hold no league role and can re-apply through /signup:",
        ...failures
      );
    }
    const chunks = chunkMessage(lines.join("\n"));
    await interaction.editReply({
      content: chunks[0]!,
      allowedMentions: { parse: [] },
    });
    for (const content of chunks.slice(1)) {
      await interaction.followUp({
        content,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
  },
} satisfies BotCommand;
