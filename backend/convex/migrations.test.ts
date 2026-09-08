import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

describe("missed match result migration", () => {
  test("deduplicates legacy outcomes and remains idempotent", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const competitionId = await ctx.db.insert("competitions", {
        leagueTier: 2,
        weekNumber: 1,
        status: "ended",
        maxTimeLimitMs: 900_000,
      });
      const playedPlayerId = await ctx.db.insert("players", {
        uuid: "aquabee-snapshot-uuid",
        ign: "aquabee_",
        lowercaseIgn: "aquabee_",
        currentLeagueNumber: 2,
      });
      const missedPlayerId = await ctx.db.insert("players", {
        uuid: "missing-snapshot-uuid",
        ign: "MissingPlayer",
        lowercaseIgn: "missingplayer",
        currentLeagueNumber: 2,
      });

      for (const [playerId, playerIgn] of [
        [playedPlayerId, "aquabee_"],
        [missedPlayerId, "MissingPlayer"],
      ] as const) {
        await ctx.db.insert("registrations", {
          competitionId,
          playerId,
          manualAdjustmentPoints: 0,
          computedSeedPoints: 0,
          totalPoints: 0,
          averageTimeMs: playerId === playedPlayerId ? 900_000 : null,
          playerIgn,
          weekNumber: 1,
          leagueTier: 2,
        });
      }

      const matchId = await ctx.db.insert("matches", {
        competitionId,
        matchNumber: 2,
        rankedMatchId: "7631089",
        winnerPlayerId: null,
        winnerName: null,
      });

      // The Week 19 snapshot has two DNF rows for this exact match/player key.
      for (const placement of [55, 50]) {
        await ctx.db.insert("matchResults", {
          matchId,
          playerId: playedPlayerId,
          competitionId,
          weekNumber: 1,
          leagueTier: 2,
          matchNumber: 2,
          timeMs: null,
          dnf: true,
          placement,
          pointsWon: 0,
        });
      }
    });

    const firstRun = await t.mutation(
      internal.migrations.backfillMissedMatchResults,
      { paginationOpts: { cursor: null, numItems: 16 } }
    );
    expect(firstRun).toEqual({ processed: 2, isDone: true });

    const afterFirstRun = await t.run(async (ctx) => ({
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));
    expect(afterFirstRun.results).toHaveLength(2);
    expect(
      afterFirstRun.results.find((result) => result.missed === false)
    ).toMatchObject({ placement: 50, dnf: true, timeMs: null });
    expect(
      afterFirstRun.results.find((result) => result.missed === true)
    ).toMatchObject({ placement: null, dnf: false, timeMs: null });
    expect(
      afterFirstRun.registrations.find(
        (registration) => registration.playerIgn === "aquabee_"
      )?.averageTimeMs
    ).toBe(900_000);
    expect(
      afterFirstRun.registrations.find(
        (registration) => registration.playerIgn === "MissingPlayer"
      )?.averageTimeMs
    ).toBeNull();

    await t.mutation(internal.migrations.backfillMissedMatchResults, {
      paginationOpts: { cursor: null, numItems: 16 },
    });
    const afterSecondRun = await t.run(async (ctx) =>
      ctx.db.query("matchResults").collect()
    );
    expect(afterSecondRun).toEqual(afterFirstRun.results);
  });
});
