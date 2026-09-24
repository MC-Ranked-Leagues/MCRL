import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { getActiveCompetition, getCompetitionExport } from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import type { BotCommand } from "./command";

type ExportPlayer = NonNullable<
  ReturnType<typeof getCompetitionExport>
>["players"][number];

export function formatRankedRegistrationExport(players: ExportPlayer[]) {
  return JSON.stringify(
    players.map((player) => ({
      ign: player.ign,
      twitch_username: player.streaming ? player.twitch! : "",
      display_name: player.ign,
    })),
    null,
    2
  );
}

export const listCommand = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription("Export the current registration list as a .ranked file.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const activeCompetition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!activeCompetition) {
      await interaction.editReply(
        `League ${context.leagueNumber} has no active competition.`
      );
      return;
    }
    const registration = getCompetitionExport(activeCompetition.id)!;
    if (registration.players.length === 0) {
      await interaction.editReply("There are no registered players to export.");
      return;
    }
    const content = formatRankedRegistrationExport(registration.players);
    const filename = `mcrl_${registration.competition.leagueNumber}_${registration.competition.weekNumber}.ranked`;
    await interaction.editReply({
      content: `Exported ${registration.players.length} players.`,
      files: [{ attachment: Buffer.from(content, "utf8"), name: filename }],
    });
  },
} satisfies BotCommand;
