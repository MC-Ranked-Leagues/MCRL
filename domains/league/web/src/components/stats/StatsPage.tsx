import {
  Component,
  useState,
  useSyncExternalStore,
  type ErrorInfo,
  type ReactNode,
} from "react"
import { useQuery } from "convex/react"
import { RotateCcw, Search, Trophy } from "lucide-react"
import ConvexClientProvider from "@/components/ConvexClientProvider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "../../../../convex/_generated/api"
import { PlayerStatsDashboard } from "./PlayerStatsDashboard"
import { StatsPlayerBrowser } from "./StatsPlayerBrowser"
import { buildPlayerUrl, type PlayerListEntry } from "./stats-utils"

const LOCATION_CHANGE_EVENT = "stats:location-change"

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(LOCATION_CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(LOCATION_CHANGE_EVENT, callback)
  }
}

function getLocationSnapshot() {
  return typeof window === "undefined" ? "" : window.location.search
}

class StatsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render player statistics", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="mx-auto flex min-h-screen max-w-3xl items-center px-4 pt-24 pb-20 md:px-8">
          <Card className="w-full items-center px-6 py-14 text-center">
            <Trophy className="size-10 text-muted-foreground/55" aria-hidden />
            <div>
              <h1 className="font-minecraft text-xl tracking-[0.08em] uppercase">
                Stats could not be loaded
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Something went wrong while loading this page. Try again to
                reconnect to the latest player data.
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw aria-hidden />
              Try again
            </Button>
          </Card>
        </section>
      )
    }

    return this.props.children
  }
}

function PageSkeleton() {
  return (
    <div
      className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading player statistics.
      </p>
      <Skeleton className="h-132 rounded-xl" aria-hidden="true" />
      <div className="flex flex-col gap-5" aria-hidden="true">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-88 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

function NoPlayerSelected() {
  return (
    <Card className="min-h-80 items-center justify-center px-6 py-12 text-center">
      <Search className="size-10 text-muted-foreground/55" aria-hidden />
      <div>
        <h2 className="font-minecraft text-lg tracking-[0.08em] uppercase">
          Find a player
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Search by player name to view statistics from any league.
        </p>
      </div>
    </Card>
  )
}

function GlobalStatsView({ locationSearch }: { locationSearch: string }) {
  const [locallySelectedPlayer, setLocallySelectedPlayer] =
    useState<PlayerListEntry | null>(null)
  const fastestPlayers = useQuery(api.leaderboard.getFastestPlayers)
  const playerParam = new URLSearchParams(locationSearch).get("player")
  const requestedPlayerName = playerParam?.trim() || null
  const requestedPlayer = useQuery(
    api.players.findPlayerByName,
    requestedPlayerName ? { ign: requestedPlayerName } : "skip"
  )

  const optimisticPlayer =
    requestedPlayerName !== null &&
    locallySelectedPlayer?.name.localeCompare(requestedPlayerName, undefined, {
      sensitivity: "base",
    }) === 0
      ? locallySelectedPlayer
      : null
  const isResolvingRequestedPlayer =
    requestedPlayerName !== null &&
    requestedPlayer === undefined &&
    optimisticPlayer === null
  const selectedPlayer = isResolvingRequestedPlayer
    ? undefined
    : (optimisticPlayer ?? requestedPlayer ?? fastestPlayers?.[0] ?? null)
  const stats = useQuery(
    api.playerStats.getPlayerStats,
    selectedPlayer ? { playerId: selectedPlayer.playerId } : "skip"
  )

  if (fastestPlayers === undefined || isResolvingRequestedPlayer) {
    return <PageSkeleton />
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      {selectedPlayer ? (
        <p className="sr-only" aria-live="polite">
          Showing statistics for {selectedPlayer.name}.
        </p>
      ) : null}
      <StatsPlayerBrowser
        fastestPlayers={fastestPlayers}
        selectedPlayer={selectedPlayer ?? null}
        onSelect={(player) => {
          setLocallySelectedPlayer(player)
          window.history.pushState(
            window.history.state,
            "",
            buildPlayerUrl(window.location.href, player.name)
          )
          window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT))
        }}
      />
      {selectedPlayer ? (
        <PlayerStatsDashboard stats={stats} />
      ) : (
        <NoPlayerSelected />
      )}
    </div>
  )
}

function StatsContent() {
  const locationSearch = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    () => ""
  )

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 pt-24 pb-20 md:px-8 md:pt-28 md:pb-24">
      <header className="mb-8 max-w-2xl md:mb-10">
        <h1 className="font-minecraft text-3xl font-bold tracking-tight uppercase md:text-4xl">
          Player statistics
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
          Search every league or explore the 20 fastest recorded players.
        </p>
      </header>

      <GlobalStatsView locationSearch={locationSearch} />
    </section>
  )
}

export function StatsPage() {
  return (
    <ConvexClientProvider>
      <StatsErrorBoundary>
        <StatsContent />
      </StatsErrorBoundary>
    </ConvexClientProvider>
  )
}
