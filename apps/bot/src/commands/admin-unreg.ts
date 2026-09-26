import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { unregisterCompetitionPlayer } from "../lib/unregistration";
import type { BotCommand } from "./command";

export const adminUnregCommand = {
  data: new SlashCommandBuilder()
    .setName("admin_unreg")
    .setDescription("Remove a player from this league's competition.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Player to unregister.")
        .setRequired(true)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    await unregisterCompetitionPlayer(interaction, true);
  },
} satisfies BotCommand;
