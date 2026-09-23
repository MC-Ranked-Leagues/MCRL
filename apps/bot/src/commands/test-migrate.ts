import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  escapeMarkdown,
} from "discord.js";

import { setTestMigrationAccount } from "../db/account-migrations";
import { requireCommandGuild } from "../lib/command-context";
import { ranked } from "../lib/ranked";
import type { BotCommand } from "./command";

export const testMigrateCommand = {
  data: new SlashCommandBuilder()
    .setName("test_migrate")
    .setDescription("Change your saved Minecraft account to test migration.")
    .addStringOption((option) =>
      option
        .setName("ign")
        .setDescription(
          "Minecraft name to save as your account in this dev server."
        )
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(16)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    if (guild.dev !== true) {
      await interaction.editReply(
        "Test migration is only available in servers configured with dev: true."
      );
      return;
    }
    const ign = interaction.options.getString("ign", true).trim();
    if (!/^[a-zA-Z0-9_]{1,16}$/.test(ign)) {
      await interaction.editReply(
        "Enter a Minecraft name using letters, numbers, or underscores."
      );
      return;
    }
    let profile;
    try {
      profile = await ranked.users.get(ign);
    } catch (error) {
      console.error("Could not look up the test migration account.", error);
      await interaction.editReply(
        "Could not find this Minecraft account on MCSR Ranked. Check the IGN and try again."
      );
      return;
    }
    const result = setTestMigrationAccount({
      guildId: interaction.guildId,
      discordUserId: interaction.user.id,
      minecraftUuid: profile.uuid,
      ign: profile.nickname,
    });
    if (result !== "updated") {
      const messages = {
        not_dev:
          "Test migration is only available in servers configured with dev: true.",
        not_player:
          "You have no active saved player account in this server. Use /signup, /assign, or /reg first.",
        active_registration:
          "You are registered in an active competition. Resolve that registration before testing migration.",
        pending:
          "You have a pending migration request. Have the reviewer resolve it before testing again.",
        same_account:
          "This is already your saved account. Choose a different IGN.",
        account_owned:
          "This Minecraft account already belongs to another player in this server.",
      };
      await interaction.editReply(messages[result]);
      return;
    }
    await interaction.editReply(
      `Your saved account in this dev server is now **${escapeMarkdown(profile.nickname)}**. Your Ranked Discord link is unchanged. Run /reg to check the mismatch, then /migrate_account to request migration back to your linked account. Your league and retained percentages were preserved.`
    );
  },
} satisfies BotCommand;
