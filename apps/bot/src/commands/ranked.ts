import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  escapeMarkdown,
} from "discord.js";
import { ranked, rankedLookupErrorMessage } from "../lib/ranked";
import { formatDuration } from "../lib/time";
import type { BotCommand } from "./command";

export const rankedCommand = {
  data: new SlashCommandBuilder()
    .setName("ranked")
    .setDescription("Show your Discord-linked MCSR Ranked account info.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    let profile;
    try {
      profile = await ranked.users.get(`discord.${interaction.user.id}`);
    } catch (error) {
      await interaction.editReply(rankedLookupErrorMessage(error));
      return;
    }

    const season = profile.statistics.season;
    const completions = season.completions.ranked ?? 0;
    const average =
      completions > 0 && season.completionTime.ranked != null
        ? formatDuration(season.completionTime.ranked / completions)
        : "n/a";
    await interaction.editReply({
      content: [
        "**Your linked MCSR Ranked account**",
        `Minecraft: **${escapeMarkdown(profile.nickname)}**`,
        `UUID: ${profile.uuid}`,
        "**Current season**",
        `Current Elo: ${profile.eloRate ?? "n/a"}`,
        `Peak Elo: ${profile.seasonResult.highest ?? "n/a"}`,
        `Ranked completions: ${completions}`,
        `Ranked average: ${average}`,
        `Ranked PB: ${season.bestTime.ranked == null ? "n/a" : formatDuration(season.bestTime.ranked)}`,
        `Profile: <https://mcsrranked.com/profile/${profile.uuid}>`,
      ].join("\n"),
      allowedMentions: { parse: [] },
    });
  },
} satisfies BotCommand;
