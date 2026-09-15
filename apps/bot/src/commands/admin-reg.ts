import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { getActiveCompetition } from "../db/competitions";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { registerCompetitionPlayer } from "../lib/registration";
import type { BotCommand } from "./command";

export const adminRegCommand = {
  data: new SlashCommandBuilder()
    .setName("admin_reg")
    .setDescription("Register a player for this league's competition.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Player to register.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("mc_username")
        .setDescription(
          "Minecraft username, overriding the player's Discord-linked account."
        )
        .setMinLength(1)
        .setMaxLength(16)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply(
        `League ${context.leagueNumber} has no active competition.`
      );
      return;
    }
    const username = interaction.options.getString("mc_username")?.trim();
    if (username !== undefined && !/^[A-Za-z0-9_]{1,16}$/.test(username)) {
      await interaction.editReply(
        "Enter a Minecraft username using letters, numbers, or underscores."
      );
      return;
    }
    await registerCompetitionPlayer(
      interaction,
      context.league,
      context.leagueNumber,
      competition,
      interaction.options.getUser("user", true),
      true,
      username
    );
  },
} satisfies BotCommand;
