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
import { replyWithCompetitionUpdate } from "./competition-messages";
import { addCurrentWeekRole } from "./current-week-role";

export async function registerCompetitionPlayer(
  interaction: ChatInputCommandInteraction<"cached">,
  league: GuildConfiguration["leagues"][number],
  leagueNumber: number,
  competition: NonNullable<ReturnType<typeof getActiveCompetition>>,
  user: User,
  {
    admin = false,
    streaming = false,
  }: { admin?: boolean; streaming?: boolean } = {}
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
  if (roleLeagues.length !== 1 || roleLeagues[0] !== leagueNumber) {
    await interaction.editReply(
      admin
        ? `The player's league roles are ${roleLeagues.join(", ") || "unassigned"}. Use /assign to set League ${leagueNumber} before registering.`
        : `You need exactly one league role, matching League ${leagueNumber}, to register here. Ask a host to resolve missing or conflicting roles.`
    );
    return;
  }
  const twitch = streaming
    ? profile.connections.twitch?.name.trim() || null
    : null;
  const result = registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: user.id,
      discordUsername: user.username,
      minecraftUuid: profile.uuid,
      ign: profile.nickname,
      elo: profile.eloRate,
      peakElo: profile.seasonResult.highest,
      streaming,
      registeredAt: new Date(),
    },
    {
      mode: admin ? "admin" : "self",
      twitch,
    }
  );
  if (result !== "registered") {
    const savedPlayer = getPlayer(interaction.guildId, user.id);
    const messages = {
      signup_rejected:
        "This player's signup was declined. A host must reconsider their membership with /assign before registration.",
      account_mismatch: `Your saved account is **${escapeMarkdown(savedPlayer?.ign ?? "unknown")}**, but Discord is linked to **${escapeMarkdown(profile.nickname)}**. The player must use /migrate_account to request a change, or connect the discord to the previous Ranked account.`,
      account_owned:
        "This Minecraft account belongs to another player in this server.",
      league_mismatch: `The stored league is ${savedPlayer?.leagueNumber ?? "unassigned"}. Use /assign to set League ${leagueNumber} before registering.`,
      inactive:
        "No competition is active for the current league. Wait until its announcement is made.",
      closed: "Registration closed.",
      already_registered: "This player is already registered.",
      account_registered:
        "This Minecraft account is already registered by another Discord user.",
      twitch_required:
        "No Twitch username is saved or linked on MCSR Ranked. Use /twitch first, then register again.",
    };
    await interaction.editReply(messages[result]);
    return;
  }

  let content = `Registered **${escapeMarkdown(profile.nickname)}** for League ${leagueNumber}, Week ${competition.weekNumber}.`;
  if (config.currentWeekRoleId) {
    try {
      await addCurrentWeekRole(interaction.guild, config, user.id);
    } catch (error) {
      console.error(`Could not add current week role for ${user.id}.`, error);
      content +=
        " Registration is saved, but I could not add the current week role. Ask a host to check role permissions.";
    }
  }
  await replyWithCompetitionUpdate(
    interaction,
    competition.id,
    league.infoChannelId,
    content
  );
}
