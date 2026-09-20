import type { ChatInputCommandInteraction } from "discord.js";
import { getImportedMatches } from "../db/matches";
import { updateLeaderboardMessages } from "./leaderboard-messages";
import { updateRegistrationMessages } from "./registration-messages";

export async function replyWithCompetitionUpdate(
  interaction: ChatInputCommandInteraction<"cached">,
  competitionId: number,
  channelId: string,
  content: string
) {
  try {
    const channel = await interaction.guild.channels.fetch(channelId);
    if (!channel?.isSendable())
      throw new Error("Information channel cannot receive messages.");
    // Attempt both refreshes even if one fails; the database changes are already saved.
    const updates = await Promise.allSettled([
      updateRegistrationMessages(channel, competitionId),
      ...(getImportedMatches(competitionId).length
        ? [updateLeaderboardMessages(channel, competitionId)]
        : []),
    ]);
    const failures = updates.filter((update) => update.status === "rejected");
    if (failures.length)
      throw new AggregateError(
        failures.map((failure) => failure.reason as unknown)
      );
  } catch (error) {
    console.error(
      "Competition saved, but its messages could not be refreshed.",
      error
    );
    content += `\nThe changes are saved, but I could not refresh all competition messages in <#${channelId}>.`;
  }
  await interaction.editReply({ content, allowedMentions: { parse: [] } });
}
