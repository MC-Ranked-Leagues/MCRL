import type { ChatInputCommandInteraction } from "discord.js";

import {
  guildConfiguration,
  type GuildConfiguration,
} from "../../config/guilds";

export async function requireCommandGuild(
  interaction: ChatInputCommandInteraction<"cached">
) {
  const guild = guildConfiguration[interaction.guildId];
  if (!guild) {
    await interaction.editReply("This server is not configured.");
    return;
  }
  if (!interaction.member.roles.cache.has(guild.commandRoleId)) {
    await interaction.editReply(
      "You do not have the required role to use this command."
    );
    return;
  }
  return guild;
}

export async function requireChannelLeague(
  interaction: ChatInputCommandInteraction<"cached">,
  guild: GuildConfiguration
) {
  const leagues = Object.entries(guild.leagues).filter(
    ([, league]) =>
      league.infoChannelId === interaction.channelId ||
      league.chatChannelId === interaction.channelId
  );
  if (leagues.length !== 1) {
    await interaction.editReply(
      leagues.length === 0
        ? "Run this command in a configured league information or chat channel."
        : "This channel is configured for multiple leagues. Fix the server configuration first."
    );
    return;
  }
  const [number, league] = leagues[0]!;
  return { leagueNumber: Number(number), league };
}
