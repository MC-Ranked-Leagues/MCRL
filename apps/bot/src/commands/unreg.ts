import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { unregisterCompetitionPlayer } from "../lib/unregistration";
import type { BotCommand } from "./command";

export const unregCommand = {
  data: new SlashCommandBuilder()
    .setName("unreg")
    .setDescription("Unregister yourself from this league's competition.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    await unregisterCompetitionPlayer(interaction, false);
  },
} satisfies BotCommand;
