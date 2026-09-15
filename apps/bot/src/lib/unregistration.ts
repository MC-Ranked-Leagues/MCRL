import { escapeMarkdown, type ChatInputCommandInteraction } from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition } from "../db/competitions";
import { unregisterPlayer } from "../db/registrations";
import { requireChannelLeague, requireCommandGuild } from "./command-context";
import { updateRegistrationMessages } from "./registration-messages";

export async function unregisterCompetitionPlayer(
  interaction: ChatInputCommandInteraction<"cached">,
  admin: boolean
) {
  const guild = admin
    ? await requireCommandGuild(interaction)
    : guildConfiguration[interaction.guildId];
  if (!guild) {
    if (!admin) await interaction.editReply("This server is not configured.");
    return;
  }
  const context = await requireChannelLeague(interaction, guild);
  if (!context) return;
  const competition = getActiveCompetition(
    interaction.guildId,
    context.leagueNumber
  );
  if (!competition) {
    await interaction.editReply(
      `League ${context.leagueNumber} has no active competition.`
    );
    return;
  }
  const user = admin
    ? interaction.options.getUser("user", true)
    : interaction.user;
  const result = unregisterPlayer(competition.id, user.id, { admin });
  if (result.status !== "unregistered") {
    const messages = {
      inactive: "This competition is no longer active.",
      not_registered: admin
        ? "This player is not registered for this competition."
        : "You are not registered for this competition.",
      closed:
        "Registration is closed. Ask a host to remove you with /admin_unreg.",
      has_results:
        "You cannot unregister after match results have been imported for you. Ask a host to remove you with /admin_unreg.",
    };
    await interaction.editReply(messages[result.status]);
    return;
  }
  const content = `Unregistered **${escapeMarkdown(result.ign)}** from League ${context.leagueNumber}, Week ${competition.weekNumber}.`;
  try {
    const channel = await interaction.guild.channels.fetch(
      context.league.infoChannelId
    );
    if (!channel?.isSendable())
      throw new Error("Information channel cannot receive messages.");
    await updateRegistrationMessages(channel, competition.id);
  } catch (error) {
    console.error(
      "Player unregistered, but the registration list could not be updated.",
      error
    );
    await interaction.editReply(
      `${content} I could not update the registration list in the info channel; However, the removal is saved.`
    );
    return;
  }
  await interaction.editReply(content);
}
