import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const competitionArgs = {
  writerKey: "test-writer-key",
  leagueTier: 1,
  weekNumber: 1,
  maxTimeLimitMs: 120_000,
};

const players = {
  alex: { uuid: "alex-uuid", ign: "Alex" },
  blair: { uuid: "blair-uuid", ign: "Blair" },
};

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("WRITER_API_KEY", "test-writer-key");
});

async function setupCompetition() {
  const t = convexTest(schema, modules);

  await t.mutation(api.writes.competitions.createCompetition, competitionArgs);
  for (const player of Object.values(players)) {
    await t.mutation(api.writes.players.registerPlayer, {
      writerKey: "test-writer-key",
      leagueTier: competitionArgs.leagueTier,
      weekNumber: competitionArgs.weekNumber,
      ...player,
    });
  }

  return t;
}

describe("match result imports", () => {
  test("throws and rolls back when an imported player does not exist", async () => {
    const t = await setupCompetition();

    const importResult = t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
      results: [
        {
          uuid: "unknown-uuid",
          timeMs: 60_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });

    await expect(importResult).rejects.toBeInstanceOf(ConvexError);

    const matches = await t.run(async (ctx) =>
      ctx.db.query("matches").collect()
    );
    expect(matches).toEqual([]);
  });

  test("stores explicit misses and includes them after a player's first result", async () => {
    const t = await setupCompetition();

    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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

    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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

    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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
    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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

  test("clearing an import deletes its match and outcomes", async () => {
    const t = await setupCompetition();

    const imported = await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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
    const cleared = await t.mutation(api.writes.matches.deleteMatch, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
    });

    const state = await t.run(async (ctx) => ({
      alex: await ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", players.alex.uuid))
        .unique(),
      match: await ctx.db.query("matches").first(),
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));

    expect(state.results).toEqual([]);
    expect(state.match).toBeNull();
    expect(cleared).toEqual({
      ok: true,
      competitionId: imported.competitionId,
      matchId: imported.matchId,
      deleted: 2,
    });
    expect(
      state.registrations.map((registration) => registration.averageTimeMs)
    ).toEqual([null, null]);
    expect(state.alex?.fastestTimeMs).toBeUndefined();
  });

  test("clearing a match recalculates points, averages, and fastest times", async () => {
    const t = await setupCompetition();

    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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
    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 2,
      rankedMatchId: "ranked-2",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 80_000,
          dnf: false,
          placement: 1,
          pointsWon: 6,
        },
      ],
    });

    await t.mutation(api.writes.matches.deleteMatch, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
    });

    const state = await t.run(async (ctx) => ({
      alex: await ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", players.alex.uuid))
        .unique(),
      alexRegistration: await ctx.db
        .query("registrations")
        .filter((q) => q.eq(q.field("playerIgn"), players.alex.ign))
        .unique(),
      matches: await ctx.db.query("matches").collect(),
    }));

    expect(state.matches.map((match) => match.matchNumber)).toEqual([2]);
    expect(state.alexRegistration).toMatchObject({
      averageTimeMs: 80_000,
      computedSeedPoints: 6,
      totalPoints: 6,
    });
    expect(state.alex?.fastestTimeMs).toBe(80_000);
  });

  test("clearing an empty match deletes it", async () => {
    const t = await setupCompetition();

    await t.mutation(internal.writes.matches.createEmptyMatch, {
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
    });
    const cleared = await t.mutation(api.writes.matches.deleteMatch, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
    });

    const matches = await t.run(async (ctx) =>
      ctx.db.query("matches").collect()
    );
    expect(matches).toEqual([]);
    expect(cleared.deleted).toBe(0);
  });
});

