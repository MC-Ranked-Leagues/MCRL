import {
  Component,
  useMemo,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@mcrl/backend/api";
import { AverageTimeTrend } from "./AverageTimeTrend";
import { PlayerSummary } from "./PlayerSummary";
import { StatsPlayerBrowser } from "./StatsPlayerBrowser";
import { WeeklyPerformance } from "./WeeklyPerformance";
import {
  buildPlayerUrl,
  mergeWeeklyPerformance,
  type PlayerListEntry,
} from "./stats-utils";

const LOCATION_CHANGE_EVENT = "stats:location-change";

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(LOCATION_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(LOCATION_CHANGE_EVENT, callback);
  };
}

function getLocationSnapshot() {
  return typeof window === "undefined" ? "" : window.location.search;
}

class StatsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render player statistics", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto max-w-page px-6 pt-32 pb-20">
          <h1 className="text-4xl leading-none font-bold md:text-6xl">
            Stats didn't load
          </h1>
          <p className="mt-5 mb-7 text-home-muted">
            Something went wrong on our side. Reload to try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer bg-lava px-6 py-3.5 font-minecraft text-lg font-bold text-lava-ink transition-colors hover:bg-lava-hover"
          >
            Reload
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

function StatsContent() {
  const locationSearch = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    () => ""
  );
  const [locallySelectedPlayer, setLocallySelectedPlayer] =
    useState<PlayerListEntry | null>(null);
  const fastestPlayers = useQuery(api.leaderboard.getFastestPlayers);
  const playerParam = new URLSearchParams(locationSearch).get("player");
  const requestedPlayerName = playerParam?.trim() || null;
  const requestedPlayer = useQuery(
    api.players.findPlayerByName,
    requestedPlayerName ? { ign: requestedPlayerName } : "skip"
  );

  // A player picked from the list shows straight away, before the URL's
  // lookup catches up.
  const optimisticPlayer =
    requestedPlayerName !== null &&
    locallySelectedPlayer?.name.localeCompare(requestedPlayerName, undefined, {
      sensitivity: "base",
    }) === 0
      ? locallySelectedPlayer
      : null;
  const isResolvingRequestedPlayer =
    requestedPlayerName !== null &&
    requestedPlayer === undefined &&
    optimisticPlayer === null;
  // Undefined while loading, null when there's no one to show.
  const selectedPlayer = isResolvingRequestedPlayer
    ? undefined
    : (optimisticPlayer ??
      requestedPlayer ??
      (fastestPlayers === undefined ? undefined : (fastestPlayers[0] ?? null)));
  const stats = useQuery(
    api.playerStats.getPlayerStats,
    selectedPlayer ? { playerId: selectedPlayer.playerId } : "skip"
  );
  const weeks = useMemo(
    () => (stats ? mergeWeeklyPerformance(stats) : []),
    [stats]
  );

  // Only players in the fastest list have a rank.
  const fastestRank =
    fastestPlayers?.find(
      (player) => player.playerId === selectedPlayer?.playerId
    )?.rank ?? null;

  return (
    <>
      {/* Exists from the start, so screen readers announce each new player. */}
      <p className="sr-only" aria-live="polite">
        {selectedPlayer && `Showing stats for ${selectedPlayer.name}.`}
      </p>

      <div className="mx-auto grid max-w-page grid-cols-[minmax(0,1fr)] items-start gap-8 px-6 pt-24 pb-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[24rem_minmax(0,1fr)] xl:gap-16">
        <StatsPlayerBrowser
          fastestPlayers={fastestPlayers}
          selectedPlayer={selectedPlayer ?? null}
          onSelect={(player) => {
            setLocallySelectedPlayer(player);
            window.history.pushState(
              window.history.state,
              "",
              buildPlayerUrl(window.location.href, player.name)
            );
            window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
          }}
        />

        <div className="flex min-w-0 flex-col gap-12">
          {selectedPlayer === null ? (
            <div>
              <h1 className="text-4xl leading-none font-bold md:text-6xl">
                Player stats
              </h1>
              <p className="mt-4 text-home-muted">
                Search for a player to see their stats.
              </p>
            </div>
          ) : (
            <PlayerSummary
              player={selectedPlayer}
              fastestRank={fastestRank}
              stats={stats}
            />
          )}
          {stats === null ? (
            <p className="text-home-muted">
              This player's record is gone. Pick another player.
            </p>
          ) : stats === undefined ? (
            selectedPlayer !== null && (
              <div aria-busy="true" className="flex flex-col gap-12">
                <p className="sr-only" role="status">
                  Loading player stats.
                </p>
                <div>
                  <Skeleton className="h-9 w-56" />
                  <Skeleton className="mt-4 h-72" />
                </div>
                <div>
                  <Skeleton className="h-9 w-40" />
                  <div className="mt-4 flex flex-col gap-1">
                    {Array.from({ length: 6 }, (_, index) => (
                      <Skeleton key={index} className="h-14" />
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <AverageTimeTrend weeks={weeks} />
              <WeeklyPerformance weeks={weeks} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function StatsPage() {
  return (
    <ConvexClientProvider>
      <StatsErrorBoundary>
        <StatsContent />
      </StatsErrorBoundary>
    </ConvexClientProvider>
  );
}
