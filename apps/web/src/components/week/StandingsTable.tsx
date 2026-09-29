import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Id } from "@mcrl/backend/data-model";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { formatPercentage } from "../stats/stats-utils";

interface StandingRow {
  rank: number | null;
  playerId: Id<"players">;
  name: string;
  totalPoints: number;
  movement?: "promoted" | "demoted" | "none" | null;
  currentPercentage: number | null;
  averagePercentage: number | null;
}

interface StandingsTableProps {
  standings: StandingRow[] | undefined;
  selectedPlayerId: string | null;
  onPlayerClick: (playerId: string) => void;
}

export function StandingsTable({
  standings,
  selectedPlayerId,
  onPlayerClick,
}: StandingsTableProps) {
  const [sortBy, setSortBy] = useState<"placement" | "average">("placement");

  if (!standings) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No records found</div>
    );
  }

  const hasAverages = standings.some((row) => row.averagePercentage !== null);
  const sortByAverage = hasAverages && sortBy === "average";
  const sortedStandings = sortByAverage
    ? [...standings].sort((a, b) => {
        if (a.averagePercentage === null)
          return b.averagePercentage === null ? 0 : 1;
        if (b.averagePercentage === null) return -1;

        return (
          b.averagePercentage - a.averagePercentage ||
          (b.currentPercentage ?? -1) - (a.currentPercentage ?? -1) ||
          (a.rank ?? Number.MAX_SAFE_INTEGER) -
            (b.rank ?? Number.MAX_SAFE_INTEGER)
        );
      })
    : standings;
  const firstUnrankedIndex = sortedStandings.findIndex((row) =>
    sortByAverage ? row.averagePercentage === null : row.rank === null
  );

  return (
    <div className="flex flex-col font-minecraft">
      {hasAverages && (
        <div
          role="group"
          aria-label="Sort standings"
          className="mb-2 flex items-center justify-between gap-2 px-4"
        >
          <span className="text-xs text-muted-foreground">Sort by</span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={sortByAverage ? "ghost" : "secondary"}
              aria-pressed={!sortByAverage}
              onClick={() => setSortBy("placement")}
            >
              Placement
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortByAverage ? "secondary" : "ghost"}
              aria-pressed={sortByAverage}
              onClick={() => setSortBy("average")}
            >
              Average
            </Button>
          </div>
        </div>
      )}
      {sortedStandings.map((row, index) => {
        const isSelected = selectedPlayerId === row.playerId;
        const displayedRank = sortByAverage
          ? row.averagePercentage === null
            ? null
            : index + 1
          : row.rank;

        return (
          <div key={row.playerId}>
            {index === firstUnrankedIndex && firstUnrankedIndex > 0 && (
              <div
                role="separator"
                className="mt-3 mb-1 flex items-center gap-3 px-4 text-[10px] tracking-wider text-muted-foreground/70 uppercase"
              >
                <span className="h-px flex-1 bg-border" />
                <span>{sortByAverage ? "No average" : "Didn't show up"}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onPlayerClick(row.playerId)}
              aria-pressed={isSelected}
              className={cn(
                "w-full rounded-xl px-4 py-2 text-left transition-colors hover:bg-muted/50",
                displayedRank === null && "text-muted-foreground",
                isSelected && "border border-border bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    aria-hidden={displayedRank === null}
                    className="w-6 shrink-0 text-center text-muted-foreground"
                  >
                    {displayedRank}
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1 font-medium",
                      row.movement === "promoted" && "text-green-400",
                      row.movement === "demoted" && "text-destructive"
                    )}
                  >
                    {row.movement === "promoted" && (
                      <ArrowUpIcon className="size-4 shrink-0" />
                    )}
                    {row.movement === "demoted" && (
                      <ArrowDownIcon className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{row.name}</span>
                  </span>
                </div>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {row.totalPoints} pts
                </span>
              </div>
              {(row.currentPercentage !== null ||
                row.averagePercentage !== null) && (
                <div className="mt-1 ml-10 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  {row.currentPercentage !== null && (
                    <span>Week {formatPercentage(row.currentPercentage)}</span>
                  )}
                  {row.averagePercentage !== null && (
                    <span>Avg {formatPercentage(row.averagePercentage)}</span>
                  )}
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
