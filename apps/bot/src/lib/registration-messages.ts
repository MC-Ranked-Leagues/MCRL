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

type Registration = NonNullable<ReturnType<typeof getCompetitionRegistration>>;

export function formatRegistrationMessages({
  competition,
  players,
}: Registration): string[] {
  const lines = [
    `**League ${competition.leagueNumber}, Week ${competition.weekNumber} Registration**`,
    `Registration: **${competition.registrationOpen ? "ON" : "OFF"}**`,
    `Time limit: **${formatDuration(competition.maxTimeLimitMs)}**`,
    "",
    ...players.map(
      (player, index) =>
        `${index + 1}. ${escapeMarkdown(player.ign)} (${escapeMarkdown(player.discordUsername)}) | ${player.elo ?? "unrated"}`
    ),
  ];
  if (players.length === 0) lines.push("No registered players yet.");

  // Keep player rows together when splitting the list across Discord messages.
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current.length + line.length + 1 > 2000) {
      chunks.push(current);
      current = "";
    }
    current += `${current ? "\n" : ""}${line}`;
  }
  if (current) chunks.push(current);
  return chunks;
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
