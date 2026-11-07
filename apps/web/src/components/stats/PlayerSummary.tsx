import { useEffect, useState, type ReactNode } from "react";
import { mcsrranked } from "mcsrranked-sdk";
import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercentage, formatRunTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getCurrentPercentageAverage,
  type PlayerListEntry,
  type PlayerStats,
} from "./stats-utils";

type RankedElo =
  | { playerName: string; status: "success"; elo: number | null }
  | { playerName: string; status: "error" };

// The player's current Elo, read live from MCSR Ranked.
function useRankedElo(
  playerName: string | undefined
): RankedElo | { status: "loading" } {
  const [state, setState] = useState<RankedElo | null>(null);

  useEffect(() => {
    if (!playerName) return;

    let cancelled = false;

    void mcsrranked.users
      .get(playerName)
      .then((player) => {
        if (cancelled) return;
        setState({ playerName, status: "success", elo: player.eloRate });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ playerName, status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [playerName]);

  if (state && state.playerName === playerName) return state;
  return { status: "loading" };
}

// the placeholders keep the same lines so nothing moves.
export function PlayerSummary({
  player,
  fastestRank,
  stats,
}: {
  player: PlayerListEntry | undefined;
  fastestRank: number | null;
  stats: PlayerStats | null | undefined;
}) {
  const rankedElo = useRankedElo(player?.name);
  const savedAverage = stats
    ? getCurrentPercentageAverage(stats.percentageHistory)
    : null;

  // On phones the numbers sit in a fixed grid under the face, so they don't
  // rewrap when they replace their placeholders.
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 sm:gap-x-5">
      {player ? (
        <PlayerHead
          player={player.uuid}
          className="size-14 sm:row-span-2 sm:size-24"
        />
      ) : (
        <Skeleton className="size-14 sm:row-span-2 sm:size-24" />
      )}
      <div className="min-w-0">
        {player ? (
          <h1 className="text-xl leading-tight font-bold wrap-anywhere sm:text-4xl">
            {player.name}
          </h1>
        ) : (
          <div className="flex h-6.25 items-center sm:h-11.25">
            <h1 className="sr-only">Player stats</h1>
            <Skeleton className="h-5 w-48 sm:h-8 sm:w-72" />
          </div>
        )}

        <div className="flex min-h-7.5 flex-wrap items-center gap-x-4 font-minecraft text-lg">
          {player ? (
            <>
              <span>League {player.leagueTier}</span>
              {rankedElo.status === "loading" ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                rankedElo.status === "success" &&
                rankedElo.elo !== null && <span>{rankedElo.elo} Elo</span>
              )}
              {fastestRank !== null && (
                <span
                  className={cn(fastestRank === 1 ? "text-gold" : "text-muted")}
                >
                  #{fastestRank} fastest
                </span>
              )}
            </>
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>
      </div>

      {/* Left out when the player's record is gone. */}
      {stats !== null && (
        <ul className="col-span-2 mt-3 grid grid-cols-2 gap-x-5 gap-y-1 sm:col-span-1 sm:col-start-2 sm:mt-2 sm:flex sm:flex-wrap">
          <Stat label="best" isLoading={!stats}>
            {stats && formatRunTime(stats.summary.bestTimeMs)}
          </Stat>
          <Stat label="average" isLoading={!stats}>
            {stats && formatRunTime(stats.summary.avgTimeMs)}
          </Stat>
          <Stat label="matches" isLoading={!stats}>
            {stats?.summary.totalMatches}
          </Stat>
          {stats && savedAverage === null ? (
            <li className="col-span-2 min-h-7.5 text-muted">
              No percentage carried into next week
            </li>
          ) : (
            <Stat
              label="carried into next week"
              isLoading={!stats}
              className="col-span-2"
            >
              {formatPercentage(savedAverage)}
            </Stat>
          )}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  isLoading,
  className,
  children,
}: {
  label: string;
  isLoading: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn("flex min-h-7.5 items-baseline gap-1.5", className)}>
      {isLoading ? (
        <Skeleton className="h-5 w-16 self-center" />
      ) : (
        <span className="font-minecraft text-lg font-bold tabular-nums">
          {children}
        </span>
      )}
      <span className="whitespace-nowrap text-muted">{label}</span>
    </li>
  );
}
