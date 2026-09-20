import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { RankedClient } from "mcsrranked-sdk";
import { getActiveCompetition } from "../db/competitions";
import { importMatch } from "../db/matches";
import {
  requireChannelLeague,
  requireCommandGuild,
} from "../lib/command-context";
import { replyWithCompetitionUpdate } from "../lib/competition-messages";
import type { BotCommand } from "./command";

const ranked = new RankedClient({ validation: "error" });

export const importCommand = {
  data: new SlashCommandBuilder()
    .setName("import")
    .setDescription("Import Ranked results into a new or existing match.")
    .addIntegerOption((option) =>
      option
        .setName("match_id")
        .setDescription("MCSR Ranked match ID.")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName("match_number")
        .setDescription(
          "Match to create or replace. Defaults to the next match number."
        )
        .setMinValue(1)
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
      await interaction.editReply("No competition is active for this league.");
      return;
    }
    const matchId = interaction.options.getInteger("match_id", true);
    const number = interaction.options.getInteger("match_number") ?? undefined;
    let data;
    try {
      data = await ranked.matches.get(matchId);
    } catch (error) {
      console.error("Could not fetch the MCSR Ranked match.", error);
      await interaction.editReply(
        "Could not load that MCSR Ranked match. Check the match ID and try again. No results were changed."
      );
      return;
    }
    const result = importMatch(competition.id, data, number);
    if (result.status !== "imported") {
      const messages = {
        inactive:
          "That competition is no longer active. No results were changed.",
        duplicate: `That Ranked match is already imported as Match ${result.status === "duplicate" ? result.number : ""}. Specify that match_number to replace it, or clear it first.`,
        no_registrations:
          "This competition has no registered players. No results were changed.",
        empty_match:
          "That Ranked match has no players. No results were changed.",
        no_matching_players:
          "No players in that Ranked match match this competition's registered Minecraft accounts. No results were changed.",
      };
      await interaction.editReply(messages[result.status]);
      return;
    }
    let content = `Imported Ranked match ${data.id} into Match ${result.number}. Matched ${result.matched}/${result.total} registered players. Registration is closed.`;
    if (result.unmatched.length) {
      const names = result.unmatched
        .map((name) => escapeMarkdown(name))
        .join(", ");
      content += `\nUnregistered Ranked players: ${names.length > 1200 ? `${names.slice(0, 1200)}…` : names}`;
    }
    await replyWithCompetitionUpdate(
      interaction,
      competition.id,
      context.league.infoChannelId,
      content
    );
  },
} satisfies BotCommand;
