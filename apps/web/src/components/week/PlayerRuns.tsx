import { api } from "@mcrl/backend/api";
import { useQuery } from "convex/react";
import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { useHttpQuery } from "@/hooks/use-http-query";
import { formatPercentage, formatRunTime } from "@/lib/format";
import {
  SEED_TYPE_LABELS,
  type PublishedSeed,
} from "@/lib/seedHistoryResponse";
import { cn } from "@/lib/utils";
import type { WeekStanding } from "./weekData";

export function PlayerRuns({
  standing,
  weekNumber,
  leagueTier,
  isArchived,
  seeds,
  onMatch,
}: {
  standing: WeekStanding;
  weekNumber: number;
  leagueTier: number;
  isArchived: boolean;
  seeds: Map<number, PublishedSeed>;
  onMatch: (matchNumber: number) => void;
}) {
  const args = { weekNumber, leagueTier, playerId: standing.playerId };
  const livePlacements = useQuery(
    api.weekView.getPlayerWeekPlacements,
    isArchived ? "skip" : args
  );
  const { data: archivedPlacements, failed } = useHttpQuery(
    api.weekView.getPlayerWeekPlacements,
    isArchived ? args : "skip",
    { cache: true }
  );
  const placements = isArchived ? archivedPlacements : livePlacements;

  return (
    <>
      <div className="flex items-start gap-3">
        <PlayerHead player={standing.uuid} />
        <h2 className="min-w-0 flex-1 text-2xl leading-8 font-bold break-all">
          <a
            href={`/stats?player=${encodeURIComponent(standing.name)}`}
            className="hover:underline"
          >
            {standing.name}
          </a>
        </h2>
      </div>
      <p className="mt-1">
        <span className="font-semibold">
          {standing.rank !== null && `${ordinal(standing.rank)}, `}
          {standing.totalPoints} points
        </span>
        {standing.averagePercentage !== null && (
          <span className="text-home-muted">
            {" "}
            · {formatPercentage(standing.averagePercentage)} average
          </span>
        )}
      </p>

      {failed ? (
        <p className="mt-3 text-home-muted">
          Couldn't load this player. Reload to try again.
        </p>
      ) : placements === undefined ? (
        <div aria-busy="true" className="mt-3 flex flex-col gap-1">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-13" />
          ))}
        </div>
      ) : placements.length === 0 ? (
        <p className="mt-3 text-home-muted">No matches this week.</p>
      ) : (
        <ol className="mt-3 border-t border-obsidian-line/60">
          {placements.map((placement) => {
            const seed = seeds.get(placement.matchNumber);
            const timeMs =
              placement.missed || placement.dnf ? null : placement.timeMs;
            return (
              <li key={placement.matchId}>
                <button
                  type="button"
                  onClick={() => onMatch(placement.matchNumber)}
                  className="grid w-full cursor-pointer grid-cols-[3.5rem_minmax(0,1fr)_auto_3rem] items-center gap-x-3 border-b border-obsidian-line/60 px-1 py-2 text-left transition-colors hover:bg-obsidian-raised"
                >
                  <span
                    className={cn(
                      "font-minecraft text-xl leading-none font-bold",
                      placement.placement === 1 && "text-home-gold",
                      placement.dnf && "text-lava-hover",
                      placement.missed && "text-base text-home-muted"
                    )}
                  >
                    {placement.missed
                      ? "Missed"
                      : placement.dnf || placement.placement === null
                        ? "DNF"
                        : ordinal(placement.placement)}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block font-semibold">
                      Match {placement.matchNumber}
                    </span>
                    {seed?.type && (
                      <span className="block truncate text-sm text-home-muted">
                        {SEED_TYPE_LABELS[seed.type]}
                      </span>
                    )}
                  </span>
                  <span className="font-minecraft text-sm text-home-muted tabular-nums">
                    {timeMs !== null && formatRunTime(timeMs)}
                  </span>
                  <span
                    className={cn(
                      "text-right font-minecraft text-lg leading-none font-bold tabular-nums",
                      placement.pointsWon === 0 && "text-home-muted"
                    )}
                  >
                    +{placement.pointsWon}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function ordinal(place: number) {
  const lastTwo = place % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${place}th`;
  return `${place}${["th", "st", "nd", "rd"][place % 10] ?? "th"}`;
}
