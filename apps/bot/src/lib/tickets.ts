import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { nextTicketNumber } from "../db/guilds";

export function openTicketButton() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:open")
      .setLabel("Open ticket")
      .setStyle(ButtonStyle.Primary)
  );
}

async function openTicket(interaction: ButtonInteraction<"cached">) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channelId = guildConfiguration[interaction.guildId]?.ticketChannelId;
  const channel = interaction.channel;
  if (
    !channelId ||
    interaction.channelId !== channelId ||
    channel?.type !== ChannelType.GuildText
  ) {
    await interaction.editReply("Tickets are not available here.");
    return;
  }
  const thread = await channel.threads.create({
    name: `Ticket #${nextTicketNumber(interaction.guildId)}`,
    type: ChannelType.PrivateThread,
    invitable: false,
    reason: `Ticket opened by ${interaction.user.id}`,
  });
  // The mention adds the opener to the private thread.
  await thread.send({
    content: `<@${interaction.user.id}>, describe your issue here and a host will reply. Close the ticket once it is resolved.`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket:close")
          .setLabel("Close ticket")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
    allowedMentions: { users: [interaction.user.id] },
  });
  await interaction.editReply(`Your ticket is open: <#${thread.id}>`);
}

// Only the opener and people who can see the ticket channel's private threads
// can see this button, so anyone who clicks it may close the ticket.
async function closeTicket(interaction: ButtonInteraction<"cached">) {
  const thread = interaction.channel;
  if (!thread?.isThread()) {
    await interaction.reply({
      content: "This button only works inside a ticket.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.update({ components: [] });
  await thread.send({
    content: `Ticket closed by <@${interaction.user.id}>.`,
    allowedMentions: { parse: [] },
  });
  // Locking keeps members without Manage Threads from reopening it by posting.
  await thread.setLocked(true, `Ticket closed by ${interaction.user.id}`);
  await thread.setArchived(true, `Ticket closed by ${interaction.user.id}`);
}

export async function handleTicketButton(interaction: ButtonInteraction) {
  if (!interaction.inCachedGuild()) return;
  try {
    if (interaction.customId === "ticket:open") await openTicket(interaction);
    if (interaction.customId === "ticket:close") await closeTicket(interaction);
  } catch (error) {
    console.error(`Ticket action ${interaction.customId} failed.`, error);
    const content = "Could not complete the ticket action. Ask a host.";
    if (interaction.deferred || interaction.replied) {
      await interaction
        .followUp({ content, flags: MessageFlags.Ephemeral })
        .catch(() => {});
    } else {
      await interaction
        .reply({ content, flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  }
}
