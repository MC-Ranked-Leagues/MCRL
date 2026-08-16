/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const deleteSeed = makeFunctionReference<
  "mutation",
  { seedId: Id<"seeds"> },
  null
>("seeds:deleteSeed");

describe("seed deletion", () => {
  test("lets the original uploader delete an active seed and upload its overworld value again", async () => {
    const t = convexTest(schema, modules);
    const { deletedSeedId, leagueId, uploaderId } = await t.run(async (ctx) => {
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 2,
        usedSeedCount: 0,
      });
      const uploaderId = await ctx.db.insert("users", {
        name: "Original Uploader",
        status: "active",
        roles: ["uploader"],
        uploaderLeagues: [leagueId],
      });
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 4,
        seedTestingPaused: false,
      });
      const commonSeed = {
        leagueId,
        assignedWeekNumber: 4,
        nether: "2",
        end: "3",
        rng: "4",
        type: "VILLAGE" as const,
        addedBy: uploaderId,
        isUsed: false,
        isExpired: false,
        commentCount: 0,
      };
      const deletedSeedId = await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 1,
        overworld: "101",
        commentCount: 1,
      });
      await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 2,
        overworld: "102",
      });
      await ctx.db.insert("comments", {
        seedId: deletedSeedId,
        author: uploaderId,
        body: "Mistyped seed",
        createdAt: 1,
      });

      return { deletedSeedId, leagueId, uploaderId };
    });
    const uploader = t.withIdentity({ subject: uploaderId });

    await uploader.mutation(deleteSeed, { seedId: deletedSeedId });

    const afterDeletion = await t.run(async (ctx) => ({
      seed: await ctx.db.get("seeds", deletedSeedId),
      comments: await ctx.db
        .query("comments")
        .withIndex("by_seedId_and_createdAt", (q) =>
          q.eq("seedId", deletedSeedId)
        )
        .collect(),
      remainingSeeds: await ctx.db
        .query("seeds")
        .withIndex("by_leagueId_and_isExpired", (q) =>
          q.eq("leagueId", leagueId).eq("isExpired", false)
        )
        .collect(),
      league: await ctx.db.get("leagues", leagueId),
      deletionLog: await ctx.db
        .query("logs")
        .withIndex("by_eventType", (q) => q.eq("eventType", "seed.deleted"))
        .unique(),
    }));

    expect(afterDeletion.seed).toBeNull();
    expect(afterDeletion.comments).toEqual([]);
    expect(afterDeletion.remainingSeeds).toHaveLength(1);
    expect(afterDeletion.remainingSeeds[0]?.seedNumber).toBe(1);
    expect(afterDeletion.league).toMatchObject({
      seedCount: 1,
      usedSeedCount: 0,
    });
    expect(afterDeletion.deletionLog).toMatchObject({
      actorId: uploaderId,
      actorType: "uploader",
      targetId: deletedSeedId,
      targetLabel: "Seed 101",
    });

    await expect(
      uploader.mutation(api.seeds.importSeeds, {
        seed: {
          leagueId,
          overworld: "101",
          nether: "2",
          end: "3",
          rng: "4",
          type: "VILLAGE",
        },
      })
    ).resolves.toEqual(expect.any(String));
  });

  test("allows assigned hosts and admins but rejects unrelated uploaders", async () => {
    const t = convexTest(schema, modules);
    const { adminId, firstSeedId, hostId, otherUploaderId, secondSeedId } =
      await t.run(async (ctx) => {
        const leagueId = await ctx.db.insert("leagues", {
          leagueNumber: 1,
          leagueName: "League One",
          seedCount: 2,
          usedSeedCount: 0,
        });
        const originalUploaderId = await ctx.db.insert("users", {
          name: "Original Uploader",
          status: "active",
          roles: ["uploader"],
          uploaderLeagues: [leagueId],
        });
        const otherUploaderId = await ctx.db.insert("users", {
          name: "Other Uploader",
          status: "active",
          roles: ["uploader"],
          uploaderLeagues: [leagueId],
        });
        const hostId = await ctx.db.insert("users", {
          name: "League Host",
          status: "active",
          roles: ["host"],
          hostLeagueId: [leagueId],
        });
        const adminId = await ctx.db.insert("users", {
          name: "Tournament Admin",
          status: "active",
          roles: ["admin"],
        });
        await ctx.db.insert("settings", {
          key: "global",
          currentWeekNumber: 4,
          seedTestingPaused: false,
        });
        const commonSeed = {
          leagueId,
          assignedWeekNumber: 4,
          nether: "2",
          end: "3",
          rng: "4",
          type: "VILLAGE" as const,
          addedBy: originalUploaderId,
          isUsed: false,
          isExpired: false,
          commentCount: 0,
        };
        const firstSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 1,
          overworld: "201",
        });
        const secondSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 2,
          overworld: "202",
        });

        return {
          adminId,
          firstSeedId,
          hostId,
          otherUploaderId,
          secondSeedId,
        };
      });

    await expect(
      t.withIdentity({ subject: otherUploaderId }).mutation(deleteSeed, {
        seedId: firstSeedId,
      })
    ).rejects.toThrow("You cannot delete this seed");

    await expect(
      t.withIdentity({ subject: hostId }).mutation(deleteSeed, {
        seedId: firstSeedId,
      })
    ).resolves.toBeNull();
    await expect(
      t.withIdentity({ subject: adminId }).mutation(deleteSeed, {
        seedId: secondSeedId,
      })
    ).resolves.toBeNull();
  });

  test("blocks normal deletion while testing is paused and for used or expired seeds", async () => {
    const t = convexTest(schema, modules);
    const { activeSeedId, adminId, expiredSeedId, settingsId, usedSeedId } =
      await t.run(async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          name: "Tournament Admin",
          status: "active",
          roles: ["admin"],
        });
        const leagueId = await ctx.db.insert("leagues", {
          leagueNumber: 1,
          leagueName: "League One",
          seedCount: 2,
          usedSeedCount: 1,
        });
        const settingsId = await ctx.db.insert("settings", {
          key: "global",
          currentWeekNumber: 4,
          seedTestingPaused: true,
        });
        const commonSeed = {
          leagueId,
          assignedWeekNumber: 4,
          nether: "2",
          end: "3",
          rng: "4",
          type: "VILLAGE" as const,
          addedBy: adminId,
          commentCount: 0,
        };
        const activeSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 1,
          overworld: "301",
          isUsed: false,
          isExpired: false,
        });
        const usedSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 2,
          overworld: "302",
          isUsed: true,
          isExpired: false,
        });
        const expiredSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          assignedWeekNumber: 3,
          seedNumber: 1,
          overworld: "303",
          isUsed: false,
          isExpired: true,
        });

        return {
          activeSeedId,
          adminId,
          expiredSeedId,
          settingsId,
          usedSeedId,
        };
      });
    const admin = t.withIdentity({ subject: adminId });

    await expect(
      admin.mutation(deleteSeed, { seedId: activeSeedId })
    ).rejects.toThrow("Seed testing is currently paused");

    await t.run(async (ctx) => {
      await ctx.db.patch("settings", settingsId, { seedTestingPaused: false });
    });

    await expect(
      admin.mutation(deleteSeed, { seedId: usedSeedId })
    ).rejects.toThrow("Used seeds are read-only");
    await expect(
      admin.mutation(deleteSeed, { seedId: expiredSeedId })
    ).rejects.toThrow("Expired seeds are read-only");
  });
});