describe("writer publication", () => {
  test("rejects the wrong writer key before changing data", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.writes.competitions.createCompetition, {
        ...competitionArgs,
        writerKey: "wrong-key",
      })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(
      await t.run((ctx) => ctx.db.query("competitions").collect())
    ).toEqual([]);
  });

  test("a duplicate competition leaves its roster and results intact", async () => {
    const t = await setupCompetition();
    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
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
    await expect(
      t.mutation(api.writes.competitions.createCompetition, competitionArgs)
    ).rejects.toBeInstanceOf(ConvexError);
    const state = await t.run(async (ctx) => ({
      registrations: await ctx.db.query("registrations").collect(),
      results: await ctx.db.query("matchResults").collect(),
    }));
    expect(state.registrations).toHaveLength(2);
    expect(state.results).toHaveLength(2);
  });

  test("account migration clears live histories and preserves old league and registrations", async () => {
    const t = await setupCompetition();
    await t.mutation(api.writes.players.upsertPlayer, {
      writerKey: "test-writer-key",
      uuid: "destination-uuid",
      ign: "New",
      leagueTier: 3,
    });
    await t.run(async (ctx) => {
      const old = await ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", players.alex.uuid))
        .unique();
      const destination = await ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", "destination-uuid"))
        .unique();
      if (!old || !destination) throw new Error("Missing setup players");
      await ctx.db.patch("players", old._id, {
        percentageHistory: [{ week: 1, league: 1, percentage: 70 }],
      });
      await ctx.db.patch("players", destination._id, {
        percentageHistory: [{ week: 1, league: 3, percentage: 50 }],
      });
    });
    await t.mutation(api.writes.players.migratePlayerAccount, {
      writerKey: "test-writer-key",
      oldUuid: players.alex.uuid,
      newUuid: "destination-uuid",
      ign: "New",
      leagueTier: 2,
    });
    const state = await t.run(async (ctx) => ({
      players: await ctx.db.query("players").collect(),
      registrations: await ctx.db.query("registrations").collect(),
    }));
    expect(
      state.players.find((p) => p.uuid === players.alex.uuid)
    ).toMatchObject({ currentLeagueNumber: 1, percentageHistory: [] });
    expect(
      state.players.find((p) => p.uuid === "destination-uuid")
    ).toMatchObject({ currentLeagueNumber: 2, percentageHistory: [] });
    expect(
      state.registrations.find((r) => r.playerIgn === players.alex.ign)
    ).toBeDefined();
  });

  test("preview clears on reopen and finalization only updates explicitly current accounts", async () => {
    const t = await setupCompetition();
    const base = { writerKey: "test-writer-key", leagueTier: 1, weekNumber: 1 };

    const movements = [
      {
        uuid: players.alex.uuid,
        movementStatus: "promoted" as const,
        currentPercentage: 100,
        averagePercentage: 90,
      },
      {
        uuid: players.blair.uuid,
        movementStatus: "none" as const,
        currentPercentage: null,
        averagePercentage: null,
      },
    ];
    await t.mutation(api.writes.competitions.endCompetition, {
      ...base,
      movements,
    });
    await t.mutation(api.writes.competitions.reopenCompetition, {
      ...base,
    });
    let state = await t.run(async (ctx) => ({
      competition: await ctx.db.query("competitions").first(),
      registrations: await ctx.db.query("registrations").collect(),
    }));
    expect(state.competition?.movementPhase).toBeUndefined();
    expect(
      state.registrations.every((r) => r.currentPercentage === undefined)
    ).toBe(true);
    await t.mutation(api.writes.competitions.endCompetition, {
      ...base,
      movements,
    });
    await t.mutation(api.writes.competitions.processMovements, {
      ...base,
      movements: [
        { ...movements[0]! },
        {
          ...movements[1]!,
          playerUpdate: {
            leagueTier: 2,
            percentageHistory: [{ week: 1, league: 1, percentage: 0 }],
          },
        },
      ],
    });
    state = await t.run(async (ctx) => ({
      competition: await ctx.db.query("competitions").first(),
      registrations: await ctx.db.query("registrations").collect(),
    }));
    const accounts = await t.run((ctx) => ctx.db.query("players").collect());
    expect(state.competition?.movementPhase).toBe("done");
    expect(
      state.registrations.find((r) => r.playerIgn === "Alex")
    ).toMatchObject({
      movementStatus: "promoted",
      currentPercentage: 100,
      averagePercentage: 90,
    });
    expect(
      accounts.find((p) => p.uuid === players.alex.uuid)?.currentLeagueNumber
    ).toBe(1);
    expect(accounts.find((p) => p.uuid === players.blair.uuid)).toMatchObject({
      currentLeagueNumber: 2,
      percentageHistory: [{ week: 1, league: 1, percentage: 0 }],
    });
    await expect(
      t.mutation(api.writes.competitions.reopenCompetition, {
        ...base,
      })
    ).rejects.toBeInstanceOf(ConvexError);
  });
});

