import { escapeMarkdown, type ChatInputCommandInteraction } from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import { getActiveCompetition } from "../db/competitions";
import { hasGuildRegistration, unregisterPlayer } from "../db/registrations";
import { requireChannelLeague, requireCommandGuild } from "./command-context";
import { removeCurrentWeekRole } from "./current-week-role";
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
        "Registration is closed. Don't worry! If you don't play any matches, you won't appear in the standings.",
      has_results:
        "You cannot unregister after results have been imported. If you don't play any matches, you won't appear in the standings.",
    };
    await interaction.editReply(messages[result.status]);
    return;
  }
  let content = `Unregistered **${escapeMarkdown(result.ign)}** from League ${context.leagueNumber}, Week ${competition.weekNumber}.`;
  if (
    guild.currentWeekRoleId &&
    !hasGuildRegistration(interaction.guildId, user.id)
  ) {
    try {
      await removeCurrentWeekRole(interaction.guild, guild, user.id);
    } catch (error) {
      console.error(
        `Could not remove current week role for ${user.id}.`,
        error
      );
      content +=
        " The registration is removed, but I could not remove the current week role. Ask a host to remove it manually.";
    }
  }
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
    content +=
      " I could not update the registration list in the info channel. The removal is saved.";
  }
  await interaction.editReply(content);
}
