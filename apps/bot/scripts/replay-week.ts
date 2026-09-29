import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import { api } from "@mcrl/backend/api";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs } from "convex/server";

import { websiteMovementStatus } from "../src/db/publication-snapshots";
import type { RetainedPercentage } from "../src/lib/player-history";
import { requiredEnv } from "../src/lib/environment";

type Registration = {
  id: number;
  discordUserId: string;
  accountVersion: number;
  uuid: string;
  ign: string;
  elo: number | null;
  currentPercentage: number | null;
  averageUsed: number | null;
  movement: "none" | "promote" | "demote" | null;
};

type Competition = {
  id: number;
  guildId: string;
  leagueTier: number;
  weekNumber: number;
  status: string;
  hasUsedRelegate: number;
  maxTimeLimitMs: number;
  startingTime: number;
};

type Match = {
  id: number;
  matchNumber: number;
  timeLimitMs: number;
  rankedMatchId: string | null;
};

type Result = {
  registrationId: number;
  status: string;
  timeMs: number | null;
  placement: number | null;
  points: number;
};

type Movements = FunctionArgs<
  typeof api.writes.competitions.endCompetition
>["movements"];

export function buildReplayPlan(
  sqlite: Database,
  weekNumber: number,
  guildId?: string
) {
  const competitions = sqlite
    .query<Competition, [number]>(
      `SELECT id, guild_id AS guildId, league_number AS leagueTier,
              week_number AS weekNumber, status, has_used_relegate AS hasUsedRelegate,
              max_time_limit_ms AS maxTimeLimitMs, started_at AS startingTime
       FROM competitions WHERE week_number = ? ORDER BY league_number`
    )
    .all(weekNumber)
    .filter((competition) => !guildId || competition.guildId === guildId);
  if (!competitions.length)
    throw new Error(`No competitions for week ${weekNumber}.`);
  if (
    new Set(competitions.map((competition) => competition.guildId)).size !== 1
  )
    throw new Error("Multiple guilds have this week. Select one with --guild.");
  if (
    new Set(competitions.map((competition) => competition.leagueTier)).size !==
    competitions.length
  )
    throw new Error("Duplicate competitions for the same league and week.");

  // The week 26 backup predates this column. Never migrate or modify the source.
  const hasCurrentPercentage = sqlite
    .query<{ name: string }, []>("PRAGMA table_info(registrations)")
    .all()
    .some((column) => column.name === "current_percentage");

  const competitionPlans = competitions.map((competition) => {
    const label = `League ${competition.leagueTier}, week ${weekNumber}`;
    if (competition.status !== "ended" || !competition.hasUsedRelegate)
      throw new Error(`${label} must be ended and relegated before replay.`);
    if (
      !Number.isSafeInteger(competition.leagueTier) ||
      competition.leagueTier < 1 ||
      !Number.isSafeInteger(competition.maxTimeLimitMs) ||
      competition.maxTimeLimitMs < 1 ||
      !Number.isSafeInteger(competition.startingTime) ||
      competition.startingTime < 0
    )
      throw new Error(`${label} has invalid competition settings.`);
    const registrations = sqlite
      .query<Registration, [number]>(
        `SELECT id, discord_user_id AS discordUserId, account_version AS accountVersion,
                minecraft_uuid AS uuid, ign, elo, average_used AS averageUsed, movement,
                ${hasCurrentPercentage ? "current_percentage" : "NULL"} AS currentPercentage
         FROM registrations WHERE competition_id = ? ORDER BY id`
      )
      .all(competition.id);
    const matches = sqlite
      .query<Match, [number]>(
        `SELECT id, number AS matchNumber, time_limit_ms AS timeLimitMs,
                ranked_match_id AS rankedMatchId
         FROM matches WHERE competition_id = ? AND imported = 1 ORDER BY number`
      )
      .all(competition.id);
    const scores = new Map(
      registrations.map((registration) => [
        registration.id,
        { registration, points: 0, totalTimeMs: 0, played: false },
      ])
    );
    if (
      new Set(registrations.map((registration) => registration.uuid)).size !==
      registrations.length
    )
      throw new Error(`${label} has duplicate Minecraft accounts.`);
    const matchSnapshots = matches.map((match) => {
      if (!match.rankedMatchId?.trim())
        throw new Error(
          `${label}, match ${match.matchNumber} has no Ranked ID.`
        );
      if (!Number.isSafeInteger(match.matchNumber) || match.matchNumber < 1)
        throw new Error(`${label} has an invalid match number.`);
      // Convex uses the competition cap for misses and DNFs, not a per-match cap.
      if (match.timeLimitMs !== competition.maxTimeLimitMs)
        throw new Error(
          `${label} has differing match caps that Convex cannot represent.`
        );
      const results = sqlite
        .query<Result, [number]>(
          `SELECT registration_id AS registrationId, status, time_ms AS timeMs,
                  placement, points FROM match_results WHERE match_id = ?`
        )
        .all(match.id);
      if (
        results.length !== registrations.length ||
        new Set(results.map((result) => result.registrationId)).size !==
          registrations.length
      )
        throw new Error(
          `${label}, match ${match.matchNumber} has an incomplete roster.`
        );
      const publishedResults = [];
      for (const result of results) {
        const score = scores.get(result.registrationId);
        if (!score || !["finished", "dnf", "missed"].includes(result.status))
          throw new Error(
            `${label}, match ${match.matchNumber} has an invalid result.`
          );
        if (
          !Number.isFinite(result.points) ||
          result.points < 0 ||
          (result.status === "finished" &&
            (result.timeMs === null ||
              !Number.isSafeInteger(result.timeMs) ||
              result.timeMs < 0 ||
              result.timeMs > match.timeLimitMs ||
              result.placement === null ||
              !Number.isSafeInteger(result.placement) ||
              result.placement < 1)) ||
          (result.status !== "finished" &&
            (result.points !== 0 ||
              result.timeMs !== null ||
              result.placement !== null))
        )
          throw new Error(
            `${label}, match ${match.matchNumber} has invalid scoring data.`
          );
        score.points += result.points;
        score.totalTimeMs +=
          result.status === "finished" ? result.timeMs! : match.timeLimitMs;
        if (result.status === "missed") continue;
        score.played = true;
        publishedResults.push({
          uuid: score.registration.uuid,
          timeMs: result.timeMs,
          dnf: result.status === "dnf",
          placement: result.placement,
          pointsWon: result.points,
        });
      }
      return {
        leagueTier: competition.leagueTier,
        weekNumber,
        matchNumber: match.matchNumber,
        rankedMatchId: match.rankedMatchId,
        results: publishedResults,
      };
    });
    const participants = [...scores.values()]
      .filter((score) => score.played)
      .sort(
        (a, b) =>
          b.points - a.points ||
          a.totalTimeMs - b.totalTimeMs ||
          a.registration.ign.localeCompare(b.registration.ign)
      );
    const scoringCount = participants.filter(
      (score) => score.points > 0
    ).length;
    const percentages = new Map(
      participants.map((score, index) => [
        score.registration.id,
        competition.leagueTier === 7
          ? null
          : score.points > 0
            ? (100 * (scoringCount - index)) / scoringCount
            : 0,
      ])
    );
    const movements: Movements = registrations.map((registration) => {
      if (
        !registration.uuid.trim() ||
        !registration.ign.trim() ||
        (registration.elo !== null && !Number.isFinite(registration.elo)) ||
        !["none", "promote", "demote"].includes(registration.movement ?? "")
      )
        throw new Error(
          `${label} has an invalid saved registration or movement.`
        );
      const played = scores.get(registration.id)!.played;
      const currentPercentage = hasCurrentPercentage
        ? registration.currentPercentage
        : (percentages.get(registration.id) ?? null);
      if (
        [currentPercentage, registration.averageUsed].some(
          (percentage) =>
            percentage !== null &&
            (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
        ) ||
        (!played &&
          (currentPercentage !== null ||
            registration.averageUsed !== null ||
            registration.movement !== "none"))
      )
        throw new Error(
          `${label}, ${registration.ign} has invalid saved percentages.`
        );
      // Preserve the recorded rolling average and movement. Post-relegation player
      // history has already been reset or given 85%, so recalculating would be wrong.
      const movement: Movements[number] = {
        uuid: registration.uuid,
        movementStatus: websiteMovementStatus(registration.movement),
        currentPercentage,
        averagePercentage: registration.averageUsed,
      };
      return movement;
    });
    return { competition, registrations, matches: matchSnapshots, movements };
  });
  // Import the final account state last. Registration temporarily adopts the
  // historical competition league, and the saved bot state must win afterward.
  const savedPlayers = sqlite
    .query<
      {
        uuid: string;
        ign: string;
        leagueTier: number | null;
        status: string;
        history: string;
      },
      [string]
    >(
      `SELECT minecraft_uuid AS uuid, ign, league_number AS leagueTier, status,
              placements AS history FROM players WHERE guild_id = ? ORDER BY id`
    )
    .all(competitions[0]!.guildId);
  const players = savedPlayers
    .filter((player) => player.status === "active")
    .map((player) => {
      const history = JSON.parse(player.history) as RetainedPercentage[];
      if (
        !player.uuid.trim() ||
        !player.ign.trim() ||
        player.leagueTier === null ||
        !Number.isSafeInteger(player.leagueTier) ||
        player.leagueTier < 1 ||
        !Array.isArray(history) ||
        history.length > 3 ||
        history.some(
          (entry) =>
            !Number.isSafeInteger(entry.week) ||
            entry.week < 1 ||
            !Number.isSafeInteger(entry.league) ||
            entry.league < 1 ||
            !Number.isFinite(entry.percentage) ||
            entry.percentage < 0 ||
            entry.percentage > 100
        )
      )
        throw new Error(`Invalid saved player state for ${player.ign}.`);
      return {
        uuid: player.uuid,
        ign: player.ign,
        leagueTier: player.leagueTier,
        percentageHistory: history,
      };
    });
  if (new Set(players.map((player) => player.uuid)).size !== players.length)
    throw new Error("Duplicate saved player Minecraft accounts.");
  return {
    competitions: competitionPlans,
    players,
    skippedPlayers: savedPlayers.length - players.length,
  };
}

export function developmentUrl(
  deployment: string | undefined,
  configuredUrl: string
) {
  const match = /^dev:([a-z0-9-]+)$/.exec(deployment ?? "");
  if (!match)
    throw new Error("backend/.env.local must select a dev: Convex deployment.");
  const expectedUrl = `https://${match[1]}.convex.cloud`;
  if (configuredUrl.replace(/\/$/, "") !== expectedUrl)
    throw new Error(
      "DEV_CONVEX_URL does not match the backend's development deployment."
    );
  return expectedUrl;
}

export async function publishReplayPlan(
  client: Pick<ConvexHttpClient, "mutation" | "query">,
  writerKey: string,
  plan: ReturnType<typeof buildReplayPlan>,
  log: (message: string) => void = console.info
) {
  const weekNumber = plan.competitions[0]!.competition.weekNumber;
  const weeks = await client.query(api.weekView.getAllWeeks, {});
  if (weeks.some((week) => week.weekNumber === weekNumber))
    throw new Error(
      `Week ${weekNumber} already exists. Replay requires an absent target week; no writes were made.`
    );

  for (const {
    competition,
    registrations,
    matches,
    movements,
  } of plan.competitions) {
    const { leagueTier, maxTimeLimitMs, startingTime } = competition;
    log(`Publishing League ${leagueTier}, week ${weekNumber}...`);
    await client.mutation(api.writes.competitions.createCompetition, {
      writerKey,
      leagueTier,
      weekNumber,
      maxTimeLimitMs,
      startingTime,
    });
    for (const registration of registrations) {
      await client.mutation(api.writes.players.registerPlayer, {
        writerKey,
        leagueTier,
        weekNumber,
        uuid: registration.uuid,
        ign: registration.ign,
        ...(registration.elo === null ? {} : { elo: registration.elo }),
      });
    }
    for (const match of matches)
      await client.mutation(api.writes.matches.importMatchData, {
        writerKey,
        ...match,
      });
    await client.mutation(api.writes.competitions.endCompetition, {
      writerKey,
      leagueTier,
      weekNumber,
      movements,
    });
  }
  // Finalize only after every league's roster and results have been published.
  for (const { competition, movements } of plan.competitions) {
    await client.mutation(api.writes.competitions.processMovements, {
      writerKey,
      leagueTier: competition.leagueTier,
      weekNumber,
      movements,
    });
  }
  log(`Importing ${plan.players.length} saved players...`);
  for (const player of plan.players) {
    await client.mutation(api.writes.players.upsertPlayer, {
      writerKey,
      ...player,
    });
  }
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      database: { type: "string" },
      week: { type: "string", default: "26" },
      guild: { type: "string" },
      apply: { type: "boolean", default: false },
      prod: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (values.help) {
    console.info(
      "bun --cwd apps/bot scripts/replay-week.ts --database /path/to/bot.sqlite [--week 26] [--guild ID] [--prod] [--apply]"
    );
    return;
  }
  if (!values.database)
    throw new Error("--database must point to a SQLite backup.");
  const weekNumber = Number(values.week);
  if (!Number.isSafeInteger(weekNumber) || weekNumber < 1)
    throw new Error("--week must be a positive integer.");
  const sqlite = new Database(values.database, {
    readonly: true,
    strict: true,
  });
  let plan;
  try {
    plan = sqlite.transaction(() =>
      buildReplayPlan(sqlite, weekNumber, values.guild)
    )();
  } finally {
    sqlite.close();
  }
  for (const {
    competition,
    registrations,
    matches,
    movements,
  } of plan.competitions) {
    console.info(
      `League ${competition.leagueTier}: ${registrations.length} registrations, ${matches.length} matches, ${movements.filter((movement) => movement.movementStatus === "promoted").length} promoted, ${movements.filter((movement) => movement.movementStatus === "demoted").length} demoted.`
    );
  }
  console.info(
    `Source guild ${plan.competitions[0]!.competition.guildId}. Import ${plan.players.length} active players; skip ${plan.skippedPlayers} pending or rejected players.`
  );
  const target = values.prod ? "production" : "development";
  if (!values.apply) {
    console.info(`Dry run complete. Add --apply to write to ${target} Convex.`);
    return;
  }
  const prefix = values.prod ? "PROD" : "DEV";
  let url = requiredEnv(`${prefix}_CONVEX_URL`);
  if (!values.prod) {
    const backendEnv = parseEnv(
      readFileSync(
        new URL("../../../backend/.env.local", import.meta.url),
        "utf8"
      )
    );
    url = developmentUrl(backendEnv.CONVEX_DEPLOYMENT, url);
  }
  const writerKey = requiredEnv(`${prefix}_CONVEX_WRITER_KEY`);
  const client = new ConvexHttpClient(url, {
    fetch: ((input, init) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.timeout(60_000),
      })) as typeof fetch,
  });
  console.info(`Writing to ${target} Convex: ${url}`);
  try {
    await publishReplayPlan(client, writerKey, plan);
  } catch (error) {
    const message = (
      error instanceof Error ? error.message : String(error)
    ).replaceAll(writerKey, "[REDACTED]");
    throw new Error(
      `${message}\nReplay stopped. Earlier mutations may have committed. There is no automatic retry or cleanup.`
    );
  }
  console.info(`Week ${weekNumber} replay complete.`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
