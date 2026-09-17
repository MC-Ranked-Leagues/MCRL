import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { RankedClient } from "mcsrranked-sdk";

import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition } from "../db/competitions";
import { fillTestRegistrations } from "../db/registrations";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { updateRegistrationMessages } from "../lib/registration-messages";
import type { BotCommand } from "./command";

const ranked = new RankedClient({ validation: "error" });

export const testFillCommand = {
  data: new SlashCommandBuilder()
    .setName("test_fill")
    .setDescription(
      "Register a past Ranked match's players for testing after confirmation."
    )
    .addIntegerOption((option) =>
      option
        .setName("match_id")
        .setDescription("Ranked match whose players should be registered.")
        .setRequired(true)
        .setMinValue(1)
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = await requireCommandGuild(interaction);
    if (!guild) return;
    if (guild.dev !== true) {
      await interaction.editReply(
        "Test fill is only available in servers configured with dev: true."
      );
      return;
    }
    const context = await requireChannelLeague(interaction, guild);
    if (!context) return;
    const competition = getActiveCompetition(
      interaction.guildId,
      context.leagueNumber
    );
    if (!competition) {
      await interaction.editReply("No competition is active for this league.");
      return;
    }
    const matchId = interaction.options.getInteger("match_id", true);
    let match;
    try {
      match = await ranked.matches.get(matchId);
    } catch (error) {
      console.error(
        "Could not fetch the MCSR Ranked match for test fill.",
        error
      );
      await interaction.editReply(
        "Could not load that MCSR Ranked match. Check the match ID and try again. No registrations were changed."
      );
      return;
    }
    if (!match.players.length) {
      await interaction.editReply(
        "That Ranked match has no players. No registrations were changed."
      );
      return;
    }
    const confirmId = `test_fill:confirm:${interaction.id}`;
    const cancelId = `test_fill:cancel:${interaction.id}`;
    const reply = await interaction.editReply({
      content: `Add up to ${match.players.length} test registrations from Ranked match ${matchId} to League ${competition.leagueNumber}, Week ${competition.weekNumber}? Players will use placeholder Discord accounts. Existing registrations will be kept, and registration closure will be bypassed. Results will not be imported. Confirmation expires in 60 seconds.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel("Confirm test fill")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
    let confirmation;
    try {
      confirmation = await reply.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (button) =>
          button.user.id === interaction.user.id &&
          [confirmId, cancelId].includes(button.customId),
        time: 60_000,
      });
    } catch {
      await interaction.editReply({
        content:
          "Test fill confirmation expired. No registrations were changed.",
        components: [],
      });
      return;
    }
    await confirmation.deferUpdate();
    await interaction.editReply({ components: [] });
    if (confirmation.customId === cancelId) {
      await interaction.editReply(
        "Test fill cancelled. No registrations were changed."
      );
      return;
    }
    // Recheck access after confirmation before writing to the original competition.
    const actor = await interaction.guild.members.fetch({
      user: interaction.user.id,
      force: true,
    });
    const currentGuild = guildConfiguration[interaction.guildId];
    if (
      currentGuild?.dev !== true ||
      !actor.roles.cache.has(currentGuild.commandRoleId)
    ) {
      await interaction.editReply(
        "Test fill is no longer allowed for you in this server. No registrations were changed."
      );
      return;
    }
    const result = fillTestRegistrations(competition.id, match.players);
    if (result.status === "inactive") {
      await interaction.editReply(
        "That competition is no longer active. No registrations were changed."
      );
      return;
    }
    const content = `Added ${result.added} test registrations; skipped ${result.skipped} already registered or unavailable accounts. Run /import match_id:${matchId} to import the results.`;
    try {
      const channel = await interaction.guild.channels.fetch(
        context.league.infoChannelId
      );
      if (!channel?.isSendable())
        throw new Error("Information channel cannot receive messages.");
      await updateRegistrationMessages(channel, competition.id);
    } catch (error) {
      console.error(
        "Test registrations saved, but the registration list could not be updated.",
        error
      );
      await interaction.editReply(
        `${content} I could not update the registration list, but the registrations are saved.`
      );
      return;
    }
    await interaction.editReply(content);
  },
} satisfies BotCommand;
