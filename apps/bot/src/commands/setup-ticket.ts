import {
  ApplicationIntegrationType,
  ChannelType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { getTicketMessageId, saveTicketMessageId } from "../db/guilds";
import { requireCommandGuild } from "../lib/command-context";
import { openTicketButton } from "../lib/tickets";
import type { BotCommand } from "./command";

export const setupTicketCommand = {
  data: new SlashCommandBuilder()
    .setName("setup_ticket")
    .setDescription("Send or update the ticket message in the ticket channel.")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Message text. Write \\n for a line break.")
        .setRequired(true)
        .setMaxLength(2000)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    if (!guild.ticketChannelId) {
      await interaction.editReply(
        "Tickets are not configured for this server."
      );
      return;
    }
    const channel = await interaction.guild.channels.fetch(
      guild.ticketChannelId
    );
    // Private ticket threads need a regular text channel.
    if (channel?.type !== ChannelType.GuildText) {
      await interaction.editReply("The ticket channel must be a text channel.");
      return;
    }
    // Slash command options are single-line, so allow an escaped line break.
    const payload = {
      content: interaction.options
        .getString("message", true)
        .replaceAll("\\n", "\n"),
      components: [openTicketButton()],
      allowedMentions: { parse: [] as never[] },
    };
    const savedId = getTicketMessageId(interaction.guildId);
    const previous = savedId
      ? await channel.messages.fetch(savedId).catch(() => null)
      : null;
    const message = previous
      ? await previous.edit(payload)
      : await channel.send(payload);
    saveTicketMessageId(interaction.guildId, message.id);
    await interaction.editReply(
      `${previous ? "Updated" : "Sent"} the ticket message in <#${channel.id}>.`
    );
  },
} satisfies BotCommand;
