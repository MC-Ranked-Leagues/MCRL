import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { assignPlayerLeague } from "../db/players";
import { syncLeagueRole } from "../lib/league-roles";
import { requireCommandGuild } from "../lib/command-context";
import type { BotCommand } from "./command";

export const assignCommand = {
  data: new SlashCommandBuilder()
    .setName("assign")
    .setDescription("Replace a user's league role.")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to assign.").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("league")
        .setDescription("Destination league number.")
        .setRequired(true)
        .setMinValue(1)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    const leagueNumber = interaction.options.getInteger("league", true);
    const league = guild.leagues[leagueNumber];
    if (!league) {
      await interaction.editReply(
        `League ${leagueNumber} is not configured for this server.`
      );
      return;
    }
    const user = interaction.options.getUser("user", true);
    assignPlayerLeague(interaction.guildId, user.id, leagueNumber);
    try {
      await syncLeagueRole(
        interaction.guild,
        guild,
        user.id,
        leagueNumber,
        `Assigned by ${interaction.user.id}`
      );
    } catch (error) {
      console.error("Could not update league roles.", error);
      await interaction.editReply(
        "The stored assignment was updated if the player exists, but Discord roles could not be updated. Check Manage Roles and role ordering, then run /assign again."
      );
      return;
    }
    await interaction.editReply(
      `Assigned <@${user.id}> to League ${leagueNumber}.`
    );
  },
} satisfies BotCommand;
