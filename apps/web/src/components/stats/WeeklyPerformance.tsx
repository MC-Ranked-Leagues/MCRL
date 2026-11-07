import { ChevronDown } from "lucide-react";
import { formatPercentage, formatRunTime, ordinal } from "@/lib/format";
import { movementLabel } from "@/lib/movement";
import { cn } from "@/lib/utils";
import { getWeekHref } from "@/lib/weekRoutes";
import type { Run, WeeklyPerformance as WeekData } from "./stats-utils";

// The header and every row share these columns. Older weeks and League 7 have
// no percentages, so their columns only show when some week has them. On
// phones they move under the week.
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_5rem_1rem] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_3.5rem_6rem_1.25rem] sm:gap-x-3";
const PERCENTAGE_COLUMNS =
  "sm:grid-cols-[minmax(0,1fr)_3.5rem_5.5rem_6.5rem_6rem_1.25rem]";

const MOVE_TINTS = {
  promoted: "bg-promoted-tint",
  demoted: "bg-demoted-tint",
  none: "",
} as const;

const MOVE_TEXT = {
  promoted: "text-promoted",
  demoted: "text-demoted",
  none: "text-muted",
} as const;

export function WeeklyPerformance({ weeks }: { weeks: WeekData[] }) {
  const showsPercentages = weeks.some(hasPercentages);
  const columns = cn(COLUMNS, showsPercentages && PERCENTAGE_COLUMNS);

  return (
    <section aria-labelledby="weeks-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="weeks-heading"
          className="text-3xl leading-none font-bold md:text-4xl"
        >
          Weeks
        </h2>
        {weeks.length > 0 && (
          <span className="text-muted">
            {weeks.length} {weeks.length === 1 ? "week" : "weeks"} played
          </span>
        )}
      </div>

      {weeks.length === 0 ? (
        <p className="mt-4 text-muted">No weeks played yet.</p>
      ) : (
        <>
          <div
            aria-hidden
            className={cn(
              columns,
              "mt-2 border-b-3 border-obsidian-line px-2 py-2 text-sm whitespace-nowrap text-muted"
            )}
          >
            <span>Week</span>
            <span className="text-right">Points</span>
            {showsPercentages && (
              <>
                <span className="text-right max-sm:hidden">Week %</span>
                <span className="text-right max-sm:hidden">3-wk avg %</span>
              </>
            )}
            <span className="text-right">Avg time</span>
          </div>
          {/* Newest first. */}
          {weeks.toReversed().map((week) => (
            <WeekRow
              key={week.weekNumber}
              week={week}
              columns={columns}
              showsPercentages={showsPercentages}
            />
          ))}
        </>
      )}
    </section>
  );
}

function hasPercentages(week: WeekData) {
  return week.currentPercentage !== null || week.averagePercentage !== null;
}

function WeekRow({
  week,
  columns,
  showsPercentages,
}: {
  week: WeekData;
  columns: string;
  showsPercentages: boolean;
}) {
  return (
    <details className="group border-b border-obsidian-line/60">
      <summary
        className={cn(
          columns,
          "min-h-14 cursor-pointer list-none px-2 py-2 transition-colors group-open:bg-obsidian-raised group-open:shadow-[inset_3px_0_0_var(--color-lava)] hover:bg-obsidian-raised [&::-webkit-details-marker]:hidden",
          MOVE_TINTS[week.movement]
        )}
      >
        <span className="min-w-0 leading-tight">
          <span className="block font-semibold">Week {week.weekNumber}</span>
          <span className="block text-sm text-muted">
            League {week.leagueNumber} ·{" "}
            <span className={MOVE_TEXT[week.movement]}>
              {movementLabel(week.movement)}
            </span>
          </span>
          {hasPercentages(week) && (
            <span className="block font-minecraft text-xs text-muted tabular-nums sm:hidden">
              Week {formatPercentage(week.currentPercentage)} · Avg{" "}
              {formatPercentage(week.averagePercentage)}
            </span>
          )}
        </span>
        <span className="text-right font-minecraft text-lg font-bold tabular-nums">
          {week.totalPoints}
          <span className="sr-only"> points,</span>
        </span>
        {showsPercentages && (
          <>
            <span className="text-right font-minecraft text-muted tabular-nums max-sm:hidden">
              <span className="sr-only">Week percentage </span>
              {formatPercentage(week.currentPercentage)}
            </span>
            <span className="text-right font-minecraft tabular-nums max-sm:hidden">
              <span className="sr-only">, 3-week average </span>
              {formatPercentage(week.averagePercentage)}
            </span>
          </>
        )}
        <span className="text-right font-minecraft tabular-nums">
          <span className="sr-only">, average time </span>
          {formatRunTime(week.averageTimeMs)}
        </span>
        <ChevronDown
          aria-hidden
          className="size-5 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>

      <div className="bg-obsidian-deep px-2 pt-1 pb-3">
        {week.matchDetails.length === 0 ? (
          <p className="py-2 text-muted">No matches recorded.</p>
        ) : (
          <ol>
            {week.matchDetails.map((run) => (
              <RunRow key={run.matchId} run={run} />
            ))}
          </ol>
        )}
        <a
          href={getWeekHref(week.weekNumber, week.leagueNumber)}
          className="mt-3 inline-block font-semibold text-gold underline underline-offset-4"
        >
          Week {week.weekNumber} standings
        </a>
      </div>
    </details>
  );
}

function RunRow({ run }: { run: Run }) {
  const timeMs = run.missed || run.dnf ? null : run.timeMs;

  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto_3rem] items-center gap-x-3 border-b border-obsidian-line/60 px-1 py-2">
      <span
        className={cn(
          "font-minecraft text-xl leading-none font-bold",
          run.placement === 1 && "text-gold",
          run.dnf && "text-lava-hover",
          run.missed && "text-base text-muted"
        )}
      >
        {run.missed
          ? "Missed"
          : run.dnf || run.placement === null
            ? "DNF"
            : ordinal(run.placement)}
      </span>
      <span className="font-semibold">Match {run.matchNumber}</span>
      <span className="font-minecraft text-sm text-muted tabular-nums">
        {/* Shows a dash for DNFs and missed matches, like other empty values. */}
        {formatRunTime(timeMs)}
      </span>
      <span
        className={cn(
          "text-right font-minecraft text-lg leading-none font-bold tabular-nums",
          run.pointsWon === 0 && "text-muted"
        )}
      >
        +{run.pointsWon}
      </span>
    </li>
  );
}
