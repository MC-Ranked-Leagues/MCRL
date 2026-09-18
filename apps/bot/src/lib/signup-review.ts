import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  escapeMarkdown,
  type ButtonInteraction,
  type Client,
  type Message,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import {
  decideSignup,
  getPlayerById,
  saveSignupMessage,
} from "../db/players";
import type { getPlayer } from "../db/players";
import { syncLeagueRole } from "./league-roles";
import { ranked } from "./ranked";

type Player = NonNullable<ReturnType<typeof getPlayer>>;

function signupButtons(player: Player, selectedLeague?: number) {
  const buttons =
    selectedLeague === undefined
      ? Object.keys(guildConfiguration[player.guildId]!.leagues).map((league) =>
          new ButtonBuilder()
            .setCustomId(`signup:pick:${player.id}:${league}`)
            .setLabel(`League ${league}`)
            .setStyle(ButtonStyle.Primary)
        )
      : [
          new ButtonBuilder()
            .setCustomId(`signup:approve:${player.id}:${selectedLeague}`)
            .setLabel(`Confirm League ${selectedLeague}`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`signup:back:${player.id}`)
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary),
        ];
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`signup:deny:${player.id}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
  );

  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttons.slice(index, index + 5)
      )
    );
  }
  return rows;
}

export async function sendSignupReview(client: Client, player: Player) {
  const reviewer = await client.users.fetch(
    guildConfiguration[player.guildId]!.signup!.reviewerId
  );
  const channel = await reviewer.createDM();
  const content = `Signup for **${escapeMarkdown(player.discordUsername)}**\nMinecraft: **${escapeMarkdown(player.ign)}**\n${player.signupDetails ?? ""}`;
  const previous = player.signupMessageId
    ? await channel.messages.fetch(player.signupMessageId).catch(() => null)
    : null;
  const payload = {
    content,
    components: signupButtons(player),
    allowedMentions: { parse: [] as never[] },
  };
  const message = previous
    ? await previous.edit(payload)
    : await channel.send(payload);
  saveSignupMessage(player.id, message.id);
}

export async function handleSignupReview(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [, action, id, selectedLeague] = interaction.customId.split(":");
  const player = getPlayerById(Number(id));
  const config = player && guildConfiguration[player.guildId];
  if (
    !player ||
    !config?.signup ||
    interaction.user.id !== config.signup.reviewerId ||
    player.signupMessageId !== interaction.message.id
  ) {
    await interaction.editReply(
      "This signup is unavailable or you are not its reviewer."
    );
    return;
  }
  if (player.status !== "pending") {
    await interaction.editReply(`This player is already ${player.status}.`);
    return;
  }

  const league = Number(selectedLeague);
  if ((action === "pick" || action === "approve") && !config.leagues[league]) {
    await interaction.editReply("That league is not configured.");
    return;
  }
  if (action === "pick" || action === "back") {
    await interaction.message.edit({
      components: signupButtons(player, action === "pick" ? league : undefined),
    });
    await interaction.editReply(
      action === "pick"
        ? `Confirm League ${league} using the review buttons.`
        : "Choose a league."
    );
    return;
  }
  if (action !== "approve" && action !== "deny") {
    await interaction.editReply("Unknown signup action.");
    return;
  }

  const guild = await interaction.client.guilds.fetch(player.guildId);
  const profile =
    action === "approve"
      ? await ranked.users.get(`discord.${player.discordUserId}`)
      : undefined;
  const result = decideSignup(
    player.id,
    action === "approve" ? league : undefined,
    profile?.uuid
  );
  if (result === "link_changed" || result === "resolved") {
    await interaction.editReply(
      result === "link_changed"
        ? "The linked account changed. Ask the player to restore the account used for signup before approval."
        : "This signup is already resolved."
    );
    return;
  }

  let outcome = `Signup ${result}.`;
  if (result === "approved") {
    try {
      await syncLeagueRole(
        guild,
        config,
        player.discordUserId,
        league,
        `Signup approved by ${interaction.user.id}`
      );
    } catch (error) {
      console.error("Signup saved but roles failed.", error);
      outcome +=
        " Membership is saved. Retry the role update with /assign or /signup.";
    }
  }

  await interaction.editReply(outcome);
  await interaction.message.edit({
    content: `${interaction.message.content}\n\n${outcome}`,
    components: [],
  });
  const applicant = await interaction.client.users.fetch(player.discordUserId);
  await applicant
    .send(
      result === "approved"
        ? `Welcome to Ranked Leagues! You have been placed in League ${league}. Make sure to read the server's league information.`
        : "Your league signup was declined. If you believe this was a mistake, contact an admin."
    )
    .catch((error: unknown) =>
      console.error("Could not notify signup applicant.", error)
    );
}

export async function moderateSignupChannel(message: Message) {
  if (!message.guild || message.author.bot) return;
  const config = guildConfiguration[message.guild.id];
  if (!config?.signup || message.channelId !== config.signup.channelId) return;
  const member = await message.guild.members.fetch({
    user: message.author.id,
    force: true,
  });
  if (!member.roles.cache.has(config.commandRoleId)) await message.delete();
}
