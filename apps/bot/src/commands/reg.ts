import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { RankedClient, RankedError } from "mcsrranked-sdk";

import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition } from "../db/competitions";
import { registerPlayer } from "../db/registrations";
import { requireChannelLeague } from "../lib/command-context";
import { updateRegistrationMessages } from "../lib/registration-messages";
import type { BotCommand } from "./command";

const ranked = new RankedClient({ validation: "error" });

export const regCommand = {
  data: new SlashCommandBuilder()
    .setName("reg")
    .setDescription(
      "Register your linked Minecraft account for this league's competition."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = guildConfiguration[interaction.guildId];
    if (!guild) {
      await interaction.editReply("This server is not configured.");
      return;
    }
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const { league, leagueNumber } = context;
    const member = await interaction.guild.members.fetch({
      user: interaction.user.id,
      force: true,
    });
    // Hosts can register in any league, matching the old bot's administrator override.
    if (
      !member.roles.cache.has(league.leagueRoleId) &&
      !member.roles.cache.has(guild.commandRoleId)
    ) {
      await interaction.editReply(
        `You need the League ${leagueNumber} role to register here.`
      );
      return;
    }
    const competition = getActiveCompetition(interaction.guildId, leagueNumber);
    if (!competition) {
      await interaction.editReply(
        `League ${leagueNumber} has no active competition.`
      );
      return;
    }
    if (!competition.registrationOpen) {
      await interaction.editReply("Registration is currently closed.");
      return;
    }

    let profile;
    try {
      profile = await ranked.users.get(`discord.${interaction.user.id}`);
    } catch (error) {
      console.error(
        "Could not look up the player's MCSR Ranked account.",
        error
      );
      await interaction.editReply(registrationLookupErrorMessage(error));
      return;
    }

    const result = registerPlayer({
      competitionId: competition.id,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      minecraftUuid: profile.uuid,
      ign: profile.nickname,
      elo: profile.eloRate,
      registeredAt: new Date(),
    });
    if (result !== "registered") {
      const messages = {
        inactive:
          "No competition is active for the current league. Wait until its announcement is made.",
        closed: "Registration closed.",
        already_registered: "You are already registered.",
        account_registered:
          "Your Minecraft account is already registered by another Discord user.",
      };
      await interaction.editReply(messages[result]);
      return;
    }

    const content = `Registered **${escapeMarkdown(profile.nickname)}** for League ${leagueNumber}, Week ${competition.weekNumber}.`;
    try {
      const channel = await interaction.guild.channels.fetch(
        league.infoChannelId
      );
      if (!channel?.isSendable())
        throw new Error("Information channel cannot receive messages.");
      await updateRegistrationMessages(channel, competition.id);
    } catch (error) {
      // Registration remains valid even if Discord cannot refresh the public list.
      console.error(
        "Player registered, but the registration list could not be updated.",
        error
      );
      await interaction.editReply(
        `${content} I could not update the registration list in the info channel; however your registration is saved.`
      );
      return;
    }
    await interaction.editReply(content);
  },
} satisfies BotCommand;

export function registrationLookupErrorMessage(error: unknown): string {
  const details = (error instanceof RankedError ? error.details : undefined) as
    { error?: unknown; data?: { error?: unknown } } | undefined;
  const message = details?.data?.error ?? details?.error;
  return typeof message === "string" && message.includes("not exists")
    ? "No Minecraft account is linked to your Discord on MCSR Ranked. Link Discord in your MCSR Ranked profile settings, then try /reg again."
    : "An unexpected error occurred.";
}
