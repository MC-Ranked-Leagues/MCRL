/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const listSeeds = makeFunctionReference<
  "query",
  { leagueId: Id<"leagues">; weekNumber: number },
  Doc<"seeds">[]
>("seedManagement:listSeeds");

const addSeed = makeFunctionReference<
  "mutation",
  {
    leagueId: Id<"leagues">;
    weekNumber: number;
    overworld: string;
    nether: string;
    end: string;
    rng: string;
    type:
      | "BURIED_TREASURE"
      | "VILLAGE"
      | "DESERT_TEMPLE"
      | "JUNGLE_PYRAMID"
      | "RUINED_PORTAL"
      | "SHIPWRECK";
  },
  Id<"seeds">
>("seedManagement:addSeed");

const updateSeed = makeFunctionReference<
  "mutation",
  {
    seedId: Id<"seeds">;
    overworld: string;
    nether: string;
    end: string;
    rng: string;
    type:
      | "BURIED_TREASURE"
      | "VILLAGE"
      | "DESERT_TEMPLE"
      | "JUNGLE_PYRAMID"
      | "RUINED_PORTAL"
      | "SHIPWRECK";
    isUsed: boolean;
  },
  null
>("seedManagement:updateSeed");

const reorderSeed = makeFunctionReference<
  "mutation",
  { seedId: Id<"seeds">; movement: "UP" | "DOWN" },
  null
>("seedManagement:reorderSeed");

const deleteSeed = makeFunctionReference<
  "mutation",
  { seedId: Id<"seeds"> },
  null
>("seedManagement:deleteSeed");

