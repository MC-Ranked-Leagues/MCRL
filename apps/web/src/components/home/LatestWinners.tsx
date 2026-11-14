import { api } from "@mcrl/backend/api";
import { useQuery } from "convex/react";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekHref } from "@/lib/weekRoutes";

// League 7 is left out of the band on purpose.
const LEAGUE_TIERS = [1, 2, 3, 4, 5, 6];

function WinnersBand() {
  const week = useQuery(api.weekView.getLatestWinners);
  // Every league keeps its cell, so leagues without a winner yet show empty.
  // While loading, `winnerName` is undefined and the cell shows a skeleton.
  const cells = LEAGUE_TIERS.map(
    (leagueTier) =>
      week?.winners.find((winner) => winner.leagueTier === leagueTier) ?? {
        leagueTier,
        leagueName: `League ${leagueTier}`,
        winnerName: week ? null : undefined,
        winnerUuid: null,
      }
  );

  // Hidden when there's no week at all.
  if (week === null) return null;

  return (
    <section
      aria-labelledby="latest-winners"
      className="border-y border-border bg-background-deep"
    >
      <div className="mx-auto max-w-page px-6 pt-5 pb-3">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 id="latest-winners" className="text-pixel-sm">
            {week
              ? week.isActive
                ? `Week ${week.weekNumber} so far`
                : `Week ${week.weekNumber} winners`
              : "Latest winners"}
          </h2>
          <a
            href="/week"
            className="text-sm font-semibold text-muted underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Full leaderboard
          </a>
        </div>
        {/* The cells' own padding is pulled back, so the heads line up with
            the page's edge. */}
        <ul className="-mx-3 grid grid-cols-2 sm:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col">
          {cells.map(({ leagueTier, leagueName, winnerName, winnerUuid }) => (
            <li key={leagueTier} className="min-w-0">
              {winnerName === null ? (
                <div className="flex h-full items-center gap-2.5 px-3 py-2 leading-tight">
                  <span
                    aria-hidden
                    className="size-8 shrink-0 bg-background-raised"
                  />
                  <span className="min-w-0">
                    <span className="block font-minecraft text-sm text-muted">
                      {leagueName}
                    </span>
                    <span className="block font-minecraft text-muted">
                      No runs yet
                    </span>
                  </span>
                </div>
              ) : week && winnerName !== undefined ? (
                <a
                  href={getWeekHref(week.weekNumber, leagueTier)}
                  className="flex h-full items-center gap-2.5 px-3 py-2 leading-tight transition-colors hover:bg-background-raised"
                >
                  <PlayerHead player={winnerUuid ?? winnerName} />
                  <span className="min-w-0">
                    <span className="block font-minecraft text-sm text-muted">
                      {leagueName}
                    </span>
                    <span className="block truncate font-minecraft">
                      {winnerName}
                    </span>
                  </span>
                </a>
              ) : (
                <div className="flex h-full items-center gap-2.5 px-3 py-2 leading-tight">
                  <Skeleton className="size-8 shrink-0" />
                  <div className="min-w-0">
                    <span className="block font-minecraft text-sm text-muted">
                      {leagueName}
                    </span>
                    <Skeleton className="my-1 h-4 w-20 max-w-full" />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LatestWinners() {
  return (
    <ConvexClientProvider>
      <WinnersBand />
    </ConvexClientProvider>
  );
}
