import { useState, type SubmitEvent } from "react";
import { DISCORD_URL } from "@/consts";
import {
  cleanTimeDigits,
  estimateLeague,
  formatTime,
  formatTimeDigits,
  headUrl,
  LEAGUES,
  lookUpRanked,
  parseTimeDigits,
  STEVE_HEAD,
  timeToDigits,
  typicalRange,
  type Stats,
} from "@/lib/leagueFinder";

type Values = Record<keyof Stats, string>;
const EMPTY: Values = { elo: "", average: "", best: "" };

const FIELDS = [
  {
    key: "elo",
    label: "Elo",
    note: "Your Ranked rating",
    placeholder: "1300",
    hint: "Use a number",
  },
  {
    key: "average",
    label: "Average",
    note: "Your usual finish",
    placeholder: "MM:SS",
    hint: "Try 15:30",
  },
  {
    key: "best",
    label: "Best time",
    note: "Your fastest finish",
    placeholder: "MM:SS",
    hint: "Try 12:45",
  },
] as const;

function parseElo(text: string) {
  const elo = /^\d{1,4}$/.test(text.trim()) ? Number(text) : null;
  return elo !== null && elo > 0 ? elo : null;
}

function parseValues(values: Values): Stats {
  return {
    elo: parseElo(values.elo),
    average: parseTimeDigits(values.average),
    best: parseTimeDigits(values.best),
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type Lookup =
  | { status: "idle" | "loading" | "not-found" | "failed" }
  | { status: "found"; uuid: string };

export function LeagueFinder() {
  const [name, setName] = useState("");
  const [values, setValues] = useState(EMPTY);
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });

  const stats = parseValues(values);
  const statCount = Object.values(stats).filter((stat) => stat !== null).length;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || lookup.status === "loading") return;

    setLookup({ status: "loading" });
    const result = await lookUpRanked(trimmed);
    if (result.status !== "found") {
      setLookup(result);
      return;
    }

    // The numbers land one at a time, each pushing the arrow further along.
    setValues(EMPTY);
    setLookup({ status: "found", uuid: result.uuid });
    for (const { key } of FIELDS) {
      await wait(240);
      const stat = result[key];
      const text =
        stat === null ? "" : key === "elo" ? String(stat) : timeToDigits(stat);
      setValues((current) => ({ ...current, [key]: text }));
    }
  }

  return (
    <div>
      <h2 className="mb-4 font-minecraft text-3xl leading-none font-bold md:text-4xl">
        Find your league
      </h2>

      {/* Both panels stretch to the taller one, so their edges line up. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] lg:gap-6">
        <div className="flex flex-col border-[3px] border-obsidian-line bg-obsidian-deep/50 p-5">
          <form
            onSubmit={(event) => void submit(event)}
            className="flex items-end gap-2"
          >
            <label className="min-w-0 flex-1 font-semibold">
              MCSR Ranked name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                autoComplete="off"
                spellCheck={false}
                className="stat-slot mt-1 block h-12 w-full px-3 font-minecraft text-lg outline-none placeholder:text-home-muted/60"
              />
            </label>
            <button
              type="submit"
              className="h-12 shrink-0 cursor-pointer bg-lava px-5 font-minecraft text-lg font-bold text-lava-ink transition-colors hover:bg-lava-hover"
            >
              {lookup.status === "loading" ? "Looking..." : "Look up"}
            </button>
          </form>

          <LookupDivider lookup={lookup} />

          <div className="flex flex-1 flex-col">
            {FIELDS.map((field) => (
              <StatField
                key={field.key}
                label={field.label}
                note={field.note}
                placeholder={field.placeholder}
                hint={field.hint}
                isTime={field.key !== "elo"}
                value={values[field.key]}
                isValid={stats[field.key] !== null}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.key]: value }))
                }
              />
            ))}
          </div>
        </div>

        <ProgressArrow progress={statCount / FIELDS.length} />

        <ResultPanel
          stats={stats}
          statCount={statCount}
          playerUuid={lookup.status === "found" ? lookup.uuid : null}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-obsidian-line pt-3">
        <p className="mr-auto text-sm text-home-muted">
          *An estimate from existing players. A reviewer makes the final call.
        </p>
        <a
          href="/info"
          className="font-semibold text-home-gold underline underline-offset-4"
        >
          Read the rules
        </a>
        <a
          href="/rules/timeslots"
          className="font-semibold text-home-gold underline underline-offset-4"
        >
          See competition times
        </a>
      </div>
    </div>
  );
}

// Doubles as the lookup's status, so a message doesn't move anything around it.
function LookupDivider({ lookup }: { lookup: Lookup }) {
  const message = {
    idle: "or type your numbers",
    loading: "Checking MCSR Ranked...",
    found: "Filled in from MCSR Ranked.",
    "not-found": "No Ranked player with that name. Type your numbers.",
    failed: "MCSR Ranked isn't responding. Type your numbers.",
  }[lookup.status];
  const isProblem = lookup.status === "not-found" || lookup.status === "failed";

  return (
    <p
      aria-live="polite"
      className={`my-3 flex items-center gap-3 text-center text-sm ${
        isProblem ? "text-lava-hover" : "text-home-muted"
      }`}
    >
      <span className="h-px flex-1 bg-obsidian-line" />
      {message}
      <span className="h-px flex-1 bg-obsidian-line" />
    </p>
  );
}

function StatField({
  label,
  note,
  placeholder,
  hint,
  isTime,
  value,
  isValid,
  onChange,
}: {
  label: string;
  note: string;
  placeholder: string;
  hint: string;
  isTime: boolean;
  value: string;
  isValid: boolean;
  onChange: (value: string) => void;
}) {
  // Waits until they leave the field, so half-typed numbers don't show an error.
  const [hasLeft, setHasLeft] = useState(false);
  const showHint = hasLeft && value.trim() !== "" && !isValid;

  return (
    <label className="flex flex-1 items-center gap-4 border-t border-obsidian-line py-2 font-semibold first:border-t-0">
      <span className="min-w-0 flex-1">
        {label}
        <span
          className={`block text-sm font-normal ${
            showHint ? "text-lava-hover" : "text-home-muted"
          }`}
        >
          {showHint ? hint : note}
        </span>
      </span>
      <input
        value={isTime ? formatTimeDigits(value) : value}
        onChange={(event) =>
          onChange(
            isTime ? cleanTimeDigits(event.target.value) : event.target.value
          )
        }
        onFocus={() => setHasLeft(false)}
        onBlur={() => setHasLeft(true)}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={showHint}
        className="stat-slot h-12 w-32 shrink-0 px-2 text-center font-minecraft text-xl text-home-gold outline-none placeholder:text-home-muted/40 sm:w-40"
      />
    </label>
  );
}

// Like a furnace's progress arrow, where each number fills it further.
function ProgressArrow({ progress }: { progress: number }) {
  const columns = 24;
  return (
    <svg
      viewBox={`0 0 ${columns} 16`}
      aria-hidden
      className="mx-auto w-12 rotate-90 self-center lg:w-full lg:rotate-0"
    >
      {Array.from({ length: columns }, (_, column) => {
        const height = column < 15 ? 6 : 16 - (column - 15) * 2;
        return (
          <rect
            key={column}
            x={column}
            y={(16 - height) / 2}
            width={1.02}
            height={height}
            className={`transition-[fill] duration-100 ${
              column / columns < progress ? "fill-lava" : "fill-obsidian-line"
            }`}
            style={{ transitionDelay: `${column * 12}ms` }}
          />
        );
      })}
    </svg>
  );
}

function ResultPanel({
  stats,
  statCount,
  playerUuid,
}: {
  stats: Stats;
  statCount: number;
  playerUuid: string | null;
}) {
  const hasStats = statCount > 0;
  const { league, shares } = hasStats
    ? estimateLeague(stats)
    : { league: null, shares: [] };
  const runnerUp = shares[1];

  // Every part keeps its place before any numbers are in, so the page holds
  // still when the result arrives.
  return (
    <section aria-live="polite" className="league-tooltip flex flex-col p-5">
      <div className="flex items-center gap-5">
        <span className="stat-slot flex size-20 shrink-0 items-center justify-center">
          <img
            src={playerUuid ? headUrl(playerUuid) : STEVE_HEAD}
            alt=""
            width={56}
            height={56}
            className="size-14 [image-rendering:pixelated]"
          />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-home-muted">You fit best in*</p>
          <p
            key={league}
            className={`font-minecraft text-4xl leading-none font-bold whitespace-nowrap xl:text-5xl ${
              hasStats
                ? "animate-league-pop text-home-gold"
                : "text-home-muted/50"
            }`}
          >
            League {league ?? "?"}
          </p>
        </div>
      </div>

      <LeagueStrip shares={shares} league={league} />
      <p className="mt-2 min-h-10 text-sm text-home-muted xl:min-h-5">
        {hasStats
          ? `Players like you mostly race in League ${league}.`
          : "One number is enough. All three give a better estimate."}
        {runnerUp && runnerUp.share >= 0.2
          ? ` Some are in League ${runnerUp.league}.`
          : ""}
      </p>

      <table className="my-2 w-full border-t border-obsidian-line text-left text-sm">
        <thead className="text-home-muted">
          <tr>
            <th className="py-1 font-normal">
              <span className="sr-only">Stat</span>
            </th>
            <th className="py-1 font-normal">
              <span className="sr-only">You compared</span>
            </th>
            <th className="py-1 text-right font-normal">
              Most of League {league ?? "?"}
            </th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(({ key, label }) => (
            <CompareRow
              key={key}
              stat={key}
              label={label}
              value={stats[key]}
              league={league}
            />
          ))}
        </tbody>
      </table>

      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto block bg-lava px-6 py-2.5 text-center font-minecraft text-lg font-bold text-lava-ink transition-colors hover:bg-lava-hover"
      >
        Join on Discord
      </a>
    </section>
  );
}

function LeagueStrip({
  shares,
  league,
}: {
  shares: { league: number; share: number }[];
  league: number | null;
}) {
  return (
    <div className="mt-3">
      <ol className="grid grid-cols-7 gap-1 font-minecraft text-sm">
        {LEAGUES.map((tier) => {
          const isMatch = tier === league;
          const isClose = shares.some(
            (entry) => entry.league === tier && entry.share >= 0.2
          );
          return (
            <li
              key={tier}
              aria-current={isMatch ? "true" : undefined}
              className={`py-1 text-center transition-colors duration-200 ${
                isMatch
                  ? "bg-lava font-bold text-lava-ink"
                  : isClose
                    ? "bg-lava/25 text-home-text"
                    : "bg-obsidian-raised text-home-muted"
              }`}
            >
              {tier}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 flex justify-between text-xs text-home-muted">
        <span>Fastest</span>
        <span>Slowest</span>
      </p>
    </div>
  );
}

function CompareRow({
  stat,
  label,
  value,
  league,
}: {
  stat: keyof Stats;
  label: string;
  value: number | null;
  league: number | null;
}) {
  const range = league === null ? null : typicalRange(league, stat);
  const show = (number: number) =>
    stat === "elo" ? String(number) : formatTime(number);

  let verdict = "";
  if (value !== null && range) {
    if (value < range.low) verdict = stat === "elo" ? "Lower" : "Faster";
    else if (value > range.high) verdict = stat === "elo" ? "Higher" : "Slower";
    else verdict = "In range";
  }

  return (
    <tr className="border-t border-obsidian-line/50">
      <td className="py-1 font-semibold">{label}</td>
      <td
        className={`py-1 whitespace-nowrap ${
          verdict === "In range" ? "text-[#7ee07e]" : "text-home-muted"
        }`}
      >
        {verdict}
      </td>
      <td className="py-1 text-right whitespace-nowrap text-home-muted tabular-nums">
        {range ? `${show(range.low)} to ${show(range.high)}` : "-"}
      </td>
    </tr>
  );
}
