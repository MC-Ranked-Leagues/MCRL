import {
  DiscordAPIError,
  escapeMarkdown,
  type ChatInputCommandInteraction,
  type SendableChannels,
} from "discord.js";
import { saveLeaderboardMessageIds } from "../db/matches";
import { getCompetitionMovement } from "../db/relegation";
import { formatPercentage } from "./player-history";
import { formatPlayerName } from "./player-formatting";
import { formatDuration } from "./time";
import { chunkMessage } from "./chunk-message";

const pendingUpdates = new Map<number, Promise<void>>();

export function formatLeaderboardMessages(
  data: NonNullable<ReturnType<typeof getCompetitionMovement>>
): string[] {
  if (data.currentSeed === 0) return [];
  const decisions = new Map(
    data.decisions.map((decision) => [decision.registrationId, decision])
  );
  const lines = [
    `**League ${data.competition.leagueNumber} Week ${data.competition.weekNumber} Leaderboard**`,
    `**Status:** ${data.competition.status}`,
    `**Current seed:** ${data.currentSeed}`,
    ...data.standings.map((player, index) => {
      const name = formatPlayerName(player);
      const decision = decisions.get(player.registrationId);
      let movement = "";
      if (data.competition.status === "ended" && decision) {
        let marker = "";
        if (decision.movement === "promote") marker = " ↑";
        if (decision.movement === "demote") marker = " ↓";
        // Dont show avg for league 7 lb
        movement =
          decision.averageUsed === null
            ? marker
            : ` - Avg: ${formatPercentage(decision.averageUsed)}${marker}`;
      }
      return `${index + 1}. ${escapeMarkdown(name)} - ${player.points} pts - ${formatDuration(player.averageTimeMs, true)}${movement}`;
    }),
  ];
  if (!data.standings.length) lines.push("No submitted results yet.");
  if (data.missed.length) {
    lines.push(
      "-----",
      ...data.missed.map((name) => `${escapeMarkdown(name)} - missed`)
    );
  }
  return chunkMessage(lines.join("\n"));
}

export async function updateLeaderboardMessages(
  channel: SendableChannels,
  competitionId: number
) {
  // Serialize replacements and read fresh standings so overlapping commands cannot post stale results.
  const previous = pendingUpdates.get(competitionId) ?? Promise.resolve();
  const update = previous
    .catch(() => {})
    .then(async () => {
      const data = getCompetitionMovement(competitionId);
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
      const chunks = formatLeaderboardMessages(data);
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
