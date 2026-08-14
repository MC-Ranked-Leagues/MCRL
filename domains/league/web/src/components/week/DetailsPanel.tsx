import { lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LazyMatchData = lazy(async () => {
  const module = await import("./MatchData");
  return { default: module.default };
});

export function DetailsPanel({
  weekNumber,
  leagueTier,
  playerId,
  matchId,
  rankedMatchId,
  playerStats,
  showBorder = true,
}: {
  weekNumber: number | null;
  leagueTier: number | null;
  playerId: string | null;
  matchId: string | null;
  rankedMatchId: string | null;
  playerStats: {
    name: string;
    totalPoints: number;
    rank: number | null;
  } | null;
  showBorder?: boolean;
}) {
  if (playerId && weekNumber !== null && leagueTier !== null && playerStats) {
    return (
      <div
        className={cn(
          "p-0 md:bg-muted/10 md:p-4 lg:p-8",
          showBorder && "rounded-3xl border border-border"
        )}
      >
        <PlayerDetails
          weekNumber={weekNumber}
          leagueTier={leagueTier}
          playerId={playerId as Id<"players">}
          stats={playerStats}
        />
      </div>
    );
  }

  if (matchId) {
    return (
      <div
        className={cn(
          "flex min-h-75 flex-col items-center justify-center p-0 md:bg-muted/10 md:p-4",
          showBorder && "rounded-3xl border border-border"
        )}
      >
        <Suspense
          fallback={
            <div className="w-full text-center text-sm text-muted-foreground">
              Loading match data...
            </div>
          }
        >
          <LazyMatchData matchId={rankedMatchId} />
        </Suspense>
      </div>
    );
  }

  return null;
}

function PlayerDetails({
  weekNumber,
  leagueTier,
  playerId,
  stats,
}: {
  weekNumber: number;
  leagueTier: number;
  playerId: Id<"players">;
  stats: { name: string; totalPoints: number; rank: number | null };
}) {
  const placements = useQuery(api.weekView.getPlayerWeekPlacements, {
    weekNumber,
    leagueTier,
    playerId,
  });

  if (placements === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-50" />
        <Skeleton className="h-4 w-37.5" />
        <div className="mt-8 flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col font-minecraft">
      <div className="mb-6 flex flex-col gap-2 border-b border-border/50 pb-6">
        <div className="flex items-center gap-3">
          {stats.rank !== null && (
            <span className="text-xl font-bold text-muted-foreground">
              #{stats.rank}
            </span>
          )}
          <a
            className="text-xl tracking-widest text-foreground hover:underline"
            href={`https://mcsrranked.com/stats/${stats.name}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {stats.name}
          </a>
        </div>
        <p className="space-x-2 text-sm text-foreground">
          <span className="font-bold">{stats.totalPoints}</span>
          <span>total points -</span>
          <span>{placements.length} matches</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {placements.map((placement) => {
          const placementText =
            placement.placement === 1
              ? "1st"
              : placement.placement === 2
                ? "2nd"
                : placement.placement === 3
                  ? "3rd"
                  : placement.placement === null
                    ? "DNF"
                    : `${placement.placement}th`;

          const isPodium =
            placement.placement !== null && placement.placement <= 3;
          const isWinner = placement.placement === 1;

          return (
            <div key={placement.matchId} className="flex flex-row items-center">
              <span className="w-32 text-sm text-muted-foreground capitalize max-md:w-20">
                Match {placement.matchNumber}
              </span>
              <span
                className={`w-20 text-sm font-bold tracking-tight ${isWinner ? "text-yellow-500" : isPodium ? "text-foreground" : "text-muted-foreground"}`}
              >
                {placement.missed
                  ? "Missed"
                  : placement.dnf
                    ? "DNF"
                    : placementText}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                +{placement.pointsWon} points
              </span>
            </div>
          );
        })}
        {placements.length === 0 && (
          <div className="py-4 text-sm text-muted-foreground opacity-50">
            No match records found...
          </div>
        )}
      </div>
    </div>
  );
}
