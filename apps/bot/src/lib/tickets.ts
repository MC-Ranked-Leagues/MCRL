import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { nextTicketNumber } from "../db/guilds";

// Custom IDs carry the linked thread or claim card, so tickets need no storage:
// ticket:claim:<threadId> on the library card, ticket:close:<cardId> in the thread.

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
  const tickets = guildConfiguration[interaction.guildId]?.tickets;
  const channel = interaction.channel;
  const library = tickets?.libraryChannelId
    ? await interaction.guild.channels
        .fetch(tickets.libraryChannelId)
        .catch(() => null)
    : null;
  if (
    !tickets ||
    interaction.channelId !== tickets.channelId ||
    channel?.type !== ChannelType.GuildText ||
    !library?.isSendable()
  ) {
    await interaction.editReply("Tickets are not available here.");
    return;
  }
  const number = nextTicketNumber(interaction.guildId);
  const thread = await channel.threads.create({
    name: `Ticket #${number}`,
    type: ChannelType.PrivateThread,
    invitable: false,
    reason: `Ticket opened by ${interaction.user.id}`,
  });
  const card = await library.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Ticket #${number}`)
        .setDescription(
          `Opened by <@${interaction.user.id}> in <#${thread.id}>.`
        )
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:claim:${thread.id}`)
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success)
      ),
    ],
    allowedMentions: { parse: [] },
  });
  // The mention adds the opener to the private thread.
  await thread.send({
    content: `<@${interaction.user.id}>, describe your issue here and a staff member will reply. Close the ticket once it is resolved.`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:close:${card.id}`)
          .setLabel("Close ticket")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
    allowedMentions: { users: [interaction.user.id] },
  });
  await interaction.editReply(`Your ticket is open: <#${thread.id}>`);
}

// The library channel is staff-only, so anyone who sees the card may claim it.
async function claimTicket(
  interaction: ButtonInteraction<"cached">,
  threadId: string
) {
  const thread = await interaction.guild.channels
    .fetch(threadId)
    .catch(() => null);
  if (!thread?.isThread() || thread.archived) {
    await interaction.reply({
      content: "This ticket is already closed.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.update({
    embeds: interaction.message.embeds.map((embed) =>
      EmbedBuilder.from(embed)
        .setColor(0x57f287)
        .addFields({ name: "Claimed by", value: `<@${interaction.user.id}>` })
    ),
    components: [],
  });
  await thread.members.add(interaction.user.id);
  await thread.send({
    content: `<@${interaction.user.id}> claimed this ticket.`,
    allowedMentions: { parse: [] },
  });
}

// Only the opener and people who can see the ticket channel's private threads
// can see this button, so anyone who clicks it may close the ticket.
async function closeTicket(
  interaction: ButtonInteraction<"cached">,
  cardId: string | undefined
) {
  const thread = interaction.channel;
  if (!thread?.isThread()) {
    await interaction.reply({
      content: "This button only works inside a ticket.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.update({ components: [] });
  const libraryChannelId =
    guildConfiguration[interaction.guildId]?.tickets?.libraryChannelId;
  // Tickets opened before the claim queue existed have no card.
  if (cardId && libraryChannelId) {
    const library = await interaction.guild.channels.fetch(libraryChannelId);
    if (library?.isTextBased())
      await library.messages.delete(cardId).catch((error: unknown) => {
        console.error("Could not delete the ticket claim card.", error);
      });
  }
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
  const [, action, id] = interaction.customId.split(":");
  try {
    if (action === "open") await openTicket(interaction);
    if (action === "claim" && id) await claimTicket(interaction, id);
    if (action === "close") await closeTicket(interaction, id);
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
