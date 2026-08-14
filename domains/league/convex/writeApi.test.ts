import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const competitionArgs = {
  leagueTier: 1,
  weekNumber: 1,
  maxTimeLimitMs: 120_000,
};

const players = {
  alex: { uuid: "alex-uuid", ign: "Alex" },
  blair: { uuid: "blair-uuid", ign: "Blair" },
};

async function setupCompetition() {
  const t = convexTest(schema, modules);

  await t.mutation(
    internal.writeApi.createOrRestartCompetition,
    competitionArgs
  );
  for (const player of Object.values(players)) {
    await t.mutation(internal.writeApi.registerPlayer, {
      leagueTier: competitionArgs.leagueTier,
      weekNumber: competitionArgs.weekNumber,
      ...player,
    });
  }

  return t;
}

describe("match result imports", () => {
  test("stores explicit misses and includes them after a player's first result", async () => {
    const t = await setupCompetition();

    await t.mutation(internal.writeApi.importMatchData, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 60_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });

    let state = await t.run(async (ctx) => ({
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));

    expect(state.results).toHaveLength(2);

    const alexRegistration = state.registrations.find(
      (registration) => registration.playerIgn === players.alex.ign
    );
    const blairRegistration = state.registrations.find(
      (registration) => registration.playerIgn === players.blair.ign
    );
    expect(alexRegistration?.averageTimeMs).toBe(60_000);
    expect(blairRegistration?.averageTimeMs).toBeNull();

    const blairId = blairRegistration?.playerId;
    expect(blairId).toBeDefined();
    expect(
      state.results.find((result) => result.playerId === blairId)
    ).toMatchObject({
      missed: true,
      timeMs: null,
      dnf: false,
      placement: null,
      pointsWon: 0,
    });

    await t.mutation(internal.writeApi.importMatchData, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 2,
      rankedMatchId: "ranked-2",
      results: [
        {
          uuid: players.blair.uuid,
          timeMs: 80_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });

    state = await t.run(async (ctx) => ({
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));

    expect(state.results).toHaveLength(4);
    expect(
      state.registrations.find(
        (registration) => registration.playerIgn === players.alex.ign
      )?.averageTimeMs
    ).toBe(90_000);
    expect(
      state.registrations.find(
        (registration) => registration.playerIgn === players.blair.ign
      )?.averageTimeMs
    ).toBe(100_000);
  });

  test("replaces a match snapshot and returns all-missed players to null", async () => {
    const t = await setupCompetition();

    await t.mutation(internal.writeApi.importMatchData, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
      results: [
        {
          uuid: players.blair.uuid,
          timeMs: 80_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });
    await t.mutation(internal.writeApi.importMatchData, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1-corrected",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 50_000,
          dnf: false,
          placement: 1,
          pointsWon: 8,
        },
      ],
    });

    const state = await t.run(async (ctx) => ({
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));

    expect(state.results).toHaveLength(2);
    expect(
      state.registrations.find(
        (registration) => registration.playerIgn === players.alex.ign
      )
    ).toMatchObject({
      averageTimeMs: 50_000,
      computedSeedPoints: 8,
      totalPoints: 8,
    });
    expect(
      state.registrations.find(
        (registration) => registration.playerIgn === players.blair.ign
      )
    ).toMatchObject({
      averageTimeMs: null,
      computedSeedPoints: 0,
      totalPoints: 0,
    });
  });

  test("clearing an import removes its outcomes and averages", async () => {
    const t = await setupCompetition();

    await t.mutation(internal.writeApi.importMatchData, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 60_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });
    await t.mutation(internal.writeApi.clearMatchResults, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
    });

    const state = await t.run(async (ctx) => ({
      match: await ctx.db.query("matches").first(),
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));

    expect(state.results).toEqual([]);
    expect(state.match?.rankedMatchId).toBeUndefined();
    expect(
      state.registrations.map((registration) => registration.averageTimeMs)
    ).toEqual([null, null]);
  });
});