describe("admin seed management", () => {
  test("lists the complete selected league and week in seed order for admins only", async () => {
    const t = convexTest(schema, modules);
    const { adminId, hostId, selectedLeagueId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "History Admin",
        status: "active",
        roles: ["admin"],
      });
      const hostId = await ctx.db.insert("users", {
        name: "League Host",
        status: "active",
        roles: ["host"],
      });
      const selectedLeagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 1,
        usedSeedCount: 0,
      });
      const otherLeagueId = await ctx.db.insert("leagues", {
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

      const commonSeed = {
        leagueId: selectedLeagueId,
        nether: "2",
        end: "3",
        rng: "4",
        type: "VILLAGE" as const,
        addedBy: adminId,
        commentCount: 0,
      };

      await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 2,
        overworld: "102",
        isUsed: false,
        isExpired: false,
        assignedWeekNumber: 4,
      });
      await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 1,
        overworld: "101",
        isUsed: true,
        isExpired: true,
        assignedWeekNumber: 4,
      });
      await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 1,
        overworld: "99",
        isUsed: true,
        isExpired: true,
        assignedWeekNumber: 3,
      });
      await ctx.db.insert("seeds", {
        ...commonSeed,
        leagueId: otherLeagueId,
        seedNumber: 1,
        overworld: "201",
        isUsed: true,
        isExpired: false,
        assignedWeekNumber: 4,
      });

      return { adminId, hostId, selectedLeagueId };
    });

    const admin = t.withIdentity({ subject: adminId });
    const host = t.withIdentity({ subject: hostId });

    const seeds = await admin.query(listSeeds, {
      leagueId: selectedLeagueId,
      weekNumber: 4,
    });

    expect(seeds.map((seed) => seed.overworld)).toEqual(["101", "102"]);
    await expect(
      host.query(listSeeds, {
        leagueId: selectedLeagueId,
        weekNumber: 4,
      })
    ).rejects.toThrow("Admin access required");
  });

  test("adds an audited used seed to a past league week", async () => {
    const t = convexTest(schema, modules);
    const { adminId, leagueId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "History Admin",
        status: "active",
        roles: ["admin"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 7,
        usedSeedCount: 3,
      });
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 4,
        seedTestingPaused: false,
      });

      return { adminId, leagueId };
    });
    const admin = t.withIdentity({ subject: adminId });

    const seedId = await admin.mutation(addSeed, {
      leagueId,
      weekNumber: 3,
      overworld: " 101 ",
      nether: "102",
      end: "103",
      rng: "104",
      type: "BURIED_TREASURE",
    });

    const result = await t.run(async (ctx) => ({
      seed: await ctx.db.get("seeds", seedId),
      league: await ctx.db.get("leagues", leagueId),
      log: await ctx.db
        .query("logs")
        .withIndex("by_eventType", (q) => q.eq("eventType", "seed.uploaded"))
        .unique(),
    }));

    expect(result.seed).toMatchObject({
      seedNumber: 1,
      leagueId,
      assignedWeekNumber: 3,
      overworld: "101",
      nether: "102",
      end: "103",
      rng: "104",
      type: "BURIED_TREASURE",
      isBt: true,
      isExpired: true,
      isUsed: true,
      addedBy: adminId,
      usedBy: adminId,
      usedAt: expect.any(Number),
      commentCount: 0,
    });
    expect(result.league).toMatchObject({ seedCount: 7, usedSeedCount: 3 });
    expect(result.log).toMatchObject({
      actorId: adminId,
      actorType: "admin",
      targetId: seedId,
      targetLabel: "Seed 101",
    });

    await expect(
      admin.mutation(addSeed, {
        leagueId,
        weekNumber: 4,
        overworld: "201",
        nether: "202",
        end: "203",
        rng: "204",
        type: "VILLAGE",
      })
    ).rejects.toThrow("current week");
  });

  test("updates managed fields and current-week used counters without allowing duplicate overworld values", async () => {
    const t = convexTest(schema, modules);
    const { adminId, leagueId, seedId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "History Admin",
        status: "active",
        roles: ["admin"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 2,
        usedSeedCount: 0,
      });
      const otherLeagueId = await ctx.db.insert("leagues", {
        leagueNumber: 2,
        leagueName: "League Two",
        seedCount: 1,
        usedSeedCount: 0,
      });
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 4,
        seedTestingPaused: false,
      });
      const seedId = await ctx.db.insert("seeds", {
        seedNumber: 1,
        leagueId,
        assignedWeekNumber: 4,
        overworld: "101",
        nether: "102",
        end: "103",
        rng: "104",
        type: "VILLAGE",
        isBt: false,
        addedBy: adminId,
        isUsed: false,
        isExpired: false,
        commentCount: 0,
      });
      await ctx.db.insert("seeds", {
        seedNumber: 1,
        leagueId: otherLeagueId,
        assignedWeekNumber: 4,
        overworld: "999",
        nether: "2",
        end: "3",
        rng: "4",
        type: "SHIPWRECK",
        addedBy: adminId,
        isUsed: false,
        isExpired: false,
        commentCount: 0,
      });

      return { adminId, leagueId, seedId };
    });
    const admin = t.withIdentity({ subject: adminId });

    await admin.mutation(updateSeed, {
      seedId,
      overworld: " 201 ",
      nether: "202",
      end: "203",
      rng: "204",
      type: "BURIED_TREASURE",
      isUsed: true,
    });

    const result = await t.run(async (ctx) => ({
      seed: await ctx.db.get("seeds", seedId),
      league: await ctx.db.get("leagues", leagueId),
      log: (await ctx.db.query("logs").collect()).find(
        (log) => log.targetId === seedId
      ),
    }));

    expect(result.seed).toMatchObject({
      overworld: "201",
      nether: "202",
      end: "203",
      rng: "204",
      type: "BURIED_TREASURE",
      isBt: true,
      isUsed: true,
      usedBy: adminId,
      usedAt: expect.any(Number),
    });
    expect(result.league?.usedSeedCount).toBe(1);
    expect(result.log).toMatchObject({
      eventType: "seed.updated",
      actorId: adminId,
      targetId: seedId,
      targetLabel: "Seed 101",
    });

    await expect(
      admin.mutation(updateSeed, {
        seedId,
        overworld: "999",
        nether: "202",
        end: "203",
        rng: "204",
        type: "BURIED_TREASURE",
        isUsed: false,
      })
    ).rejects.toThrow("already exists");

    await admin.mutation(updateSeed, {
      seedId,
      overworld: "201",
      nether: "202",
      end: "203",
      rng: "204",
      type: "BURIED_TREASURE",
      isUsed: false,
    });
    const cleared = await t.run(async (ctx) => ({
      seed: await ctx.db.get("seeds", seedId),
      league: await ctx.db.get("leagues", leagueId),
    }));

    expect(cleared.seed).toMatchObject({ isUsed: false });
    expect(cleared.seed?.usedAt).toBeUndefined();
    expect(cleared.seed?.usedBy).toBeUndefined();
    expect(cleared.league?.usedSeedCount).toBe(0);
  });

  test("reorders against the latest adjacent seed within one league and week", async () => {
    const t = convexTest(schema, modules);
    const { adminId, leagueId, secondSeedId, otherWeekSeedId } = await t.run(
      async (ctx) => {
        const adminId = await ctx.db.insert("users", {
          name: "History Admin",
          status: "active",
          roles: ["admin"],
        });
        const leagueId = await ctx.db.insert("leagues", {
          leagueNumber: 1,
          leagueName: "League One",
          seedCount: 0,
          usedSeedCount: 0,
        });
        await ctx.db.insert("settings", {
          key: "global",
          currentWeekNumber: 4,
          seedTestingPaused: false,
        });
        const commonSeed = {
          leagueId,
          assignedWeekNumber: 3,
          nether: "2",
          end: "3",
          rng: "4",
          type: "VILLAGE" as const,
          addedBy: adminId,
          isUsed: true,
          isExpired: true,
          commentCount: 0,
        };
        await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 1,
          overworld: "101",
        });
        const secondSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 2,
          overworld: "102",
        });
        await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 3,
          overworld: "103",
        });
        const otherWeekSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          assignedWeekNumber: 2,
          seedNumber: 2,
          overworld: "202",
        });

        return { adminId, leagueId, secondSeedId, otherWeekSeedId };
      }
    );
    const admin = t.withIdentity({ subject: adminId });

    await admin.mutation(reorderSeed, {
      seedId: secondSeedId,
      movement: "UP",
    });

    const ordered = await admin.query(listSeeds, {
      leagueId,
      weekNumber: 3,
    });
    const result = await t.run(async (ctx) => ({
      otherWeekSeed: await ctx.db.get("seeds", otherWeekSeedId),
      log: (await ctx.db.query("logs").collect()).find(
        (log) => log.targetId === secondSeedId
      ),
    }));

    expect(ordered.map((seed) => [seed.overworld, seed.seedNumber])).toEqual([
      ["102", 1],
      ["101", 2],
      ["103", 3],
    ]);
    expect(result.otherWeekSeed?.seedNumber).toBe(2);
    expect(result.log).toMatchObject({
      eventType: "seed.reordered",
      actorId: adminId,
      targetId: secondSeedId,
    });
  });

  test("hard-deletes a seed and its comments while compacting order and current counters", async () => {
    const t = convexTest(schema, modules);
    const { adminId, leagueId, deletedSeedId } = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("users", {
        name: "History Admin",
        status: "active",
        roles: ["admin"],
      });
      const leagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 3,
        usedSeedCount: 2,
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
        addedBy: adminId,
        isExpired: false,
        commentCount: 0,
      };
      await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 1,
        overworld: "101",
        isUsed: true,
      });
      const deletedSeedId = await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 2,
        overworld: "102",
        isUsed: true,
        commentCount: 2,
      });
      await ctx.db.insert("seeds", {
        ...commonSeed,
        seedNumber: 3,
        overworld: "103",
        isUsed: false,
      });
      await ctx.db.insert("comments", {
        seedId: deletedSeedId,
        author: adminId,
        body: "First note",
        createdAt: 1,
      });
      await ctx.db.insert("comments", {
        seedId: deletedSeedId,
        author: adminId,
        body: "Second note",
        createdAt: 2,
      });

      return { adminId, leagueId, deletedSeedId };
    });
    const admin = t.withIdentity({ subject: adminId });

    await admin.mutation(deleteSeed, { seedId: deletedSeedId });

    const ordered = await admin.query(listSeeds, {
      leagueId,
      weekNumber: 4,
    });
    const result = await t.run(async (ctx) => ({
      deletedSeed: await ctx.db.get("seeds", deletedSeedId),
      comments: await ctx.db
        .query("comments")
        .withIndex("by_seedId_and_createdAt", (q) =>
          q.eq("seedId", deletedSeedId)
        )
        .collect(),
      league: await ctx.db.get("leagues", leagueId),
      log: (await ctx.db.query("logs").collect()).find(
        (log) => log.targetId === deletedSeedId
      ),
    }));

    expect(result.deletedSeed).toBeNull();
    expect(result.comments).toEqual([]);
    expect(ordered.map((seed) => [seed.overworld, seed.seedNumber])).toEqual([
      ["101", 1],
      ["103", 2],
    ]);
    expect(result.league).toMatchObject({ seedCount: 2, usedSeedCount: 1 });
    expect(result.log).toMatchObject({
      eventType: "seed.deleted",
      actorId: adminId,
      targetId: deletedSeedId,
      targetLabel: "Seed 102",
    });
  });
});
