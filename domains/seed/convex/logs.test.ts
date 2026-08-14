/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("audit logs", () => {
  test("are admin-only, paginated, and filterable", async () => {
    const t = convexTest(schema, modules);
    const [adminId, hostId] = await t.run(async (ctx) => {
      return await Promise.all([
        ctx.db.insert("users", {
          name: "Audit Admin",
          status: "active",
          roles: ["admin"],
        }),
        ctx.db.insert("users", {
          name: "League Host",
          status: "active",
          roles: ["host"],
        }),
      ]);
    });
    const admin = t.withIdentity({ subject: adminId });
    const host = t.withIdentity({ subject: hostId });

    await admin.mutation(api.leagues.addLeague, {
      leagueNumber: 1,
      leagueName: "League One",
    });
    await admin.mutation(api.leagues.addLeague, {
      leagueNumber: 2,
      leagueName: "League Two",
    });

    const firstPage = await admin.query(api.logs.list, {
      paginationOpts: { numItems: 1, cursor: null },
    });

    expect(firstPage.page).toHaveLength(1);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.page[0]).toMatchObject({
      eventType: "league.created",
      actorName: "Audit Admin",
      actorType: "admin",
      targetLabel: "League Two",
    });

    const secondPage = await admin.query(api.logs.list, {
      paginationOpts: {
        numItems: 1,
        cursor: firstPage.continueCursor,
      },
    });

    expect(secondPage.page).toHaveLength(1);
    expect(secondPage.page[0].targetLabel).toBe("League One");

    const filteredPage = await admin.query(api.logs.list, {
      paginationOpts: { numItems: 25, cursor: null },
      eventType: "league.created",
      actorType: "admin",
    });

    expect(filteredPage.page).toHaveLength(2);

    await expect(
      host.query(api.logs.list, {
        paginationOpts: { numItems: 25, cursor: null },
      })
    ).rejects.toThrow("Admin access required");
  });

  test("records testing state and week advancement", async () => {
    const t = convexTest(schema, modules);
    const adminId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        name: "Tournament Admin",
        status: "active",
        roles: ["admin"],
      });

      await ctx.db.insert("settings", {
        key: "global",
        currentWeekNumber: 4,
        seedTestingPaused: false,
      });

      return userId;
    });
    const admin = t.withIdentity({ subject: adminId });

    await admin.mutation(api.settings.pauseSeedTesting, {});
    await admin.mutation(api.settings.resumeSeedTesting, {});
    const result = await admin.mutation(api.settings.advanceWeek, {});

    expect(result).toEqual({ currentWeekNumber: 5, expiredCount: 0 });

    const logs = await admin.query(api.logs.list, {
      paginationOpts: { numItems: 25, cursor: null },
      actorType: "admin",
    });

    expect(logs.page.map((log) => log.eventType)).toEqual([
      "week.advanced",
      "testing.resumed",
      "testing.paused",
    ]);
    expect(logs.page[0].summary).toContain("week 4 to week 5");
  });
});
