import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  SlashCommandBuilder,
  escapeMarkdown,
} from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { createMigration } from "../db/account-migrations";
import { getPlayer } from "../db/players";
import { sendMigrationReview } from "../lib/account-migration-review";
import { normalizeUuid, ranked, rankedLookupErrorMessage } from "../lib/ranked";
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
        `Your saved account already matches **${escapeMarkdown(profile.nickname)}**. Link the new account to Discord on Ranked before requesting migration.`
      );
      return;
    }

    const confirmId = `migration-confirm:${interaction.id}`;
    const cancelId = `migration-cancel:${interaction.id}`;
    const reply = await interaction.editReply({
      content: `Request migration from **${escapeMarkdown(player.ign)}** to **${escapeMarkdown(profile.nickname)}**? This preserves your league, clears retained percentages, and leaves previous competition results on the old account. Confirmation expires in 60 seconds.`,
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

    const current = getPlayer(interaction.guildId, interaction.user.id);
    if (current?.accountVersion !== player.accountVersion) {
      await interaction.editReply(
        `Another migration was done while the confirmation was open, changing your minecraft account from ${player.ign} to ${current?.ign}. Run /migrate_account again if this is not your desired account.`
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
        not_player: "You have no active player account.",
        same_account: "This is already your saved account.",
        active_registration:
          "You are registered in an active competition. Resolve that registration before retrying.",
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
          : "You already have a pending migration. Its review message has been refreshed."
      );
    } catch (error) {
      console.error("Could not deliver migration review.", error);
      await interaction.editReply(
        "Your request is saved, but the reviewer could not be reached. Notify a host or admin."
      );
    }
  },
} satisfies BotCommand;
