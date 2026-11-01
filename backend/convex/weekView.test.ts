import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const writerKey = "test-writer-key";

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("WRITER_API_KEY", writerKey);
});

async function createCompetition(
  t: ReturnType<typeof convexTest>,
  weekNumber: number
) {
  await t.mutation(api.writes.competitions.createCompetition, {
    writerKey,
    leagueTier: 1,
    weekNumber,
    maxTimeLimitMs: 120_000,
  });
}

async function endCompetition(
  t: ReturnType<typeof convexTest>,
  weekNumber: number
) {
  await t.mutation(api.writes.competitions.endCompetition, {
    writerKey,
    leagueTier: 1,
    weekNumber,
    movements: [],
  });
}

function getArchivedResults(
  t: ReturnType<typeof convexTest>,
  weekNumber: number
) {
  return t.query(api.weekView.getArchivedResults, {
    weekNumber,
    leagueTier: 1,
  });
}

describe("getArchivedResults", () => {
  test("stays null for the newest week even with no league running", async () => {
    const t = convexTest(schema, modules);
    await createCompetition(t, 1);
    await endCompetition(t, 1);

    expect(await getArchivedResults(t, 1)).toBeNull();
  });

  test("returns results once a newer week exists", async () => {
    const t = convexTest(schema, modules);
    await createCompetition(t, 1);
    await endCompetition(t, 1);
    await createCompetition(t, 2);

    expect(await getArchivedResults(t, 1)).toEqual({
      standings: [],
      matches: [],
    });
    expect(await getArchivedResults(t, 2)).toBeNull();
  });

  test("stays null for an older week with an active competition", async () => {
    const t = convexTest(schema, modules);
    await createCompetition(t, 1);
    await createCompetition(t, 2);

    expect(await getArchivedResults(t, 1)).toBeNull();
  });

  test("stays null for a week that doesn't exist", async () => {
    const t = convexTest(schema, modules);
    await createCompetition(t, 1);

    expect(await getArchivedResults(t, 99)).toBeNull();
  });
});
