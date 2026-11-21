// Rebuilds the numbers behind the home page's "Find your league" section. Takes
// the players who raced in a snapshot's most recent weeks, fetches the Ranked
// stats of a sample from each league, and summarizes those. Visitors are
// compared using their Ranked stats, so the leagues are described the same way.
//
//   bun run league-summary backups/after_w30.zip
//   bun run league-summary backups/after_w30.zip --weeks 15 --per-league 50
//
// Fetched stats are saved to scripts/data/ and reused on the next run for the
// same snapshot. Delete that file to fetch again.
import { strFromU8, unzipSync, type Unzipped } from "fflate";
import { RankedClient, RankedError } from "mcsrranked-sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  estimateLeague,
  rankedStats,
  type LeagueSummary,
  type Stats,
} from "../apps/web/src/lib/leagueEstimate";

const OUTPUT = resolve(
  import.meta.dirname,
  "../apps/web/src/data/league-summary.json"
);
const RAW_DIR = resolve(import.meta.dirname, "data");

// Ranked allows 500 requests per 10 minutes. Pacing every request keeps any
// run under that, even right after another one.
const REQUEST_GAP_MS = 1250;
const RATE_LIMIT_WAIT_MS = 60_000;

// Some profiles leave out fields the SDK expects in past season phases, which
// this script never reads, so those warnings are only noise.
const ranked = new RankedClient({ validation: "ignore" });

// Below this many finishes, a Ranked average is mostly luck.
const MIN_COMPLETIONS = 5;

type Player = {
  _id: string;
  uuid: string;
  currentLeagueNumber: number;
};

type MatchResult = {
  playerId: string;
  weekNumber: number;
  missed?: boolean;
};

type Sampled = Stats & { uuid: string; league: number };

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

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

// Missing Ranked accounts come back as null so the player is skipped.
async function fetchStats(player: Player): Promise<Sampled | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      const stats = rankedStats(await ranked.users.get(player.uuid));
      return {
        uuid: player.uuid,
        league: player.currentLeagueNumber,
        elo: stats.elo,
        average: stats.completions >= MIN_COMPLETIONS ? stats.average : null,
        best: stats.best,
      };
    } catch (error) {
      if (!(error instanceof RankedError)) throw error;
      if (error.status === 400 || error.status === 404) return null;
      if (attempt === 3) throw error;
      console.warn(`Ranked said ${error.message}, waiting a minute.`);
      await wait(RATE_LIMIT_WAIT_MS);
    }
  }
}

async function fetchSample(players: Player[]) {
  const sampled: Sampled[] = [];
  for (const [i, player] of players.entries()) {
    if (i > 0) await wait(REQUEST_GAP_MS);
    const stats = await fetchStats(player);
    if (stats) sampled.push(stats);
    process.stdout.write(`\rFetched ${i + 1} of ${players.length}`);
  }
  process.stdout.write("\n");
  return sampled;
}

// The middle half of a league's players for one stat.
function typicalRange(values: (number | null)[]) {
  const sorted = values
    .filter((value) => value !== null)
    .toSorted((a, b) => a - b);
  const at = (share: number) => sorted[Math.floor(sorted.length * share)];
  const [low, median, high] = [at(0.25), at(0.5), at(0.75)];
  return low === undefined || median === undefined || high === undefined
    ? null
    : { low, median, high };
}

function summarize(sampled: Sampled[]): LeagueSummary[] {
  return [...new Set(sampled.map((player) => player.league))]
    .toSorted((a, b) => a - b)
    .map((league) => {
      const members = sampled.filter((player) => player.league === league);
      return {
        league,
        players: members.length,
        elo: typicalRange(members.map((player) => player.elo)),
        average: typicalRange(members.map((player) => player.average)),
        best: typicalRange(members.map((player) => player.best)),
      };
    });
}

// Builds the ranges from half the players and estimates the other half, both
// ways round, so nobody is scored against ranges they helped build.
function checkAccuracy(sampled: Sampled[]) {
  const halves = [0, 1].map((half) => sampled.filter((_, i) => i % 2 === half));
  let exact = 0;
  let withinOne = 0;
  let checked = 0;
  halves.forEach((tested, i) => {
    const leagues = summarize(halves[1 - i] ?? []);
    for (const player of tested) {
      if (player.elo === null && player.average === null) continue;
      const { league } = estimateLeague(leagues, player);
      checked++;
      if (league === player.league) exact++;
      if (Math.abs(league - player.league) <= 1) withinOne++;
    }
  });
  const percent = (count: number) => Math.round((count / checked) * 100);
  console.log(
    `Estimate on unseen players: exact league ${percent(exact)}%, within one ${percent(withinOne)}% (${checked} players).`
  );
}

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    weeks: { type: "string", default: "10" },
    "per-league": { type: "string", default: "65" },
  },
});

const snapshot = positionals[0];
const weeks = Number(options.weeks);
const perLeague = Number(options["per-league"]);
if (
  !snapshot ||
  !Number.isInteger(weeks) ||
  weeks < 1 ||
  !Number.isInteger(perLeague) ||
  perLeague < 1
) {
  fail(
    "Usage: bun run league-summary <snapshot.zip> [--weeks <whole number>] [--per-league <whole number>]"
  );
}

const files = readSnapshot(snapshot);
const played = readTable<MatchResult>(files, "matchResults").filter(
  (result) => !result.missed
);
const toWeek = Math.max(...played.map((result) => result.weekNumber));
const fromWeek = Math.max(1, toWeek - weeks + 1);
const recentPlayers = new Set(
  played
    .filter((result) => result.weekNumber >= fromWeek)
    .map((result) => result.playerId)
);

const rawPath = resolve(RAW_DIR, `ranked-${basename(snapshot, ".zip")}.json`);
let sampled: Sampled[];
if (existsSync(rawPath)) {
  console.log(`Reusing Ranked stats from ${rawPath}.`);
  sampled = JSON.parse(readFileSync(rawPath, "utf8")) as Sampled[];
} else {
  const players = readTable<Player>(files, "players").filter((player) =>
    recentPlayers.has(player._id)
  );
  const leagues = new Set(players.map((player) => player.currentLeagueNumber));
  const chosen = [...leagues].flatMap((league) =>
    shuffled(
      players.filter((player) => player.currentLeagueNumber === league)
    ).slice(0, perLeague)
  );
  sampled = await fetchSample(chosen);
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(rawPath, `${JSON.stringify(sampled, null, 2)}\n`);
}

const leagues = summarize(sampled);
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  `${JSON.stringify({ source: basename(snapshot), fromWeek, toWeek, leagues }, null, 2)}\n`
);

console.log(
  `Wrote ${OUTPUT} from ${sampled.length} players in weeks ${fromWeek} to ${toWeek}.`
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
checkAccuracy(sampled);
