import type { ChatInputCommandInteraction } from "discord.js";

import { guildConfiguration } from "../../config/guilds";
import { createPlayerFromLeagueRole, getPlayer } from "../db/players";
import { getMemberLeagues } from "./league-roles";
import { ranked, rankedLookupErrorMessage } from "./ranked";

export async function getOrCreatePlayerFromRole(
  interaction: ChatInputCommandInteraction<"cached">
) {
  const existing = getPlayer(interaction.guildId, interaction.user.id);
  if (existing)
    return { status: "found", player: existing, created: false } as const;

  const config = guildConfiguration[interaction.guildId];
  if (!config)
    return {
      status: "error",
      message: "This server is not configured.",
    } as const;

  const leagues = await getMemberLeagues(
    interaction.guild,
    config,
    interaction.user.id
  );
  if (leagues.length === 0) return { status: "no_role" } as const;
  if (leagues.length !== 1)
    return {
      status: "error",
      message: "You have multiple league roles. Ask a host to resolve them.",
    } as const;

  let profile;
  try {
    profile = await ranked.users.get(`discord.${interaction.user.id}`);
  } catch (error) {
    return {
      status: "error",
      message: rankedLookupErrorMessage(error),
    } as const;
  }

  const result = createPlayerFromLeagueRole(
    {
      guildId: interaction.guildId,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      minecraftUuid: profile.uuid,
      ign: profile.nickname,
    },
    leagues[0]!
  );
  if (!result)
    return {
      status: "error",
      message: "This Minecraft account already belongs to another player.",
    } as const;
  return { status: "found", ...result } as const;
}
