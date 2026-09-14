import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

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
    const roleIds = Object.values(guild.leagues).map(
      (entry) => entry.leagueRoleId
    );
    const user = interaction.options.getUser("user", true);
    const member = await interaction.guild.members.fetch({
      user: user.id,
      force: true,
    });
    const targetRole = await interaction.guild.roles.fetch(league.leagueRoleId);
    const previousRoles = member.roles.cache.filter(
      (role) => role.id !== league.leagueRoleId && roleIds.includes(role.id)
    );
    if (!targetRole?.editable || previousRoles.some((role) => !role.editable)) {
      await interaction.editReply(
        "I need Manage Roles and a bot role above the league roles being changed."
      );
      return;
    }
    // Add first so a failed assignment leaves the user's existing league role intact.
    await member.roles.add(targetRole, `Assigned by ${interaction.user.id}`);
    try {
      if (previousRoles.size > 0) {
        await member.roles.remove(
          [...previousRoles.keys()],
          `Assigned by ${interaction.user.id}`
        );
      }
    } catch (error) {
      console.error("Failed to remove previous league roles.", error);
      await interaction.editReply(
        `Added League ${leagueNumber} for <@${user.id}>, but could not remove their previous league roles. Run /assign again to finish.`
      );
      return;
    }
    await interaction.editReply(
      `Assigned <@${user.id}> to League ${leagueNumber}.`
    );
  },
} satisfies BotCommand;
