/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public seed history API", () => {
  test("publishes only used seeds from the current week", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const addedBy = await ctx.db.insert("users", {
        name: "Seed Uploader",
        status: "active",
        roles: ["uploader"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 2,
        usedSeedCount: 1,
      });

      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 3,
        seedTestingPaused: false,
      });
      await ctx.db.insert("seeds", {
        seedNumber: 2,
        leagueId,
        overworld: "used-overworld",
        nether: "used-nether",
        end: "used-end",
        rng: "used-rng",
        type: "DESERT_TEMPLE",
        addedBy,
        isUsed: true,
        isExpired: false,
        assignedWeekNumber: 3,
        commentCount: 4,
      });
      await ctx.db.insert("seeds", {
        seedNumber: 1,
        leagueId,
        overworld: "private-overworld",
        nether: "private-nether",
        end: "private-end",
        rng: "private-rng",
        type: "SHIPWRECK",
        addedBy,
        isUsed: false,
        isExpired: false,
        assignedWeekNumber: 3,
        commentCount: 0,
      });
    });

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=1&weekNumber=3"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("public, max-age=30");
    expect(await response.json()).toEqual([
      {
        order: 1,
        overworld: "used-overworld",
        nether: "used-nether",
        end: "used-end",
        rng: "used-rng",
        type: "DESERT_TEMPLE",
      },
    ]);
  });

  test("publishes expired seeds from past weeks in deterministic order", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const addedBy = await ctx.db.insert("users", {
        name: "Seed Uploader",
        status: "active",
        roles: ["uploader"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 2,
        leagueName: "League Two",
        seedCount: 0,
        usedSeedCount: 0,
      });

      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 4,
        seedTestingPaused: false,
      });

      const common = {
        leagueId,
        nether: "nether",
        end: "end",
        rng: "rng",
        addedBy,
        isExpired: true,
        assignedWeekNumber: 3,
        commentCount: 0,
      };

      await ctx.db.insert("seeds", {
        ...common,
        overworld: "legacy-first",
        type: undefined,
        isUsed: false,
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 3,
        overworld: "number-three",
        type: "SHIPWRECK",
        isUsed: true,
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 1,
        overworld: "number-one",
        type: "BURIED_TREASURE",
        isUsed: false,
      });
      await ctx.db.insert("seeds", {
        ...common,
        overworld: "legacy-second",
        type: "VILLAGE",
        isUsed: true,
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 2,
        overworld: "active-anomaly",
        type: "RUINED_PORTAL",
        isUsed: true,
        isExpired: false,
      });
    });

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=2&weekNumber=3"
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(await response.json()).toEqual([
      {
        order: 1,
        overworld: "number-one",
        nether: "nether",
        end: "end",
        rng: "rng",
        type: "BURIED_TREASURE",
      },
      {
        order: 2,
        overworld: "number-three",
        nether: "nether",
        end: "end",
        rng: "rng",
        type: "SHIPWRECK",
      },
      {
        order: 3,
        overworld: "legacy-first",
        nether: "nether",
        end: "end",
        rng: "rng",
        type: null,
      },
      {
        order: 4,
        overworld: "legacy-second",
        nether: "nether",
        end: "end",
        rng: "rng",
        type: "VILLAGE",
      },
    ]);
  });

  test("weekly rollover preserves seed order for public history", async () => {
    const t = convexTest(schema, modules);
    const adminId = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "Tournament Admin",
        status: "active",
        roles: ["admin"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 2,
        usedSeedCount: 0,
      });
      const common = {
        leagueId,
        nether: "nether",
        end: "end",
        rng: "rng",
        type: "RUINED_PORTAL" as const,
        addedBy: adminId,
        isUsed: false,
        isExpired: false,
        assignedWeekNumber: 5,
        commentCount: 0,
      };

      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 5,
        seedTestingPaused: false,
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 2,
        overworld: "created-first-but-ordered-second",
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 1,
        overworld: "created-second-but-ordered-first",
      });

      return adminId;
    });

    const admin = t.withIdentity({ subject: adminId });
    await admin.mutation(api.settings.advanceWeek, {});

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=1&weekNumber=5"
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        order: 1,
        overworld: "created-second-but-ordered-first",
        nether: "nether",
        end: "end",
        rng: "rng",
        type: "RUINED_PORTAL",
      },
      {
        order: 2,
        overworld: "created-first-but-ordered-second",
        nether: "nether",
        end: "end",
        rng: "rng",
        type: "RUINED_PORTAL",
      },
    ]);
  });

  test("returns an empty array for a valid league and week without published seeds", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 0,
        usedSeedCount: 0,
      });
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 2,
        seedTestingPaused: false,
      });
    });

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=1&weekNumber=1"
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test.each([
    ["a missing league number", "?weekNumber=1"],
    ["a missing week number", "?leagueNumber=1"],
    ["a malformed league number", "?leagueNumber=league-one&weekNumber=1"],
    ["a zero week number", "?leagueNumber=1&weekNumber=0"],
    ["a negative week number", "?leagueNumber=1&weekNumber=-1"],
  ])("rejects %s", async (_scenario, query) => {
    const t = convexTest(schema, modules);
    const response = await t.fetch(`/api/seeds/history${query}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid query parameters.",
      status: 400,
    });
  });

  test("keeps existing APIs protected by their API keys", async () => {
    vi.stubEnv("READ_API_KEY_SEEDS", "test-read-key");
    vi.stubEnv("WRITE_API_KEY_SEEDS", "test-write-key");
    const t = convexTest(schema, modules);

    const [readResponse, writeResponse] = await Promise.all([
      t.fetch("/api/users/discord?discordId=123"),
      t.fetch("/api/users/discord/activate", { method: "POST" }),
    ]);

    expect([readResponse.status, writeResponse.status]).toEqual([401, 401]);
    expect(
      await Promise.all([readResponse.json(), writeResponse.json()])
    ).toEqual([
      { error: "Unauthorized", status: 401 },
      { error: "Unauthorized", status: 401 },
    ]);
  });

  test("rejects future tournament weeks", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 3,
        seedTestingPaused: false,
      });
    });

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=1&weekNumber=4"
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Future tournament weeks are not available.",
      status: 400,
    });
  });

  test("returns not found for an unknown league", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 3,
        seedTestingPaused: false,
      });
    });

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=99&weekNumber=3"
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "League not found.",
      status: 404,
    });
  });

  test("fails instead of truncating an oversized history response", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const addedBy = await ctx.db.insert("users", {
        name: "Seed Uploader",
        status: "active",
        roles: ["uploader"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 501,
        usedSeedCount: 501,
      });

      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 1,
        seedTestingPaused: false,
      });
      await Promise.all(
        Array.from({ length: 501 }, (_, index) =>
          ctx.db.insert("seeds", {
            seedNumber: index + 1,
            leagueId,
            overworld: `overworld-${index}`,
            nether: `nether-${index}`,
            end: `end-${index}`,
            rng: `rng-${index}`,
            type: "VILLAGE",
            addedBy,
            isUsed: true,
            isExpired: false,
            assignedWeekNumber: 1,
            commentCount: 0,
          })
        )
      );
    });

    const response = await t.fetch(
      "/api/seeds/history?leagueNumber=1&weekNumber=1"
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Too many published seeds to return.",
      status: 500,
    });
  });
});
