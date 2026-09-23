import { expect, test } from "bun:test";
import type { Guild } from "discord.js";
import type { GuildConfiguration } from "../../config/guilds";
import {
  addCurrentWeekRole,
  clearCurrentWeekRole,
  removeCurrentWeekRole,
} from "./current-week-role";

const configuration: GuildConfiguration = {
  dev: false,
  logChannelId: "log",
  commandRoleId: "host",
  currentWeekRoleId: "current-week",
  leagues: {
    1: {
      infoChannelId: "info",
      chatChannelId: "chat",
      leagueRoleId: "league",
      maxTimeLimitMs: 1000,
    },
  },
};

test("registration adds the role and week advancement clears only members who hold it", async () => {
  const roleId = "current-week";
  const holders = new Set(["carol"]);
  const added: string[] = [];
  const removed: string[] = [];
  const guild = {
    roles: {
      fetch: async () => ({ id: roleId, editable: true }),
    },
    members: {
      fetch: async ({ user }: { user: string }) => ({
        roles: {
          cache: { has: (id: string) => id === roleId && holders.has(user) },
          add: async () => {
            holders.add(user);
            added.push(user);
          },
          remove: async () => {
            if (user === "carol")
              throw new Error("Discord rejected the removal");
            holders.delete(user);
            removed.push(user);
          },
        },
      }),
    },
  } as unknown as Guild;

  await addCurrentWeekRole(guild, configuration, "alice");
  await addCurrentWeekRole(guild, configuration, "alice");
  expect(added).toEqual(["alice"]);
  expect(await removeCurrentWeekRole(guild, configuration, "alice")).toBe(true);
  expect(holders.has("alice")).toBe(false);
  await addCurrentWeekRole(guild, configuration, "alice");

  const originalError = console.error;
  console.error = () => {};
  try {
    expect(
      await clearCurrentWeekRole(guild, configuration, [
        "alice",
        "bob",
        "carol",
      ])
    ).toEqual({ removed: 1, failures: ["carol"] });
  } finally {
    console.error = originalError;
  }
  expect(removed).toEqual(["alice", "alice"]);
  expect(holders.has("carol")).toBe(true);
});

test("current week role cannot reuse a host or league role", async () => {
  const guild = {
    roles: {
      fetch: () => {
        throw new Error("Discord should not be called");
      },
    },
  } as unknown as Guild;
  const config = { ...configuration, currentWeekRoleId: "host" };
  expect(addCurrentWeekRole(guild, config, "alice")).rejects.toThrow(
    "separate from host and league roles"
  );
  config.currentWeekRoleId = "league";
  expect(clearCurrentWeekRole(guild, config, ["alice"])).rejects.toThrow(
    "separate from host and league roles"
  );
});
