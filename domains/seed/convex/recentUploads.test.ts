/// <reference types="vite/client" />

import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type RecentUpload = Doc<"seeds"> & {
  canEdit: boolean;
  editDisabledReason?: string;
  leagueName: string;
};

const listRecentUploads = makeFunctionReference<
  "query",
  Record<string, never>,
  RecentUpload[]
>("seeds:listRecentUploads");

const updateRecentSeed = makeFunctionReference<
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
  },
  null
>("seeds:updateRecentSeed");

describe("recent uploads", () => {
  test("returns the five newest owned current-week uploads across accessible host leagues", async () => {
    const t = convexTest(schema, modules);
    const { hostId } = await t.run(async (ctx) => {
      const firstLeagueId = await ctx.db.insert("leagues", {
        leagueNumber: 1,
        leagueName: "League One",
        seedCount: 4,
        usedSeedCount: 1,
      });
      const secondLeagueId = await ctx.db.insert("leagues", {
        leagueNumber: 2,
        leagueName: "League Two",
        seedCount: 2,
        usedSeedCount: 0,
      });
      const inaccessibleLeagueId = await ctx.db.insert("leagues", {
        leagueNumber: 3,
        leagueName: "League Three",
        seedCount: 6,
        usedSeedCount: 0,
      });
      const hostId = await ctx.db.insert("users", {
        name: "League Host",
        status: "active",
        roles: ["host"],
        hostLeagueId: [firstLeagueId, secondLeagueId],
      });
      const otherUploaderId = await ctx.db.insert("users", {
        name: "Other Uploader",
        status: "active",
        roles: ["uploader"],
        uploaderLeagues: [firstLeagueId],
      });
      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 7,
        seedTestingPaused: false,
      });

      const insertSeed = async ({
        addedBy = hostId,
        assignedWeekNumber = 7,
        isUsed = false,
        leagueId,
        overworld,
      }: {
        addedBy?: Id<"users">;
        assignedWeekNumber?: number;
        isUsed?: boolean;
        leagueId: Id<"leagues">;
        overworld: string;
      }) =>
        await ctx.db.insert("seeds", {
          seedNumber: Number(overworld),
          leagueId,
          assignedWeekNumber,
          overworld,
          nether: "2",
          end: "3",
          rng: "4",
          type: "VILLAGE",
          addedBy,
          isUsed,
          isExpired: false,
          commentCount: 0,
        });

      await insertSeed({ leagueId: firstLeagueId, overworld: "101" });
      await insertSeed({ leagueId: secondLeagueId, overworld: "102" });
      await insertSeed({ leagueId: firstLeagueId, overworld: "103" });
      await insertSeed({ leagueId: secondLeagueId, overworld: "104" });
      await insertSeed({ leagueId: firstLeagueId, overworld: "105" });
      await insertSeed({
        isUsed: true,
        leagueId: firstLeagueId,
        overworld: "106",
      });

      await insertSeed({
        leagueId: inaccessibleLeagueId,
        overworld: "201",
      });
      await insertSeed({
        leagueId: inaccessibleLeagueId,
        overworld: "202",
      });
      await insertSeed({
        assignedWeekNumber: 6,
        leagueId: firstLeagueId,
        overworld: "301",
      });
      await insertSeed({
        addedBy: otherUploaderId,
        leagueId: firstLeagueId,
        overworld: "401",
      });

      return { hostId };
    });

    const uploads = await t
      .withIdentity({ subject: hostId })
      .query(listRecentUploads, {});

    expect(uploads.map((seed) => seed.overworld)).toEqual([
      "106",
      "105",
      "104",
      "103",
      "102",
    ]);
    expect(uploads.map((seed) => seed.leagueName)).toEqual([
      "League One",
      "League One",
      "League Two",
      "League One",
      "League Two",
    ]);
    expect(uploads[0]).toMatchObject({
      canEdit: false,
      editDisabledReason: "Used seeds are read-only",
      isUsed: true,
    });
    expect(uploads[1]).toMatchObject({ canEdit: true, isUsed: false });
  });

  test("updates only editable values without changing upload order and logs changed fields", async () => {
    const t = convexTest(schema, modules);
    const { firstSeedId, leagueId, secondSeedId, uploaderId } = await t.run(
      async (ctx) => {
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
          currentWeekNumber: 7,
          seedTestingPaused: false,
          enableJunglePyramidSeeds: true,
        });
        const commonSeed = {
          leagueId,
          assignedWeekNumber: 7,
          nether: "2",
          end: "3",
          rng: "4",
          type: "VILLAGE" as const,
          isBt: false,
          addedBy: uploaderId,
          isUsed: false,
          isExpired: false,
          commentCount: 1,
        };
        const firstSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 1,
          overworld: "101",
        });
        await ctx.db.insert("comments", {
          seedId: firstSeedId,
          author: uploaderId,
          body: "Keep this comment",
          createdAt: 1,
        });
        const secondSeedId = await ctx.db.insert("seeds", {
          ...commonSeed,
          seedNumber: 2,
          overworld: "102",
          commentCount: 0,
        });

        return { firstSeedId, leagueId, secondSeedId, uploaderId };
      }
    );
    const uploader = t.withIdentity({ subject: uploaderId });
    const before = await t.run(async (ctx) => ctx.db.get("seeds", firstSeedId));

    await uploader.mutation(updateRecentSeed, {
      seedId: firstSeedId,
      overworld: " 201 ",
      nether: " 202",
      end: "203 ",
      rng: " -204 ",
      type: "BURIED_TREASURE",
    });

    const result = await t.run(async (ctx) => ({
      seed: await ctx.db.get("seeds", firstSeedId),
      comments: await ctx.db
        .query("comments")
        .withIndex("by_seedId_and_createdAt", (q) =>
          q.eq("seedId", firstSeedId)
        )
        .collect(),
      log: await ctx.db
        .query("logs")
        .withIndex("by_eventType", (q) => q.eq("eventType", "seed.updated"))
        .unique(),
    }));

    expect(result.seed).toMatchObject({
      _creationTime: before?._creationTime,
      _id: firstSeedId,
      addedBy: uploaderId,
      assignedWeekNumber: 7,
      commentCount: 1,
      end: "203",
      isBt: true,
      isExpired: false,
      isUsed: false,
      leagueId,
      nether: "202",
      overworld: "201",
      rng: "-204",
      seedNumber: 1,
      type: "BURIED_TREASURE",
    });
    expect(result.comments).toHaveLength(1);
    expect(result.log).toMatchObject({
      actorId: uploaderId,
      actorType: "uploader",
      eventType: "seed.updated",
      targetId: firstSeedId,
      targetLabel: "Seed 101",
    });
    expect(result.log?.summary).toContain(
      "overworld, nether, end, RNG and seed type"
    );
    expect(result.log?.summary).not.toContain("201");
    expect(result.log?.summary).not.toContain("202");

    const uploads = await uploader.query(listRecentUploads, {});
    expect(uploads.map((seed) => seed._id)).toEqual([
      secondSeedId,
      firstSeedId,
    ]);
  });

  test("rechecks edit eligibility and validation on the server", async () => {
    const t = convexTest(schema, modules);
    const { leagueId, otherUploaderId, seedId, settingsId, uploaderId } =
      await t.run(async (ctx) => {
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
        const otherUploaderId = await ctx.db.insert("users", {
          name: "Other Uploader",
          status: "active",
          roles: ["uploader"],
          uploaderLeagues: [leagueId],
        });
        const settingsId = await ctx.db.insert("settings", {
          key: "global",
          currentWeekNumber: 7,
          seedTestingPaused: false,
          enableJunglePyramidSeeds: false,
        });
        const seedId = await ctx.db.insert("seeds", {
          seedNumber: 1,
          leagueId,
          assignedWeekNumber: 7,
          overworld: "101",
          nether: "102",
          end: "103",
          rng: "104",
          type: "VILLAGE",
          addedBy: uploaderId,
          isUsed: false,
          isExpired: false,
          commentCount: 0,
        });
        await ctx.db.insert("seeds", {
          seedNumber: 2,
          leagueId,
          assignedWeekNumber: 7,
          overworld: "999",
          nether: "2",
          end: "3",
          rng: "4",
          type: "SHIPWRECK",
          addedBy: otherUploaderId,
          isUsed: false,
          isExpired: false,
          commentCount: 0,
        });

        return {
          leagueId,
          otherUploaderId,
          seedId,
          settingsId,
          uploaderId,
        };
      });
    const validArgs = {
      seedId,
      overworld: "201",
      nether: "202",
      end: "203",
      rng: "204",
      type: "VILLAGE" as const,
    };
    const uploader = t.withIdentity({ subject: uploaderId });

    await expect(
      t
        .withIdentity({ subject: otherUploaderId })
        .mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("Only the original uploader");

    await t.run(async (ctx) => {
      await ctx.db.patch("users", uploaderId, { uploaderLeagues: [] });
    });
    await expect(
      uploader.mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("no longer edit seeds in this league");
    await t.run(async (ctx) => {
      await ctx.db.patch("users", uploaderId, { uploaderLeagues: [leagueId] });
      await ctx.db.patch("settings", settingsId, { seedTestingPaused: true });
    });
    await expect(
      uploader.mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("Seed testing is currently paused");

    await t.run(async (ctx) => {
      await ctx.db.patch("settings", settingsId, { seedTestingPaused: false });
      await ctx.db.patch("seeds", seedId, { isUsed: true });
    });
    await expect(
      uploader.mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("Used seeds are read-only");

    await t.run(async (ctx) => {
      await ctx.db.patch("seeds", seedId, {
        isUsed: false,
        assignedWeekNumber: 6,
      });
    });
    await expect(
      uploader.mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("Only current-week seeds can be edited");

    await t.run(async (ctx) => {
      await ctx.db.patch("seeds", seedId, {
        assignedWeekNumber: 7,
        isExpired: true,
      });
    });
    await expect(
      uploader.mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("Expired seeds are read-only");

    await t.run(async (ctx) => {
      await ctx.db.patch("seeds", seedId, {
        isExpired: false,
        leagueId: undefined,
        assignedWeekNumber: undefined,
      });
    });
    await expect(
      uploader.mutation(updateRecentSeed, validArgs)
    ).rejects.toThrow("Only assigned seeds can be edited");

    await t.run(async (ctx) => {
      await ctx.db.patch("seeds", seedId, {
        leagueId,
        assignedWeekNumber: 7,
      });
    });
    await expect(
      uploader.mutation(updateRecentSeed, {
        ...validArgs,
        overworld: "12.3",
      })
    ).rejects.toThrow("must be a whole number");
    await expect(
      uploader.mutation(updateRecentSeed, {
        ...validArgs,
        overworld: "999",
      })
    ).rejects.toThrow("Seed already exists");
    await expect(
      uploader.mutation(updateRecentSeed, {
        ...validArgs,
        type: "JUNGLE_PYRAMID",
      })
    ).rejects.toThrow("not currently enabled");
  });
});
