import {
  DiscordAPIError,
  escapeMarkdown,
  type SendableChannels,
} from "discord.js";

import {
  getCompetitionRegistration,
  saveRegistrationMessageIds,
} from "../db/competitions";
import { formatDuration } from "./time";
import { chunkMessage } from "./chunk-message";
import { averagePercentage, formatPercentage } from "./player-history";
import { formatPlayerName } from "./player-formatting";

type Registration = NonNullable<ReturnType<typeof getCompetitionRegistration>>;

export function formatRegistrationMessages({
  competition,
  players,
}: Registration): string[] {
  const lines = [
    `**League ${competition.leagueNumber} Week ${competition.weekNumber} Registration**`,
    `Registration: **${competition.registrationOpen ? "ON" : "OFF"}**`,
    `Time limit: **${formatDuration(competition.maxTimeLimitMs)}**`,
    "",
    ...players.map((player, index) => {
      const rating =
        player.peakElo !== null
          ? `Peak Elo: ${player.peakElo}`
          : player.elo !== null
            ? `Elo: ${player.elo}`
            : "unrated";
      const history = (player.percentageHistory ?? []).slice(-2);
      const average = averagePercentage(
        history.map((entry) => entry.percentage),
        2
      );
      const preAverage =
        average === null
          ? "No history"
          : `${formatPercentage(average)} (${history.map((entry) => formatPercentage(entry.percentage)).join(", ")})`;
      const name = formatPlayerName(player);
      const twitch =
        player.streaming && player.twitch
          ? ` - Twitch: ${escapeMarkdown(player.twitch)}`
          : "";
      return `${index + 1}. ${escapeMarkdown(name)} - ${rating} - PreAvg: ${preAverage}${twitch}`;
    }),
  ];
  if (players.length === 0) lines.push("No registered players yet.");

  return chunkMessage(lines.join("\n"));
}

const pendingUpdates = new Map<number, Promise<void>>();

export async function updateRegistrationMessages(
  channel: SendableChannels,
  competitionId: number
): Promise<void> {
  // Serialize Discord edits and read fresh state after waiting, so overlapping commands
  // cannot create duplicate messages or leave an older registration status visible.
  const previous = pendingUpdates.get(competitionId) ?? Promise.resolve();
  const update = previous
    .catch(() => {})
    .then(async () => {
      const registration = getCompetitionRegistration(competitionId);
      if (!registration) return;
      const chunks = formatRegistrationMessages(registration);
      const ids = [...registration.competition.registrationMessageIds];
      for (const [index, content] of chunks.entries()) {
        const payload = { content, allowedMentions: { parse: [] as const } };
        const id = ids[index];
        if (id) {
          try {
            const message = await channel.messages.fetch(id);
            await message.edit(payload);
            continue;
          } catch (error) {
            // Recreate manually deleted messages, but report permission/network failures.
            if (!(error instanceof DiscordAPIError) || error.code !== 10008)
              throw error;
          }
        }
        const message = await channel.send(payload);
        ids[index] = message.id;
        // Save each send so a later failure doesn't lose already-created messages.
        saveRegistrationMessageIds(competitionId, ids);
      }
      while (ids.length > chunks.length) {
        const id = ids.at(-1)!;
        try {
          const message = await channel.messages.fetch(id);
          await message.delete();
        } catch (error) {
          if (!(error instanceof DiscordAPIError) || error.code !== 10008)
            throw error;
        }
        ids.pop();
        saveRegistrationMessageIds(competitionId, ids);
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
