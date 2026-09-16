import {
  DiscordAPIError,
  escapeMarkdown,
  type ChatInputCommandInteraction,
  type SendableChannels,
} from "discord.js";
import {
  getCompetitionStandings,
  saveLeaderboardMessageIds,
} from "../db/matches";
import { formatDuration } from "./time";
import { chunkMessage } from "./chunk-message";

const pendingUpdates = new Map<number, Promise<void>>();

export async function updateLeaderboardMessages(
  channel: SendableChannels,
  competitionId: number
) {
  // Serialize replacements and read fresh standings so overlapping commands cannot post stale results.
  const previous = pendingUpdates.get(competitionId) ?? Promise.resolve();
  const update = previous
    .catch(() => {})
    .then(async () => {
      const data = getCompetitionStandings(competitionId);
      if (!data) return;
      const ids = [...data.competition.leaderboardMessageIds];
      while (ids.length) {
        try {
          const message = await channel.messages.fetch(ids[0]!);
          await message.delete();
        } catch (error) {
          if (!(error instanceof DiscordAPIError) || error.code !== 10008)
            throw error;
        }
        ids.shift();
        saveLeaderboardMessageIds(competitionId, ids);
      }
      const lines = [
        `**League ${data.competition.leagueNumber}, Week ${data.competition.weekNumber} Leaderboard**`,
        ...data.standings.map(
          (player, index) =>
            `${index + 1}. ${escapeMarkdown(player.ign)} | ${player.points} pts | Average: ${formatDuration(player.averageTimeMs)} | Played: ${player.played}`
        ),
      ];
      if (!data.standings.length) lines.push("No submitted results yet.");
      const chunks = chunkMessage(lines.join("\n"));
      for (const content of chunks) {
        const message = await channel.send({
          content,
          allowedMentions: { parse: [] },
        });
        ids.push(message.id);
        // Persist each successful send so a later failure does not orphan messages.
        saveLeaderboardMessageIds(competitionId, ids);
      }
    });
  pendingUpdates.set(competitionId, update);
  try {
    await update;
  } finally {
    if (pendingUpdates.get(competitionId) === update)
      pendingUpdates.delete(competitionId);
  }
}

export async function replyWithLeaderboardUpdate(
  interaction: ChatInputCommandInteraction<"cached">,
  competitionId: number,
  channelId: string,
  content: string
) {
  try {
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel?.isSendable())
      throw new Error("Information channel cannot receive messages.");
    await updateLeaderboardMessages(channel, competitionId);
  } catch (error) {
    console.error(
      "Match changes saved, but the leaderboard update failed.",
      error
    );
    await interaction.editReply(
      `${content}\nThe changes are saved, but I could not refresh the leaderboard in <#${channelId}>.`
    );
    return;
  }
  await interaction.editReply({ content, allowedMentions: { parse: [] } });
}
