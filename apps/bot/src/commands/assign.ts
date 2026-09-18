import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import { assignPlayerLeague, getPlayer } from "../db/players";
import { syncLeagueRole } from "../lib/league-roles";
import { requireCommandGuild } from "../lib/command-context";
import { ranked, rankedLookupErrorMessage } from "../lib/ranked";
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
    let account;
    if (!getPlayer(interaction.guildId, user.id)) {
      try {
        const profile = await ranked.users.get(`discord.${user.id}`);
        account = {
          discordUsername: user.username,
          minecraftUuid: profile.uuid,
          ign: profile.nickname,
        };
      } catch (error) {
        await interaction.editReply(rankedLookupErrorMessage(error, true));
        return;
      }
    }
    const result = assignPlayerLeague(
      interaction.guildId,
      user.id,
      leagueNumber,
      account
    );
    if (result !== "assigned") {
      await interaction.editReply(
        result === "account_owned"
          ? "This Minecraft account already belongs to another player."
          : "The player no longer exists. Run /assign again to look up their account."
      );
      return;
    }
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
        "The assignment was saved, but Discord roles could not be updated. Check Manage Roles and role ordering, then run /assign again."
      );
      return;
    }
    await interaction.editReply(
      `Assigned <@${user.id}> to League ${leagueNumber}.`
    );
  },
} satisfies BotCommand;
