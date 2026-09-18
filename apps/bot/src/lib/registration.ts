import {
  escapeMarkdown,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";
import { ranked, rankedLookupErrorMessage } from "./ranked";
import { getMemberLeagues } from "./league-roles";
import {
  guildConfiguration,
  type GuildConfiguration,
} from "../../config/guilds";
import type { getActiveCompetition } from "../db/competitions";
import { registerPlayer } from "../db/registrations";
import { getPlayer } from "../db/players";
import { updateRegistrationMessages } from "./registration-messages";

export async function registerCompetitionPlayer(
  interaction: ChatInputCommandInteraction<"cached">,
  league: GuildConfiguration["leagues"][number],
  leagueNumber: number,
  competition: NonNullable<ReturnType<typeof getActiveCompetition>>,
  user: User,
  admin = false,
  force = false
) {
  let profile;
  try {
    profile = await ranked.users.get(`discord.${user.id}`);
  } catch (error) {
    console.error("Could not look up the player's MCSR Ranked account.", error);
    await interaction.editReply(rankedLookupErrorMessage(error, admin));
    return;
  }

  const config = guildConfiguration[interaction.guildId]!;
  const roleLeagues = await getMemberLeagues(
    interaction.guild,
    config,
    user.id
  );
  if (!force && (roleLeagues.length !== 1 || roleLeagues[0] !== leagueNumber)) {
    await interaction.editReply(
      admin
        ? `The player's league roles are ${roleLeagues.join(", ") || "unassigned"}. Use force: true to register in League ${leagueNumber} for this competition only.`
        : `You need exactly one league role, matching League ${leagueNumber}, to register here. Ask a host to resolve missing or conflicting roles.`
    );
    return;
  }
  const initialLeague = roleLeagues.length === 1 ? roleLeagues[0] : undefined;
  const result = registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: user.id,
      discordUsername: user.username,
      minecraftUuid: profile.uuid,
      ign: profile.nickname,
      elo: profile.eloRate,
      peakElo: profile.seasonResult.highest,
      registeredAt: new Date(),
    },
    { mode: admin ? (force ? "forced" : "admin") : "self", initialLeague }
  );
  if (result !== "registered") {
    const savedPlayer = getPlayer(interaction.guildId, user.id);
    const messages = {
      signup_rejected:
        "This player's signup was declined. A host must reconsider their membership with /assign before registration.",
      account_mismatch: `Your saved account is **${escapeMarkdown(savedPlayer?.ign ?? "unknown")}**, but Discord is linked to **${escapeMarkdown(profile.nickname)}**. The player must use /migrate_account to request a change, or connect the discord to the previous Ranked account.`,
      account_owned:
        "This Minecraft account belongs to another player in this server.",
      league_mismatch: `The stored league is ${savedPlayer?.leagueNumber ?? "unassigned"}. Use force: true to register in League ${leagueNumber} for this competition only.`,
      inactive:
        "No competition is active for the current league. Wait until its announcement is made.",
      closed: "Registration closed.",
      already_registered: "This player is already registered.",
      account_registered:
        "This Minecraft account is already registered by another Discord user.",
    };
    await interaction.editReply(messages[result]);
    return;
  }

  const content = `Registered **${escapeMarkdown(profile.nickname)}** for League ${leagueNumber}, Week ${competition.weekNumber}.`;
  try {
    const channel = await interaction.guild.channels.fetch(
      league.infoChannelId
    );
    if (!channel?.isSendable())
      throw new Error("Information channel cannot receive messages.");
    await updateRegistrationMessages(channel, competition.id);
  } catch (error) {
    // Registration remains valid even if Discord cannot refresh the public list.
    console.error(
      "Player registered, but the registration list could not be updated.",
      error
    );
    await interaction.editReply(
      `${content} I could not update the registration list in the info channel; however the registration is saved.`
    );
    return;
  }
  await interaction.editReply(content);
}
