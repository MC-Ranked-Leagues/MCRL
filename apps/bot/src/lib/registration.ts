import {
  escapeMarkdown,
  type ChatInputCommandInteraction,
  type User,
} from "discord.js";
import { RankedClient, RankedError } from "mcsrranked-sdk";
import type { GuildConfiguration } from "../../config/guilds";
import type { getActiveCompetition } from "../db/competitions";
import { registerPlayer } from "../db/registrations";
import { updateRegistrationMessages } from "./registration-messages";

const ranked = new RankedClient({ validation: "error" });

export async function registerCompetitionPlayer(
  interaction: ChatInputCommandInteraction<"cached">,
  league: GuildConfiguration["leagues"][number],
  leagueNumber: number,
  competition: NonNullable<ReturnType<typeof getActiveCompetition>>,
  user: User,
  admin = false,
  minecraftUsername?: string
) {
  let profile;
  try {
    profile = await ranked.users.get(minecraftUsername ?? `discord.${user.id}`);
  } catch (error) {
    console.error("Could not look up the player's MCSR Ranked account.", error);
    await interaction.editReply(
      registrationLookupErrorMessage(error, admin, minecraftUsername)
    );
    return;
  }

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
    { bypassClosure: admin }
  );
  if (result !== "registered") {
    const messages = {
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

export function registrationLookupErrorMessage(
  error: unknown,
  admin = false,
  minecraftUsername?: string
): string {
  const details = (error instanceof RankedError ? error.details : undefined) as
    { error?: unknown; data?: { error?: unknown } } | undefined;
  const message = details?.data?.error ?? details?.error;
  return typeof message === "string" && message.includes("not exists")
    ? minecraftUsername
      ? "No MCSR Ranked profile was found for that Minecraft username."
      : admin
        ? "No Minecraft account is linked to this Discord user on MCSR Ranked. Supply mc_username to register a Minecraft account directly."
        : "No Minecraft account is linked to your Discord on MCSR Ranked. Link Discord in your MCSR Ranked profile settings, then try /reg again."
    : "An unexpected error occurred.";
}
