import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
  MessageFlags,
  type ButtonInteraction,
  type Client,
} from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import { getPlayer, getPlayerById } from "../db/players";
import {
  createMigration,
  decideMigration,
  getMigration,
  getMigrationHistory,
  saveMigrationMessage,
} from "../db/account-migrations";
import { ranked, rankedLookupErrorMessage, normalizeUuid } from "../lib/ranked";
import type { BotCommand } from "./command";

export const migrateAccountCommand = {
  data: new SlashCommandBuilder()
    .setName("migrate_account")
    .setDescription(
      "Request host approval to change your saved Minecraft account."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const config = guildConfiguration[interaction.guildId];
    if (!config?.signup) {
      await interaction.editReply(
        "Account review is not configured for this server."
      );
      return;
    }
    const player = getPlayer(interaction.guildId, interaction.user.id);
    if (!player || player.status !== "active") {
      await interaction.editReply(
        "You have no saved player account. Use /signup or register with your league role first."
      );
      return;
    }
    let profile;
    try {
      profile = await ranked.users.get(`discord.${interaction.user.id}`);
    } catch (error) {
      await interaction.editReply(rankedLookupErrorMessage(error));
      return;
    }
    if (player.minecraftUuid === normalizeUuid(profile.uuid)) {
      await interaction.editReply(
        `Your saved account already matches ${escapeMarkdown(profile.nickname)}. If this is what you intend to play on, then there is no need for migration. If not, link the new account to Discord on Ranked before requesting migration.`
      );
      return;
    }
    const confirmId = `migration-confirm:${interaction.id}`;
    const cancelId = `migration-cancel:${interaction.id}`;
    const reply = await interaction.editReply({
      content: `Request migration from **${escapeMarkdown(player.ign)}** to **${escapeMarkdown(profile.nickname)}**? This preserves your league, but it resets your average, and leaves previous competition results on the old account. Confirmation expires in 60 seconds.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel("Request migration")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
    const confirmation = await reply
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (button) =>
          button.user.id === interaction.user.id &&
          [confirmId, cancelId].includes(button.customId),
        time: 60_000,
      })
      .catch(() => null);
    if (!confirmation) {
      await interaction.editReply({
        content: "Migration confirmation expired. No request was submitted.",
        components: [],
      });
      return;
    }
    await confirmation.deferUpdate();
    await interaction.editReply({ components: [] });
    if (confirmation.customId === cancelId) {
      await interaction.editReply("Migration cancelled.");
      return;
    }
    // The confirmation must describe the account being replaced, even if another
    // request was approved while the confirmation was open.
    const current = getPlayer(interaction.guildId, interaction.user.id);
    if (current?.accountVersion !== player.accountVersion) {
      await interaction.editReply(
        `Another migration was done while the confirmation was open, changing your minecraft account from ${player.ign} to ${current?.ign}. Rerun the command again if this is not your desired account. `
      );
      return;
    }
    const result = createMigration({
      guildId: interaction.guildId,
      discordUserId: interaction.user.id,
      minecraftUuid: profile.uuid,
      ign: profile.nickname,
      reviewerId: config.signup.reviewerId,
    });
    if (result.status !== "created" && result.status !== "pending") {
      const messages = {
        not_player: "You have no saved player account.",
        same_account: "This is already your saved account.",
        active_registration:
          "You are registered in an active competition. Unregister if allowed, or ask a host to resolve the registration, then retry.",
        account_owned:
          "The new Minecraft account already belongs to another player in this server.",
      };
      await interaction.editReply(messages[result.status]);
      return;
    }
    try {
      await sendMigrationReview(interaction.client, result.request);
      await interaction.editReply(
        result.status === "created"
          ? "Your migration request has been sent for host approval."
          : "You already have a pending request. Its original accounts are unchanged and its review message has been refreshed."
      );
    } catch (error) {
      console.error("Could not deliver migration review.", error);
      await interaction.editReply(
        "Your request is saved, but I could not send the reviewer a DM. Ask a host to check reviewer configuration and DMs, then retry /migrate_account."
      );
    }
  },
} satisfies BotCommand;

async function sendMigrationReview(
  client: Client,
  request: NonNullable<ReturnType<typeof getMigration>>
) {
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
    "Approval preserves the league and clears retained placements.",
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
        ? `Migration approved: ${request.previousIgn} → ${request.ign}. Your league is unchanged and retained placements have been cleared. Use /reg to register.`
        : "Your account migration was denied."
    )
    .catch((error: unknown) =>
      console.error("Could not notify migration applicant.", error)
    );
}