describe("corrected published snapshots", () => {
  test("a slower replacement updates the player's fastest time", async () => {
    const t = await setupCompetition();
    const base = {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
    };
    await t.mutation(api.writes.matches.importMatchData, {
      ...base,
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 50_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });
    await t.mutation(api.writes.matches.importMatchData, {
      ...base,
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 70_000,
          dnf: false,
          placement: 1,
          pointsWon: 7,
        },
      ],
    });
    const state = await t.run(async (ctx) => ({
      player: await ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", players.alex.uuid))
        .unique(),
      registration: await ctx.db.query("registrations").collect(),
    }));
    expect(state.player?.fastestTimeMs).toBe(70_000);
    expect(
      state.registration.find((r) => r.playerId === state.player?._id)
    ).toMatchObject({
      computedSeedPoints: 7,
      totalPoints: 7,
      averageTimeMs: 70_000,
    });
  });

  test("unregister removes published outcomes and refreshes winner", async () => {
    const t = await setupCompetition();
    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 50_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
        {
          uuid: players.blair.uuid,
          timeMs: 60_000,
          dnf: false,
          placement: 2,
          pointsWon: 7,
        },
      ],
    });
    await t.mutation(api.writes.players.unregisterPlayer, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      uuid: players.alex.uuid,
    });
    const state = await t.run(async (ctx) => ({
      match: await ctx.db.query("matches").first(),
      results: await ctx.db.query("matchResults").collect(),
      registrations: await ctx.db.query("registrations").collect(),
    }));
    expect(state.registrations).toHaveLength(1);
    expect(state.results).toHaveLength(1);
    expect(state.match?.winnerName).toBe("Blair");
  });
});

