import type { Guild } from "discord.js";
import type { GuildConfiguration } from "../../config/guilds";

export async function syncLeagueRole(
  guild: Guild,
  config: GuildConfiguration,
  userId: string,
  leagueNumber: number,
  reason: string
) {
  const league = config.leagues[leagueNumber];
  if (!league) throw new Error("Stored league is not configured.");
  const member = await guild.members.fetch({ user: userId, force: true });
  const role = await guild.roles.fetch(league.leagueRoleId);
  const leagueIds = Object.values(config.leagues).map(
    (entry) => entry.leagueRoleId
  );
  const previous = member.roles.cache.filter(
    (entry) => entry.id !== league.leagueRoleId && leagueIds.includes(entry.id)
  );
  if (!role?.editable || previous.some((entry) => !entry.editable))
    throw new Error(
      "I need Manage Roles and a bot role above the league roles being changed."
    );
  // Add first so partial Discord failures never leave a player with no league role.
  await member.roles.add(role, reason);
  if (previous.size) await member.roles.remove([...previous.keys()], reason);
}

export async function getMemberLeagues(
  guild: Guild,
  config: GuildConfiguration,
  userId: string
) {
  const member = await guild.members.fetch({ user: userId, force: true });
  return Object.entries(config.leagues)
    .filter(([, league]) => member.roles.cache.has(league.leagueRoleId))
    .map(([number]) => Number(number));
}
