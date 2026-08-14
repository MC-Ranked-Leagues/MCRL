/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("public current-week seed order API", () => {
  test("returns only current-week active seed types in seed order", async () => {
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
        seedCount: 2,
        usedSeedCount: 1,
      });
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 4,
        seedTestingPaused: false,
      });

      const common = {
        leagueId,
        nether: "private-nether",
        end: "private-end",
        rng: "private-rng",
        addedBy,
        commentCount: 0,
      };

      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 2,
        overworld: "private-current-second",
        type: "SHIPWRECK",
        isUsed: false,
        isExpired: false,
        assignedWeekNumber: 4,
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 1,
        overworld: "private-current-first",
        type: "VILLAGE",
        isUsed: true,
        isExpired: false,
        assignedWeekNumber: 4,
      });
      await ctx.db.insert("seeds", {
        ...common,
        seedNumber: 1,
        overworld: "private-past",
        type: "RUINED_PORTAL",
        isUsed: true,
        isExpired: true,
        assignedWeekNumber: 3,
      });
    });

    const response = await t.fetch("/api/seeds/order?leagueNumber=2");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=30");
    expect(await response.json()).toEqual([
      { order: 1, type: "VILLAGE" },
      { order: 2, type: "SHIPWRECK" },
    ]);
  });

  test.each(["", "?leagueNumber=league-two", "?leagueNumber=0"])(
    "rejects an invalid league number: %s",
    async (query) => {
      const t = convexTest(schema, modules);
      const response = await t.fetch(`/api/seeds/order${query}`);

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: "Invalid query parameters.",
        status: 400,
      });
    }
  );

  test("returns not found for an unknown league", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 1,
        seedTestingPaused: false,
      });
    });

    const response = await t.fetch("/api/seeds/order?leagueNumber=99");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "League not found.",
      status: 404,
    });
  });
});
