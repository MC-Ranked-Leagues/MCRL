import { api } from "@mcrl/backend/api";
import { useQuery } from "convex/react";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekHref } from "@/lib/weekRoutes";

// Stands in for the real list while it loads, so the band shows straight away.
const PLACEHOLDER_CELLS = [1, 2, 3, 4, 5, 6].map((leagueTier) => ({
  leagueTier,
  leagueName: `League ${leagueTier}`,
  winnerName: undefined,
}));

function WinnersBand() {
  const week = useQuery(api.weekView.getLatestWinners);
  // League 7 is left out of the band on purpose.
  const cells = week
    ? week.winners.filter(({ leagueTier }) => leagueTier !== 7)
    : PLACEHOLDER_CELLS;

  // it stays hidden when theres nothing to show rather than leaving an empty section.
  if (week === null || cells.length === 0) return null;

  return (
    <section
      aria-label={
        week
          ? week.isActive
            ? `Week ${week.weekNumber} so far`
            : `Week ${week.weekNumber} winners`
          : "Latest winners"
      }
      className="border-t border-obsidian-line/60 bg-obsidian-deep/80"
    >
      <ul className="grid grid-cols-2 px-3 py-3 sm:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col">
        {cells.map(({ leagueTier, leagueName, winnerName }) => (
          <li key={leagueTier} className="min-w-0">
            {week && winnerName !== undefined ? (
              <a
                href={getWeekHref(week.weekNumber, leagueTier)}
                className="flex h-full items-center gap-3 px-3 py-2 transition-colors hover:bg-obsidian-raised"
              >
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(winnerName)}/36`}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 bg-obsidian-line [image-rendering:pixelated]"
                />
                <span className="min-w-0">
                  <span className="block font-minecraft text-sm text-home-gold">
                    {leagueName}
                  </span>
                  <span className="block truncate font-semibold">
                    {winnerName}
                  </span>
                </span>
              </a>
            ) : (
              <div className="flex h-full items-center gap-3 px-3 py-2">
                <Skeleton className="size-9 shrink-0 rounded-none bg-obsidian-line" />
                <div className="min-w-0">
                  <span className="block font-minecraft text-sm text-home-gold">
                    {leagueName}
                  </span>
                  <Skeleton className="my-1.5 h-4 w-20 max-w-full rounded-none bg-obsidian-line" />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
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
