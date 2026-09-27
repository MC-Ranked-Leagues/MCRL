import { expect, test } from "bun:test";
import type { Guild } from "discord.js";
import type { GuildConfiguration } from "../../config/guilds";
import { createMemberRoles, type MemberRolesMock } from "../testing/discord";
import { LeagueRoleUpdateError, syncLeagueRole } from "./league-roles";

const configuration: GuildConfiguration = {
  dev: false,
  logChannelId: "log",
  commandRoleId: "host",
  leagues: {
    3: {
      infoChannelId: "info3",
      chatChannelId: "chat3",
      leagueRoleId: "league3",
      maxTimeLimitMs: 1000,
    },
    4: {
      infoChannelId: "info4",
      chatChannelId: "chat4",
      leagueRoleId: "league4",
      maxTimeLimitMs: 1000,
    },
    5: {
      infoChannelId: "info5",
      chatChannelId: "chat5",
      leagueRoleId: "league5",
      maxTimeLimitMs: 1000,
    },
  },
};

const roleById: Record<string, { id: string; editable: boolean }> = {
  league3: { id: "league3", editable: true },
  league4: { id: "league4", editable: true },
  league5: { id: "league5", editable: true },
};

function mockGuild(memberRoles: MemberRolesMock) {
  return {
    members: {
      fetch: async () => ({ roles: memberRoles.roles }),
    },
    roles: {
      fetch: async (id: string) => roleById[id] ?? null,
    },
  } as unknown as Guild;
}

test("a league swap removes the old role before adding the new one", async () => {
  const member = createMemberRoles([
    { id: "league5", editable: true },
    { id: "unrelated", editable: false },
  ]);
  await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    4,
    "League movement"
  );
  expect(member.calls).toEqual({ add: 1, remove: 1, set: 0 });
  expect([...member.serverRoles].sort()).toEqual(["league4", "unrelated"]);
});

test("stale duplicate league roles are each removed before the addition", async () => {
  const member = createMemberRoles([
    { id: "league5", editable: true },
    { id: "league3", editable: true },
    { id: "other", editable: true },
  ]);
  await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    4,
    "League movement"
  );
  expect(member.calls).toEqual({ add: 1, remove: 2, set: 0 });
  expect([...member.serverRoles].sort()).toEqual(["league4", "other"]);
});

test("a member with no league role only gains one", async () => {
  const member = createMemberRoles([{ id: "other", editable: true }]);
  await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    4,
    "League movement"
  );
  expect(member.calls).toEqual({ add: 1, remove: 0, set: 0 });
  expect([...member.serverRoles].sort()).toEqual(["league4", "other"]);
});

test("an already correct member needs no Discord write", async () => {
  const member = createMemberRoles([
    { id: "league4", editable: true },
    { id: "other", editable: true },
  ]);
  await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    4,
    "League movement"
  );
  expect(member.calls).toEqual({ add: 0, remove: 0, set: 0 });
  expect([...member.serverRoles].sort()).toEqual(["league4", "other"]);
});

test("a failed removal keeps the old role and skips the addition", async () => {
  const member = createMemberRoles([{ id: "league5", editable: true }]);
  member.roles.remove = async () => {
    member.calls.remove += 1;
    throw new Error("Discord rejected the removal");
  };
  const result = await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    4,
    "reason"
  ).then(
    () => "resolved",
    (error: unknown) => error
  );
  expect(result).toBeInstanceOf(LeagueRoleUpdateError);
  expect((result as LeagueRoleUpdateError).step).toBe("remove");
  expect(member.calls.add).toBe(0);
  expect(member.serverRoles).toEqual(new Set(["league5"]));
});

test("a failed addition leaves no role so it can be repaired through /signup", async () => {
  const member = createMemberRoles([{ id: "league5", editable: true }]);
  member.roles.add = async () => {
    member.calls.add += 1;
    throw new Error("Discord rejected the addition");
  };
  const result = await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    4,
    "reason"
  ).then(
    () => "resolved",
    (error: unknown) => error
  );
  expect(result).toBeInstanceOf(LeagueRoleUpdateError);
  expect((result as LeagueRoleUpdateError).step).toBe("add");
  expect(member.serverRoles).toEqual(new Set());
});

test("unconfigured and uneditable roles throw without changing anything", async () => {
  const member = createMemberRoles([{ id: "league5", editable: true }]);
  const missingLeague = await syncLeagueRole(
    mockGuild(member),
    configuration,
    "player",
    6,
    "reason"
  ).then(
    () => "resolved",
    (error: unknown) => error
  );
  expect(missingLeague).toBeInstanceOf(Error);
  expect((missingLeague as Error).message).toContain("not configured");
  expect(member.serverRoles).toEqual(new Set(["league5"]));

  const lockedDestination = createMemberRoles([
    { id: "league5", editable: true },
  ]);
  const lockedGuild = {
    members: { fetch: async () => ({ roles: lockedDestination.roles }) },
    roles: {
      fetch: async (id: string) =>
        id === "league4" ? { id, editable: false } : (roleById[id] ?? null),
    },
  } as unknown as Guild;
  const lockedDestinationResult = await syncLeagueRole(
    lockedGuild,
    configuration,
    "player",
    4,
    "reason"
  ).then(
    () => "resolved",
    (error: unknown) => error
  );
  expect(lockedDestinationResult).toBeInstanceOf(Error);
  expect((lockedDestinationResult as Error).message).toContain("Manage Roles");
  expect(lockedDestination.serverRoles).toEqual(new Set(["league5"]));

  const lockedPrevious = createMemberRoles([
    { id: "league5", editable: false },
  ]);
  const lockedPreviousResult = await syncLeagueRole(
    mockGuild(lockedPrevious),
    configuration,
    "player",
    4,
    "reason"
  ).then(
    () => "resolved",
    (error: unknown) => error
  );
  expect(lockedPreviousResult).toBeInstanceOf(Error);
  expect((lockedPreviousResult as Error).message).toContain("Manage Roles");
  expect(lockedPrevious.serverRoles).toEqual(new Set(["league5"]));
});
