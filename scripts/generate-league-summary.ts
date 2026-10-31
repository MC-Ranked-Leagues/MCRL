// Rebuilds the numbers behind the home page's "Find your league" section from a
// Convex snapshot, using players who raced in the most recent weeks.
//
//   bun run league-summary backups/after_w30.zip
//   bun run league-summary backups/after_w30.zip --weeks 15
import { strFromU8, unzipSync, type Unzipped } from "fflate";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const OUTPUT = resolve(
  import.meta.dirname,
  "../apps/web/src/data/league-summary.json"
);

type Player = {
  _id: string;
  currentLeagueNumber: number;
  elo?: number | null;
  fastestTimeMs?: number | null;
};

type MatchResult = {
  playerId: string;
  weekNumber: number;
  missed?: boolean;
  dnf: boolean;
  timeMs: number | null;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readSnapshot(path: string) {
  try {
    return unzipSync(readFileSync(path));
  } catch {
    return fail(`Couldn't read ${path} as a zip file.`);
  }
}

function readTable<T>(files: Unzipped, table: string) {
  const file = files[`${table}/documents.jsonl`];
  if (!file) return fail(`The snapshot has no ${table} table.`);
  return strFromU8(file)
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

// The middle half of a league's players for one stat.
function typicalRange(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const at = (share: number) => sorted[Math.floor(sorted.length * share)];
  const [low, median, high] = [at(0.25), at(0.5), at(0.75)];
  return low === undefined || median === undefined || high === undefined
    ? null
    : { low, median, high };
}

function onlyNumbers(values: (number | undefined)[]) {
  return values.filter((value) => value !== undefined);
}

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { weeks: { type: "string", default: "10" } },
});

const snapshot = positionals[0];
const weeks = Number(options.weeks);
if (!snapshot || !Number.isInteger(weeks) || weeks < 1) {
  fail("Usage: bun run league-summary <snapshot.zip> [--weeks <whole number>]");
}

const files = readSnapshot(snapshot);
const played = readTable<MatchResult>(files, "matchResults").filter(
  (result) => !result.missed
);
const toWeek = Math.max(...played.map((result) => result.weekNumber));
const fromWeek = Math.max(1, toWeek - weeks + 1);

const recentPlayers = new Set<string>();
const finishTimes = new Map<string, number[]>();
for (const result of played) {
  if (result.weekNumber < fromWeek) continue;
  recentPlayers.add(result.playerId);
  if (result.timeMs !== null && !result.dnf) {
    const times = finishTimes.get(result.playerId) ?? [];
    times.push(result.timeMs);
    finishTimes.set(result.playerId, times);
  }
}

const players = readTable<Player>(files, "players")
  .filter((player) => recentPlayers.has(player._id))
  .map((player) => {
    const times = finishTimes.get(player._id);
    return {
      league: player.currentLeagueNumber,
      elo: player.elo ? Math.round(player.elo) : undefined,
      best: player.fastestTimeMs
        ? Math.round(player.fastestTimeMs / 1000)
        : undefined,
      average: times
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000)
        : undefined,
    };
  });

const leagues = [...new Set(players.map((player) => player.league))]
  .toSorted((a, b) => a - b)
  .map((league) => {
    const members = players.filter((player) => player.league === league);
    return {
      league,
      players: members.length,
      elo: typicalRange(onlyNumbers(members.map((player) => player.elo))),
      average: typicalRange(
        onlyNumbers(members.map((player) => player.average))
      ),
      best: typicalRange(onlyNumbers(members.map((player) => player.best))),
    };
  });

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  `${JSON.stringify({ source: basename(snapshot), fromWeek, toWeek, leagues }, null, 2)}\n`
);

console.log(
  `Wrote ${OUTPUT} from ${players.length} players in weeks ${fromWeek} to ${toWeek}.`
);
console.table(
  leagues.map(({ league, players, elo, average, best }) => ({
    league,
    players,
    "median Elo": elo?.median,
    "median average (s)": average?.median,
    "median best (s)": best?.median,
  }))
);
