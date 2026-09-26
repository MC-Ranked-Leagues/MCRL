import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import { createSignup, getPlayer } from "../db/players";
import { syncLeagueRole } from "../lib/league-roles";
import { getOrCreatePlayerFromRole } from "../lib/player-from-role";
import { ranked, rankedLookupErrorMessage } from "../lib/ranked";
import { sendSignupReview } from "../lib/signup-review";
import { formatDuration } from "../lib/time";
import type { BotCommand } from "./command";

// The upstream Elo suggestion informs the reviewer; it does not assign a league.
const leagueTargets = [
  [7, 0],
  [6, 766.1],
  [5, 1050.3],
  [4, 1215],
  [3, 1405.7],
  [2, 1588.2],
  [1, 1967.7],
] as const;

export const signupCommand = {
  data: new SlashCommandBuilder()
    .setName("signup")
    .setDescription(
      "Sign up for ranked leagues or restore your saved league role."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const config = guildConfiguration[interaction.guildId];
    if (!config?.signup) {
      await interaction.editReply(
        "Signup review is not configured for this server."
      );
      return;
    }
    if (interaction.channelId !== config.signup.channelId) {
      await interaction.editReply(
        `Use /signup in <#${config.signup.channelId}>.`
      );
      return;
    }
    let player = getPlayer(interaction.guildId, interaction.user.id);
    if (!player) {
      const result = await getOrCreatePlayerFromRole(interaction);
      if (result.status === "error") {
        await interaction.editReply(result.message);
        return;
      }
      if (result.status === "found") {
        player = result.player;
        if (result.created) {
          await interaction.editReply(
            `Saved your League ${player.leagueNumber} account from your league role.`
          );
          return;
        }
      }
    }
    if (player?.status === "active") {
      if (player.leagueNumber === null) {
        await interaction.editReply(
          "Something went wrong! Ask a host to assign your league with /assign."
        );
        return;
      }
      try {
        await syncLeagueRole(
          interaction.guild,
          config,
          interaction.user.id,
          player.leagueNumber,
          "Restoring saved league"
        );
        await interaction.editReply(
          `Restored your League ${player.leagueNumber} role.`
        );
      } catch (error) {
        console.error("Could not restore league role.", error);
        await interaction.editReply(
          "Your membership is saved, but the role could not be restored. Ask a host to check role permissions, then retry."
        );
      }
      return;
    }
    if (player?.status === "rejected") {
      await interaction.editReply(
        "Your signup was declined. If you believe this was a mistake, contact a host to reconsider your placement."
      );
      return;
    }
    if (!player) {
      let profile;
      try {
        profile = await ranked.users.get(`discord.${interaction.user.id}`);
      } catch (error) {
        await interaction.editReply(rankedLookupErrorMessage(error));
        return;
      }
      const peak = profile.seasonResult.highest;
      const targets = leagueTargets.filter(
        ([league]) => config.leagues[league]
      );
      const suggested =
        peak === null || targets.length === 0
          ? undefined
          : targets.reduce((best, candidate) =>
              Math.abs(candidate[1] - peak) < Math.abs(best[1] - peak)
                ? candidate
                : best
            )[0];
      const season = profile.statistics.season;
      const completions = season.completions.ranked ?? 0;
      const average =
        completions > 0 && season.completionTime.ranked !== null
          ? season.completionTime.ranked / completions
          : null;
      const details = `Current Elo: ${profile.eloRate ?? "n/a"}\nPeak Elo: ${peak ?? "n/a"}\nSuggested league: ${suggested ?? "n/a"}\nRanked average: ${average === null ? "n/a" : formatDuration(average)}\nRanked PB: ${season.bestTime.ranked == null ? "n/a" : formatDuration(season.bestTime.ranked)}\nProfile: <https://mcsrranked.com/profile/${profile.uuid}>`;
      player = createSignup({
        guildId: interaction.guildId,
        discordUserId: interaction.user.id,
        discordUsername: interaction.user.username,
        minecraftUuid: profile.uuid,
        ign: profile.nickname,
        signupDetails: details,
      });
      if (!player) {
        await interaction.editReply(
          "This Minecraft account already belongs to another player."
        );
        return;
      }
      if (player.status !== "pending") {
        await interaction.editReply(
          "Your membership status changed. Try running /signup again."
        );
        return;
      }
    }
    try {
      await sendSignupReview(interaction.client, player);
      await interaction.editReply(
        "Your signup is pending review. The reviewer has your request."
      );
    } catch (error) {
      console.error("Could not deliver signup review.", error);
      await interaction.editReply(
        "Your signup is saved, but the reviewer could not be reached. Notify a host or admin."
      );
    }
  },
} satisfies BotCommand;
