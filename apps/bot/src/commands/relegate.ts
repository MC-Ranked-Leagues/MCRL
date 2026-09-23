import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { relegateGuild } from "../db/relegation";
import { syncLeagueRole } from "../lib/league-roles";
import { requireCommandGuild } from "../lib/command-context";
import { chunkMessage } from "../lib/chunk-message";
import type { BotCommand } from "./command";

export const relegateCommand = {
  data: new SlashCommandBuilder()
    .setName("relegate")
    .setDescription("Apply this week's league movements across the server.")
    .addBooleanOption((option) =>
      option
        .setName("force")
        .setDescription(
          "Skip missing or active leagues and process ended competitions."
        )
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const result = relegateGuild(
      interaction.guildId,
      Object.keys(guild.leagues).map(Number),
      interaction.options.getBoolean("force") ?? false
    );
    const skipped = result.skipped.map(
      ({ leagueNumber, reason }) =>
        `League ${leagueNumber}: ${reason === "missing" ? "no current-week competition" : reason === "active" ? "competition still active" : "already processed"}.`
    );
    if (result.status === "blocked") {
      await interaction.editReply(
        [
          `Week ${result.week} cannot be relegated. No new movements were applied.`,
          ...skipped,
          "End the remaining competitions, or use force:true to skip them.",
        ].join("\n")
      );
      return;
    }
    if (result.roleAssignments.length) {
      await interaction.editReply(
        "Movements saved. Updating Discord league roles..."
      );
    }
    const failures: string[] = [];
    for (const assignment of result.roleAssignments) {
      try {
        await syncLeagueRole(
          interaction.guild,
          guild,
          assignment.discordUserId,
          assignment.leagueNumber,
          "League movement"
        );
      } catch (error) {
        console.error(
          `Could not update league role for ${assignment.discordUserId}.`,
          error
        );
        failures.push(
          `<@${assignment.discordUserId}> → League ${assignment.leagueNumber}`
        );
      }
    }
    const roleSummary = `${result.roleAssignments.length - failures.length} league roles updated.`;
    const lines = [
      result.processed.length
        ? `Week ${result.week} movements saved.`
        : "No competitions remain eligible for relegation.",
      ...result.processed.map(
        ({ leagueNumber, promoted, demoted }) =>
          `League ${leagueNumber}: ${promoted} promoted, ${demoted} demoted.`
      ),
      ...skipped,
      roleSummary,
      "The week is unchanged. Use /advance_week when ready.",
    ];
    if (failures.length) {
      lines.push(
        "These role updates failed. Apply the listed league roles manually; saved movements are unchanged:",
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
