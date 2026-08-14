import type { Doc, Id } from "../../../convex/_generated/dataModel";

export type ManagedRole = "host" | "uploader";
export type UserRole = "admin" | ManagedRole;

export function getLeagueLabel(
  leagues: Doc<"leagues">[],
  leagueId: Id<"leagues"> | null | undefined,
) {
  if (!leagueId) {
    return "No league";
  }

  return (
    leagues.find((league) => league._id === leagueId)?.leagueName ??
    "Unknown league"
  );
}

export function getLeagueListLabel(
  leagues: Doc<"leagues">[],
  leagueIds: Id<"leagues">[] | undefined,
) {
  if (!leagueIds || leagueIds.length === 0) {
    return "No leagues";
  }

  return leagueIds
    .map((leagueId) => getLeagueLabel(leagues, leagueId))
    .join(", ");
}

export function getUserLabel(user: Doc<"users">) {
  return user.name ?? user.lowercaseName ?? "Unnamed user";
}

export function getUserIdentifierLabel(user: Doc<"users">) {
  if (user.lowercaseName) {
    return `@${user.lowercaseName}`;
  }

  return user._id;
}

export function getManagedRoles(user: Doc<"users">): ManagedRole[] {
  return user.roles.filter(isManagedRole);
}

export function getManagedUserValues(user: Doc<"users">) {
  return {
    roles: getManagedRoles(user),
    uploaderLeagueIds: user.uploaderLeagues ?? [],
    hostLeagueId: user.hostLeagueId ?? [],
  };
}

export function haveSameManagedRoles(
  firstRoles: ManagedRole[],
  secondRoles: ManagedRole[],
) {
  return (
    firstRoles.length === secondRoles.length &&
    firstRoles.every((role) => secondRoles.includes(role))
  );
}

export function haveSameLeagueIds(
  firstLeagueIds: Id<"leagues">[],
  secondLeagueIds: Id<"leagues">[],
) {
  return (
    firstLeagueIds.length === secondLeagueIds.length &&
    firstLeagueIds.every((leagueId) => secondLeagueIds.includes(leagueId))
  );
}

export function isManagedRole(role: unknown): role is ManagedRole {
  return role === "host" || role === "uploader";
}

export function updateManagedRole(
  currentRoles: ManagedRole[],
  role: ManagedRole,
  checked: boolean,
) {
  if (checked) {
    return currentRoles.includes(role) ? currentRoles : [...currentRoles, role];
  }

  return currentRoles.filter((currentRole) => currentRole !== role);
}