describe("public mutation input limits", () => {
  test("rejects malformed competition and match values", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.writes.competitions.createCompetition, {
        ...competitionArgs,
        maxTimeLimitMs: -1,
      })
    ).rejects.toBeInstanceOf(ConvexError);
    await expect(
      t.mutation(api.writes.competitions.createCompetition, {
        ...competitionArgs,
        weekNumber: 1.5,
      })
    ).rejects.toBeInstanceOf(ConvexError);
    expect(
      await t.run((ctx) => ctx.db.query("competitions").collect())
    ).toEqual([]);
  });

  test("rejects invalid snapshot fields before replacing an existing match", async () => {
    const t = await setupCompetition();
    await t.mutation(api.writes.matches.importMatchData, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      matchNumber: 1,
      rankedMatchId: "ranked-1",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 50_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });
    await expect(
      t.mutation(api.writes.matches.importMatchData, {
        writerKey: "test-writer-key",
        leagueTier: 1,
        weekNumber: 1,
        matchNumber: 1,
        rankedMatchId: " ",
        results: [
          {
            uuid: players.alex.uuid,
            timeMs: -1,
            dnf: false,
            placement: 1,
            pointsWon: -1,
          },
        ],
      })
    ).rejects.toBeInstanceOf(ConvexError);
    const match = await t.run((ctx) => ctx.db.query("matches").first());
    expect(match?.rankedMatchId).toBe("ranked-1");
  });

  test("previews and finalizes every registration for a representative roster", async () => {
    const t = convexTest(schema, modules);
    const competitionId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("competitions", {
        leagueTier: 1,
        weekNumber: 1,
        status: "ended",
        maxTimeLimitMs: 120_000,
      });
      for (let i = 0; i < 3; i += 1) {
        const playerId = await ctx.db.insert("players", {
          uuid: `uuid-${i}`,
          ign: `Player${i}`,
          lowercaseIgn: `player${i}`,
          currentLeagueNumber: 1,
        });
        await ctx.db.insert("registrations", {
          competitionId: id,
          playerId,
          manualAdjustmentPoints: 0,
          computedSeedPoints: 0,
          totalPoints: 0,
          averageTimeMs: null,
          playerIgn: `Player${i}`,
          weekNumber: 1,
          leagueTier: 1,
          movementStatus: "none",
          currentPercentage: 0,
          averagePercentage: 0,
        });
      }
      return id;
    });
    await expect(
      t.mutation(api.writes.competitions.endCompetition, {
        writerKey: "test-writer-key",
        leagueTier: 1,
        weekNumber: 1,
        movements: [],
      })
    ).rejects.toBeInstanceOf(ConvexError);
    const movements = Array.from({ length: 3 }, (_, i) => ({
      uuid: `uuid-${i}`,
      movementStatus: "none" as const,
      currentPercentage: 0,
      averagePercentage: 0,
    }));
    expect(
      await t.mutation(api.writes.competitions.endCompetition, {
        writerKey: "test-writer-key",
        leagueTier: 1,
        weekNumber: 1,
        movements,
      })
    ).toMatchObject({ count: 3 });
    await t.mutation(api.writes.competitions.reopenCompetition, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
    });
    const state = await t.run(async (ctx) => ({
      competition: await ctx.db.get("competitions", competitionId),
      registrations: await ctx.db
        .query("registrations")
        .withIndex("by_competition", (q) =>
          q.eq("competitionId", competitionId)
        )
        .collect(),
    }));
    expect(state.competition?.status).toBe("active");
    expect(state.competition?.movementPhase).toBeUndefined();
    expect(state.registrations).toHaveLength(3);
    expect(
      state.registrations.every((row) => row.currentPercentage === undefined)
    ).toBe(true);

    await t.mutation(api.writes.competitions.endCompetition, {
      writerKey: "test-writer-key",
      leagueTier: 1,
      weekNumber: 1,
      movements,
    });
    expect(
      await t.mutation(api.writes.competitions.processMovements, {
        writerKey: "test-writer-key",
        leagueTier: 1,
        weekNumber: 1,
        movements,
      })
    ).toMatchObject({ count: 3 });
  });
});

