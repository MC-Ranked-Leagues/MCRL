import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { ConvexHttpClient } from "convex/browser";

import {
  buildReplayPlan,
  developmentUrl,
  publishReplayPlan,
} from "../../scripts/replay-week";

const databases: Database[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function backup({ modern = false } = {}) {
  const db = new Database(":memory:");
  databases.push(db);
  db.exec(`
    CREATE TABLE competitions (id, guild_id, league_number, week_number, status,
      has_used_relegate, max_time_limit_ms, started_at);
    CREATE TABLE registrations (id, competition_id, discord_user_id, account_version,
      minecraft_uuid, ign, elo, average_used, movement${modern ? ", current_percentage" : ""});
    CREATE TABLE matches (id, competition_id, number, time_limit_ms, ranked_match_id, imported);
    CREATE TABLE match_results (match_id, registration_id, status, time_ms, placement, points);
    INSERT INTO competitions VALUES (1, 'source-guild', 3, 26, 'ended', 1, 120000, 1000);
    INSERT INTO registrations VALUES
      (1, 1, 'alex-discord', 1, 'alex', 'Alex', NULL, 91, 'promote'${modern ? ", 100" : ""}),
      (2, 1, 'blair-discord', 1, 'blair', 'Blair', 1200, 12, 'demote'${modern ? ", 50" : ""}),
      (3, 1, 'casey-discord', 1, 'casey', 'Casey', NULL, 0, 'demote'${modern ? ", 0" : ""}),
      (4, 1, 'drew-discord', 1, 'drew', 'Drew', NULL, NULL, 'none'${modern ? ", NULL" : ""});
    INSERT INTO matches VALUES (1, 1, 1, 120000, 'ranked-1', 1), (2, 1, 2, 120000, 'ranked-2', 1);
    INSERT INTO match_results VALUES
      (1, 1, 'finished', 60000, 1, 10), (2, 1, 'finished', 70000, 1, 10),
      (1, 2, 'missed', NULL, NULL, 0), (2, 2, 'finished', 100000, 2, 5),
      (1, 3, 'dnf', NULL, NULL, 0), (2, 3, 'missed', NULL, NULL, 0),
      (1, 4, 'missed', NULL, NULL, 0), (2, 4, 'missed', NULL, NULL, 0);
  `);
  db.exec(`
      CREATE TABLE players (id, guild_id, discord_user_id, minecraft_uuid, account_version, league_number, placements, ign, status);
      INSERT INTO players VALUES
        (1, 'source-guild', 'alex-discord', 'alex', 1, 2, '[]', 'Alex', 'active'),
        (2, 'source-guild', 'blair-discord', 'blair', 1, 4, '[{"week":25,"league":3,"percentage":10},{"week":26,"league":3,"percentage":85}]', 'Blair', 'active'),
        (3, 'source-guild', 'casey-discord', 'casey', 1, 4, '[{"week":26,"league":3,"percentage":85}]', 'Casey', 'active'),
        (4, 'source-guild', 'unregistered', 'other', 1, 7, '[]', 'Other', 'active'),
        (5, 'source-guild', 'pending', 'pending', 1, NULL, '[]', 'Pending', 'pending'),
        (6, 'another-guild', 'foreign', 'foreign', 1, 1, '[]', 'Foreign', 'active');
    `);
  return db;
}

function recordingClient(existingWeek = false, failAt?: string) {
  const requests: Array<{ path: string; args: Record<string, unknown> }> = [];
  const client = new ConvexHttpClient("https://test.convex.cloud", {
    fetch: ((_input, init) => {
      if (typeof init?.body !== "string")
        throw new Error("Expected a JSON request body.");
      const payload = JSON.parse(init.body) as {
        path: string;
        args: Record<string, unknown>[];
      };
      const request = { path: payload.path, args: payload.args[0]! };
      requests.push(request);
      if (request.path === failAt)
        return Promise.reject(new Error("Request failed"));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            status: "success",
            value:
              request.path === "weekView:getAllWeeks"
                ? existingWeek
                  ? [{ weekNumber: 26, isActive: false }]
                  : []
                : { ok: true },
          }),
          { status: 200 }
        )
      );
    }) as typeof fetch,
  });
  return { client, requests };
}

test("legacy backup reconstructs weekly percentages and preserves saved decisions and rolling histories", () => {
  const plan = buildReplayPlan(backup(), 26);
  expect(plan.competitions[0]!.movements).toEqual([
    {
      uuid: "alex",
      movementStatus: "promoted",
      currentPercentage: 100,
      averagePercentage: 91,
    },
    {
      uuid: "blair",
      movementStatus: "demoted",
      currentPercentage: 50,
      averagePercentage: 12,
    },
    {
      uuid: "casey",
      movementStatus: "demoted",
      currentPercentage: 0,
      averagePercentage: 0,
    },
    {
      uuid: "drew",
      movementStatus: "none",
      currentPercentage: null,
      averagePercentage: null,
    },
  ]);
  expect(plan.players.find((player) => player.uuid === "blair")).toEqual({
    uuid: "blair",
    ign: "Blair",
    leagueTier: 4,
    percentageHistory: [
      { week: 25, league: 3, percentage: 10 },
      { week: 26, league: 3, percentage: 85 },
    ],
  });
  expect(
    plan.players.find((player) => player.uuid === "alex")?.percentageHistory
  ).toEqual([]);
  expect(
    plan.competitions[0]!.matches[0]!.results.map((result) => result.uuid)
  ).toEqual(["alex", "casey"]);
  expect(plan.competitions[0]!.matches[0]!.results[1]).toMatchObject({
    dnf: true,
    pointsWon: 0,
  });
});

