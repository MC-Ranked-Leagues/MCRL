import { ArrowDownIcon, ArrowUpIcon, CrownIcon } from "lucide-react";
import { useState } from "react";
import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercentage } from "@/lib/format";
import {
  MOVE_TINTS,
  movementLabel,
  sortByAverage,
  visibleMovement,
} from "@/lib/movement";
import { cn } from "@/lib/utils";
import type { WeekStanding } from "./weekData";

// Every row keeps its height and every column its width, so sorting, selecting
// a player, or moving to a week with fewer columns never shifts what's on screen.
export function StandingsTable({
  standings,
  leagueTier,
  isLive,
  selectedPlayerId,
  onPlayer,
}: {
  standings: WeekStanding[] | undefined;
  leagueTier: number | null;
  isLive: boolean;
  selectedPlayerId: string | null;
  onPlayer: (playerId: string) => void;
}) {
  const [chosenSort, setChosenSort] = useState<"points" | "average" | null>(
    null
  );
  if (!standings || leagueTier === null) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <div className="mt-2 flex flex-col gap-1">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <p className="text-muted">
        No results for League {leagueTier} this week.
      </p>
    );
  }

  // Older weeks and League 7 have no percentages, and the oldest weeks have no
  // recorded moves either.
  const hasAverages = standings.some(
    (standing) => standing.averagePercentage !== null
  );
  // Finished weeks open sorted by average.
  const sort = !hasAverages
    ? "points"
    : (chosenSort ?? (isLive ? "points" : "average"));
  const rows = sortRows(standings, sort);
  const headerCell = "px-2 py-2 font-normal whitespace-nowrap text-muted";
  const renderRow = (standing: WeekStanding, index: number) => (
    <StandingRow
      key={standing.playerId}
      // Numbers the rows in their shown order, whichever sort is active.
      number={standing.rank === null ? null : index + 1}
      standing={standing}
      isLive={isLive}
      hasAverages={hasAverages}
      isSelected={selectedPlayerId === standing.playerId}
      onPlayer={onPlayer}
    />
  );
  // Players who didn't play get their own table below, under a caption.
  const played = rows.filter((standing) => standing.rank !== null);
  const missed = rows.filter((standing) => standing.rank === null);

  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 className="text-pixel-md md:text-pixel-lg">League {leagueTier}</h2>
        {hasAverages && (
          <div
            role="group"
            aria-label="Sort table"
            className="flex shrink-0 items-center gap-1 text-sm"
          >
            <span className="mr-1 text-muted max-sm:hidden">Sort by</span>
            {(
              [
                ["points", "Points"],
                ["average", "3-week average"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sort === value}
                onClick={() => setChosenSort(value)}
                className={cn(
                  "cursor-pointer border-2 px-2.5 py-0.5 font-minecraft transition-colors",
                  sort === value
                    ? "border-primary bg-primary font-bold text-primary-foreground"
                    : "border-border text-muted hover:border-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <table className="mt-2 w-full table-fixed border-collapse text-left">
        <thead className="border-b-2 border-border text-sm">
          <tr>
            <th
              scope="col"
              className={cn(headerCell, COLUMN_WIDTHS.place, "text-right")}
            >
              <span className="sm:hidden">#</span>
              <span className="max-sm:hidden">Place</span>
            </th>
            <th scope="col" className={headerCell}>
              Player
            </th>
            <th
              scope="col"
              className={cn(headerCell, COLUMN_WIDTHS.points, "text-right")}
            >
              Points
            </th>
            {hasAverages && (
              <>
                <th
                  scope="col"
                  className={cn(
                    headerCell,
                    COLUMN_WIDTHS.week,
                    "text-right max-lg:hidden"
                  )}
                >
                  Week %
                </th>
                <th
                  scope="col"
                  className={cn(
                    headerCell,
                    COLUMN_WIDTHS.average,
                    "text-right max-lg:hidden"
                  )}
                >
                  3-wk avg %
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>{played.map(renderRow)}</tbody>
      </table>

      {missed.length > 0 && (
        <table className="mt-4 w-full table-fixed border-collapse text-left">
          <caption className="px-2 pb-1 text-left text-sm font-semibold text-muted">
            Didn't play
          </caption>
          <tbody>{missed.map(renderRow)}</tbody>
        </table>
      )}

      {/* Projected moves show as arrows and final ones as tints, so the key
          explains whichever this week has. */}
      {played.some((standing) => standing.projected) ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 px-2 text-sm text-muted">
          <ArrowUpIcon aria-hidden className="size-4 text-promoted" />
          Promoted
          <ArrowDownIcon aria-hidden className="ml-3 size-4 text-demoted" />
          Demoted, if the week ended now
        </p>
      ) : (
        played.some(
          (standing) =>
            standing.movement === "promoted" || standing.movement === "demoted"
        ) && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 px-2 text-sm text-muted">
            <span aria-hidden className="size-2.5 bg-promoted" />
            Promoted
            <span aria-hidden className="ml-3 size-2.5 bg-demoted" />
            Demoted
          </p>
        )
      )}
    </div>
  );
}

// Both tables set the same widths on every cell, so their columns line up.
const COLUMN_WIDTHS = {
  place: "w-10 sm:w-12",
  points: "w-16",
  week: "w-24",
  average: "w-32",
};

function StandingRow({
  number,
  standing,
  isLive,
  hasAverages,
  isSelected,
  onPlayer,
}: {
  number: number | null;
  standing: WeekStanding;
  isLive: boolean;
  hasAverages: boolean;
  isSelected: boolean;
  onPlayer: (playerId: string) => void;
}) {
  const movement = visibleMovement(standing, isLive);
  const move = movement === "none" ? null : movement;
  return (
    <tr
      onClick={() => onPlayer(standing.playerId)}
      className={cn(
        "h-10 cursor-pointer border-b border-border/60 transition-colors hover:bg-background-raised",
        move && !standing.projected && MOVE_TINTS[move],
        standing.rank === null && "text-muted",
        isSelected &&
          "bg-background-raised shadow-[inset_3px_0_0_var(--color-primary)]"
      )}
    >
      <td
        className={cn(
          COLUMN_WIDTHS.place,
          "px-2 text-right text-muted tabular-nums"
        )}
      >
        {number}
      </td>
      <th scope="row" className="px-2 font-normal max-sm:pl-1">
        <button
          type="button"
          aria-pressed={isSelected}
          className="flex max-w-full cursor-pointer items-center gap-2.5 py-1 text-left"
        >
          <PlayerHead player={standing.uuid} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 truncate font-minecraft leading-tight">
                {standing.name}
              </span>
              {move && <span className="sr-only">, {movementLabel(move)}</span>}
              {/* Projected moves show an arrow, final ones a tint. */}
              {move === "promoted" && standing.projected && (
                <ArrowUpIcon
                  aria-hidden
                  className="size-4 shrink-0 text-promoted"
                />
              )}
              {move === "demoted" && standing.projected && (
                <ArrowDownIcon
                  aria-hidden
                  className="size-4 shrink-0 text-demoted"
                />
              )}
              {standing.rank === 1 && (
                <CrownIcon
                  aria-label={isLive ? "Leading" : "Winner"}
                  className="size-4 shrink-0 text-gold"
                />
              )}
            </span>
            {/* Below `lg` the percentage columns move under the name, leaving room for the details panel. */}
            {standing.averagePercentage !== null && (
              <span className="block font-minecraft text-xs text-muted lg:hidden">
                {standing.currentPercentage !== null &&
                  `Week ${formatPercentage(standing.currentPercentage)} · `}
                Avg {formatPercentage(standing.averagePercentage)}
              </span>
            )}
          </span>
        </button>
      </th>
      <td
        className={cn(
          COLUMN_WIDTHS.points,
          "px-2 text-right font-minecraft text-lg pixel-shadow"
        )}
      >
        {standing.totalPoints}
      </td>
      {hasAverages && (
        <>
          <td
            className={cn(
              COLUMN_WIDTHS.week,
              "px-2 text-right font-minecraft text-muted max-lg:hidden"
            )}
          >
            {formatPercentage(standing.currentPercentage)}
          </td>
          <td
            className={cn(
              COLUMN_WIDTHS.average,
              "px-2 text-right font-minecraft max-lg:hidden"
            )}
          >
            {formatPercentage(standing.averagePercentage)}
          </td>
        </>
      )}
    </tr>
  );
}

function sortRows(standings: WeekStanding[], sort: "points" | "average") {
  return sort === "points" ? standings : sortByAverage(standings);
}
