/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("jungle pyramid seed uploads", () => {
  test("are controlled by the admin experimental feature setting", async () => {
    const t = convexTest(schema, modules);
    const { adminId, leagueId, uploaderId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "Tournament Admin",
        status: "active",
        roles: ["admin"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 0,
        usedSeedCount: 0,
      });
      const uploaderId = await ctx.db.insert("users", {
        name: "Seed Uploader",
        status: "active",
        roles: ["uploader"],
        uploaderLeagues: [leagueId],
      });

      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 1,
        seedTestingPaused: false,
      });

      return { adminId, leagueId, uploaderId };
    });
    const admin = t.withIdentity({ subject: adminId });
    const uploader = t.withIdentity({ subject: uploaderId });

    await expect(
      admin.mutation(api.seeds.importSeeds, {
        seed: {
          leagueId,
          overworld: "100",
          nether: "101",
          end: "102",
          rng: "103",
          type: "JUNGLE_PYRAMID",
        },
      })
    ).rejects.toThrow("Jungle pyramid seed uploads are not currently enabled");

    await expect(
      uploader.mutation(api.settings.setJunglePyramidSeedsEnabled, {
        enabled: true,
      })
    ).rejects.toThrow("Admin access required");

    await admin.mutation(api.settings.setJunglePyramidSeedsEnabled, {
      enabled: true,
    });

    await expect(
      admin.mutation(api.seeds.importSeeds, {
        seed: {
          leagueId,
          overworld: "200",
          nether: "201",
          end: "202",
          rng: "203",
          type: "JUNGLE_PYRAMID",
        },
      })
    ).resolves.toEqual(expect.any(String));

    await admin.mutation(api.settings.setJunglePyramidSeedsEnabled, {
      enabled: false,
    });

    await expect(
      admin.mutation(api.seeds.importSeeds, {
        seed: {
          leagueId,
          overworld: "300",
          nether: "301",
          end: "302",
          rng: "303",
          type: "JUNGLE_PYRAMID",
        },
      })
    ).rejects.toThrow("Jungle pyramid seed uploads are not currently enabled");
  });
});
