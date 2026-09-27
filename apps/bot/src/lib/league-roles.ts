import type { Guild } from "discord.js";
import type { GuildConfiguration } from "../../config/guilds";

export class LeagueRoleUpdateError extends Error {
  readonly step: "remove" | "add";

  constructor(step: "remove" | "add", target: string) {
    super(`Failed to ${step} ${target}.`);
    this.name = "LeagueRoleUpdateError";
    this.step = step;
  }
}

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
  if (!previous.size && member.roles.cache.has(league.leagueRoleId)) return;
  // Remove-then-add with single-role updates, so only league roles are ever
  // named and unrelated roles cannot be touched. A failed removal keeps the
  // old role and skips the addition; a failed addition leaves no role, which
  // hosts repair through /signup.
  for (const oldRole of previous.values()) {
    try {
      await member.roles.remove(oldRole, reason);
    } catch {
      throw new LeagueRoleUpdateError("remove", "the previous league role");
    }
  }
  try {
    await member.roles.add(role, reason);
  } catch {
    throw new LeagueRoleUpdateError("add", `the League ${leagueNumber} role`);
  }
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
