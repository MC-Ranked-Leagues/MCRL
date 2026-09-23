import { DiscordAPIError, type Guild, type Role } from "discord.js";
import type { GuildConfiguration } from "../../config/guilds";

function currentWeekRoleId(config: GuildConfiguration): string {
  const roleId = config.currentWeekRoleId;
  if (!roleId) throw new Error("No current week role is configured.");
  if (
    roleId === config.commandRoleId ||
    Object.values(config.leagues).some(
      (league) => league.leagueRoleId === roleId
    )
  )
    throw new Error(
      "The current week role must be separate from host and league roles."
    );
  return roleId;
}

export async function addCurrentWeekRole(
  guild: Guild,
  config: GuildConfiguration,
  userId: string
) {
  const role = await getCurrentWeekRole(guild, config);
  const member = await guild.members.fetch({ user: userId, force: true });
  if (!member.roles.cache.has(role.id))
    await member.roles.add(role, "Registered for the current week");
}

async function getCurrentWeekRole(guild: Guild, config: GuildConfiguration) {
  const role = await guild.roles.fetch(currentWeekRoleId(config));
  if (!role?.editable)
    throw new Error(
      "I need Manage Roles and a bot role above the current week role."
    );
  return role;
}

async function removeRoleFromMember(
  guild: Guild,
  role: Role,
  userId: string,
  reason: string
) {
  try {
    const member = await guild.members.fetch({ user: userId, force: true });
    if (!member.roles.cache.has(role.id)) return false;
    await member.roles.remove(role, reason);
    return true;
  } catch (error) {
    // A player who left the server cannot still hold its role.
    if (error instanceof DiscordAPIError && error.code === 10007) return false;
    throw error;
  }
}

export async function removeCurrentWeekRole(
  guild: Guild,
  config: GuildConfiguration,
  userId: string
) {
  const role = await getCurrentWeekRole(guild, config);
  return removeRoleFromMember(
    guild,
    role,
    userId,
    "Unregistered from the current week"
  );
}

export async function clearCurrentWeekRole(
  guild: Guild,
  config: GuildConfiguration,
  userIds: string[]
) {
  const role = await getCurrentWeekRole(guild, config);
  let removed = 0;
  const failures: string[] = [];
  for (let index = 0; index < userIds.length; index += 5) {
    await Promise.all(
      userIds.slice(index, index + 5).map(async (userId) => {
        try {
          if (
            await removeRoleFromMember(
              guild,
              role,
              userId,
              "Advanced to the next week"
            )
          )
            removed++;
        } catch (error) {
          console.error(
            `Could not clear current week role for ${userId}.`,
            error
          );
          failures.push(userId);
        }
      })
    );
  }
  return { removed, failures };
}
