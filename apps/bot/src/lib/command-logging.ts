import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";

export async function sendCommandLog(
  interaction: ChatInputCommandInteraction<"cached">
): Promise<void> {
  const guild = guildConfiguration[interaction.guildId];

  if (!guild) {
    throw new Error(`Guild ${interaction.guildId} is not configured.`);
  }

  const channel = await interaction.guild.channels.fetch(guild.logChannelId);

  if (!channel?.isSendable()) {
    throw new Error(
      `The configured log channel for guild ${interaction.guildId} is unavailable or cannot receive messages.`
    );
  }

  const timestamp = Math.floor(interaction.createdTimestamp / 1_000);

  await channel.send({
    content: [
      `User: ${interaction.user.username} (${interaction.user.id})`,
      `Channel: <#${interaction.channelId}> (${interaction.channelId})`,
      `Command: ${interaction.toString()}`,
      `Time: <t:${timestamp}:f>`,
    ].join("\n"),
    allowedMentions: { parse: [] },
  });
}