test("saved percentages take precedence, and the full player import includes unregistered active accounts", () => {
  const db = backup({ modern: true });
  db.run("UPDATE registrations SET current_percentage = 95 WHERE id = 1");
  const plan = buildReplayPlan(db, 26);
  expect(plan.competitions[0]!.movements[0]!.currentPercentage).toBe(95);
  expect(plan.players.map((player) => player.uuid)).toEqual([
    "alex",
    "blair",
    "casey",
    "other",
  ]);
  expect(plan.skippedPlayers).toBe(1);
});

test("replay rejects incomplete matches, unfinalized weeks and invalid player histories", () => {
  const db = backup();
  db.run(
    "DELETE FROM match_results WHERE registration_id = 4 AND match_id = 1"
  );
  expect(() => buildReplayPlan(db, 26)).toThrow("incomplete roster");
  db.run("INSERT INTO match_results VALUES (1, 4, 'missed', NULL, NULL, 0)");
  db.run("UPDATE competitions SET has_used_relegate = 0");
  expect(() => buildReplayPlan(db, 26)).toThrow("ended and relegated");
  db.run("UPDATE competitions SET has_used_relegate = 1");
  db.run("UPDATE players SET placements = ? WHERE minecraft_uuid = 'alex'", [
    JSON.stringify([{ week: 26, league: 3, percentage: 999 }]),
  ]);
  expect(() => buildReplayPlan(db, 26)).toThrow("Invalid saved player state");
});

test("bulk import uses current accounts while old competition snapshots retain their identity", () => {
  const db = backup();
  db.run(
    "UPDATE players SET account_version = 2, minecraft_uuid = 'new-alex' WHERE minecraft_uuid = 'alex'"
  );
  const plan = buildReplayPlan(db, 26);
  expect(plan.players.some((player) => player.uuid === "new-alex")).toBe(true);
  expect(plan.players.some((player) => player.uuid === "alex")).toBe(false);
  expect(plan.competitions[0]!.movements[0]!.uuid).toBe("alex");
});

test("only the recorded development deployment can be selected", () => {
  expect(
    developmentUrl("dev:local-test", "https://local-test.convex.cloud/")
  ).toBe("https://local-test.convex.cloud");
  expect(() =>
    developmentUrl("prod:live", "https://live.convex.cloud")
  ).toThrow("dev:");
  expect(() =>
    developmentUrl("dev:local-test", "https://live.convex.cloud")
  ).toThrow("does not match");
});

test("typed writes create registrations before results and restore all saved player states last", async () => {
  const plan = buildReplayPlan(backup(), 26);
  const { client, requests } = recordingClient();
  await publishReplayPlan(client, "test-key", plan, () => {});
  expect(requests.map((request) => request.path)).toEqual([
    "weekView:getAllWeeks",
    "writes/competitions:createCompetition",
    ...Array<string>(4).fill("writes/players:registerPlayer"),
    ...Array<string>(2).fill("writes/matches:importMatchData"),
    "writes/competitions:endCompetition",
    "writes/competitions:processMovements",
    ...Array<string>(4).fill("writes/players:upsertPlayer"),
  ]);
  expect(requests[2]!.args).not.toHaveProperty("elo");
  expect(requests[3]!.args.elo).toBe(1200);
  expect(
    requests.find(
      (request) => request.path === "writes/competitions:endCompetition"
    )!.args.movements
  ).toEqual(plan.competitions[0]!.movements);
  expect(
    requests.find(
      (request) => request.path === "writes/competitions:processMovements"
    )!.args.movements
  ).toEqual(plan.competitions[0]!.movements);
  expect(requests.at(-1)!.args).toEqual({
    writerKey: "test-key",
    ...plan.players.at(-1)!,
  });
});

test("an existing target week is refused before any mutation", async () => {
  const { client, requests } = recordingClient(true);
  const error = await publishReplayPlan(
    client,
    "test-key",
    buildReplayPlan(backup(), 26),
    () => {}
  ).catch((error: unknown) => error);
  expect(error instanceof Error ? error.message : null).toContain(
    "already exists"
  );
  expect(requests).toHaveLength(1);
});

test("a failed mutation stops the replay without retries or finalization", async () => {
  const { client, requests } = recordingClient(
    false,
    "writes/matches:importMatchData"
  );
  const error = await publishReplayPlan(
    client,
    "test-key",
    buildReplayPlan(backup(), 26),
    () => {}
  ).catch((error: unknown) => error);
  expect(error).toMatchObject({ message: "Request failed" });
  expect(
    requests.filter(
      (request) => request.path === "writes/matches:importMatchData"
    )
  ).toHaveLength(1);
  expect(
    requests.some(
      (request) => request.path === "writes/competitions:processMovements"
    )
  ).toBe(false);
});
