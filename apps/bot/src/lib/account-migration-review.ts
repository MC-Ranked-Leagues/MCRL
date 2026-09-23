import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  escapeMarkdown,
  type ButtonInteraction,
  type Client,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import {
  decideMigration,
  getMigration,
  getMigrationHistory,
  saveMigrationMessage,
} from "../db/account-migrations";
import { getPlayerById } from "../db/players";
import { ranked } from "./ranked";

type Migration = NonNullable<ReturnType<typeof getMigration>>;

export async function sendMigrationReview(client: Client, request: Migration) {
  const player = getPlayerById(request.playerId)!;
  const reviewerId = guildConfiguration[player.guildId]!.signup!.reviewerId;
  const reviewer = await client.users.fetch(reviewerId);
  const channel = await reviewer.createDM();
  const history = getMigrationHistory(
    player.guildId,
    player.discordUserId
  ).filter((entry) => entry.id !== request.id);
  const approved = history.filter((entry) => entry.status === "approved");
  const content = [
    `Account migration for **${escapeMarkdown(player.discordUsername)}**`,
    `Current account: **${escapeMarkdown(request.previousIgn)}**`,
    `Requested account: **${escapeMarkdown(request.ign)}**`,
    `League: ${player.leagueNumber ?? "unassigned"}`,
    `Previous requests: ${history.length}. Approved migrations: ${approved.length}.`,
    `Last approved migration: ${approved[0]?.decidedAt?.toISOString().slice(0, 10) ?? "none"}.`,
    "Approval preserves the league and clears retained percentages.",
  ].join("\n");
  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`migration:approve:${request.id}`)
        .setLabel("Approve migration")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`migration:deny:${request.id}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
  const previous = request.reviewMessageId
    ? await channel.messages.fetch(request.reviewMessageId).catch(() => null)
    : null;
  const payload = {
    content,
    components,
    allowedMentions: { parse: [] as never[] },
  };
  const message = previous
    ? await previous.edit(payload)
    : await channel.send(payload);
  saveMigrationMessage(request.id, message.id, reviewerId);
}

export async function handleMigrationReview(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [, action, id] = interaction.customId.split(":");
  const request = getMigration(Number(id));
  const player = request && getPlayerById(request.playerId);
  const config = player && guildConfiguration[player.guildId];
  if (
    !request ||
    !player ||
    !config?.signup ||
    config.signup.reviewerId !== interaction.user.id ||
    request.reviewerId !== interaction.user.id ||
    request.reviewMessageId !== interaction.message.id
  ) {
    await interaction.editReply(
      "This migration is unavailable or you are not its reviewer."
    );
    return;
  }

  const guild = await interaction.client.guilds.fetch(player.guildId);
  const reviewer = await guild.members.fetch({
    user: interaction.user.id,
    force: true,
  });
  if (!reviewer.roles.cache.has(config.commandRoleId)) {
    await interaction.editReply(
      "Migration review requires the configured host role."
    );
    return;
  }
  if (request.status !== "pending") {
    await interaction.editReply(`This migration is already ${request.status}.`);
    return;
  }
  if (action !== "approve" && action !== "deny") {
    await interaction.editReply("Unknown migration action.");
    return;
  }

  const profile =
    action === "approve"
      ? await ranked.users.get(`discord.${player.discordUserId}`)
      : undefined;
  const result = decideMigration(
    request.id,
    interaction.user.id,
    action === "approve",
    profile?.uuid
  );
  const failures = {
    resolved: "This migration is already resolved.",
    forbidden: "Only the assigned reviewer can decide this migration.",
    link_changed:
      "The Ranked link changed. Deny this request and ask the player to submit another.",
    account_changed: "The saved account changed. Deny this stale request.",
    active_registration:
      "Resolve the player's active competition registration before approving migration.",
    account_owned: "The requested Minecraft account belongs to another player.",
  };
  if (result !== "approved" && result !== "denied") {
    await interaction.editReply(failures[result]);
    return;
  }

  await interaction.editReply(`Migration ${result}.`);
  await interaction.message.edit({
    content: `${interaction.message.content}\n\nMigration ${result}.`,
    components: [],
  });
  const applicant = await interaction.client.users.fetch(player.discordUserId);
  await applicant
    .send(
      result === "approved"
        ? `Migration approved: ${request.previousIgn} → ${request.ign}. Your league is unchanged and retained percentages have been cleared. Use /reg to register.`
        : "Your account migration was denied."
    )
    .catch((error: unknown) =>
      console.error("Could not notify migration applicant.", error)
    );
}