describe("write simplifications", () => {
  test("ending and its preview either save together or leave the active week unchanged", async () => {
    const t = await setupCompetition();
    const base = { writerKey: "test-writer-key", leagueTier: 1, weekNumber: 1 };
    const movements = Object.values(players).map((player) => ({
      uuid: player.uuid,
      movementStatus: "none" as const,
      currentPercentage: 50,
      averagePercentage: 50,
    }));
    await expect(
      t.mutation(api.writes.competitions.endCompetition, {
        ...base,
        movements: [movements[0]!, movements[0]!],
      })
    ).rejects.toBeInstanceOf(ConvexError);
    let state = await t.run(async (ctx) => ({
      competition: await ctx.db.query("competitions").first(),
      week: await ctx.db.query("weeks").first(),
      registrations: await ctx.db.query("registrations").collect(),
    }));
    expect(state.competition?.status).toBe("active");
    expect(state.week?.activeCompetitionCount).toBe(1);
    expect(
      state.registrations.every((row) => row.currentPercentage === undefined)
    ).toBe(true);

    await t.mutation(api.writes.competitions.endCompetition, {
      ...base,
      movements,
    });
    // Repeating an end must not decrement the week's count a second time.
    await t.mutation(api.writes.competitions.endCompetition, {
      ...base,
      movements,
    });
    state = await t.run(async (ctx) => ({
      competition: await ctx.db.query("competitions").first(),
      week: await ctx.db.query("weeks").first(),
      registrations: await ctx.db.query("registrations").collect(),
    }));
    expect(state.competition).toMatchObject({
      status: "ended",
      movementPhase: "pending",
    });
    expect(state.week?.activeCompetitionCount).toBe(0);
    expect(
      state.registrations.every((row) => row.currentPercentage === 50)
    ).toBe(true);
    await t.mutation(api.writes.competitions.reopenCompetition, base);
    expect(await t.run((ctx) => ctx.db.query("weeks").first())).toMatchObject({
      activeCompetitionCount: 1,
    });
  });

  test("correcting this week's personal best restores a faster result from an older week", async () => {
    const t = await setupCompetition();
    const base = { writerKey: "test-writer-key", leagueTier: 1 };
    for (const [weekNumber, timeMs] of [
      [1, 66_000],
      [2, 60_000],
    ] as const) {
      if (weekNumber === 2) {
        await t.mutation(api.writes.competitions.createCompetition, {
          ...competitionArgs,
          weekNumber,
        });
        await t.mutation(api.writes.players.registerPlayer, {
          ...base,
          weekNumber,
          ...players.alex,
        });
      }
      await t.mutation(api.writes.matches.importMatchData, {
        ...base,
        weekNumber,
        matchNumber: 1,
        rankedMatchId: `week-${weekNumber}`,
        results: [
          {
            uuid: players.alex.uuid,
            timeMs,
            dnf: false,
            placement: 1,
            pointsWon: 10,
          },
        ],
      });
    }
    await t.mutation(api.writes.matches.importMatchData, {
      ...base,
      weekNumber: 2,
      matchNumber: 1,
      rankedMatchId: "week-2-corrected",
      results: [
        {
          uuid: players.alex.uuid,
          timeMs: 72_000,
          dnf: false,
          placement: 1,
          pointsWon: 10,
        },
      ],
    });
    const player = await t.run((ctx) =>
      ctx.db
        .query("players")
        .withIndex("by_uuid", (q) => q.eq("uuid", players.alex.uuid))
        .unique()
    );
    expect(player?.fastestTimeMs).toBe(66_000);
  });

  test.each(["upsert", "migration"])(
    "%s refreshes the existing player's names on standings and match winners",
    async (operation) => {
      const t = await setupCompetition();
      await t.mutation(api.writes.matches.importMatchData, {
        writerKey: "test-writer-key",
        leagueTier: 1,
        weekNumber: 1,
        matchNumber: 1,
        rankedMatchId: "name-test",
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
      if (operation === "upsert") {
        await t.mutation(api.writes.players.upsertPlayer, {
          writerKey: "test-writer-key",
          uuid: players.alex.uuid,
          ign: "NewName",
          leagueTier: 1,
        });
      } else {
        await t.mutation(api.writes.players.migratePlayerAccount, {
          writerKey: "test-writer-key",
          oldUuid: players.blair.uuid,
          newUuid: players.alex.uuid,
          ign: "NewName",
          leagueTier: 1,
        });
      }
      const state = await t.run(async (ctx) => ({
        match: await ctx.db.query("matches").first(),
        registrations: await ctx.db.query("registrations").collect(),
      }));
      expect(state.match?.winnerName).toBe("NewName");
      expect(
        state.registrations.some((row) => row.playerIgn === "NewName")
      ).toBe(true);
      expect(state.registrations.some((row) => row.playerIgn === "Alex")).toBe(
        false
      );
    }
  );
});
