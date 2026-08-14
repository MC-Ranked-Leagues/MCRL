import { memo, useEffect, useState } from "react"
import { useQuery } from "convex/react"
import { ChevronDown, Clock3, Search, Trophy } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { formatDuration, type PlayerListEntry } from "./stats-utils"

interface StatsPlayerBrowserProps {
  fastestPlayers: PlayerListEntry[]
  selectedPlayer: PlayerListEntry | null
  onSelect: (player: PlayerListEntry) => void
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeoutId)
  }, [delayMs, value])

  return debouncedValue
}

function PlayerRows({
  players,
  selectedPlayerId,
  onSelect,
  isSearch,
}: {
  players: PlayerListEntry[]
  selectedPlayerId: Id<"players"> | null
  onSelect: (player: PlayerListEntry) => void
  isSearch: boolean
}) {
  if (players.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
        <Search className="mb-3 size-5 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium">
          {isSearch ? "No players found" : "No completed times yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isSearch
            ? "Try a different player name."
            : "Search for a player while the leaderboard is being established."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {players.map((player) => {
        const isSelected = player.playerId === selectedPlayerId

        return (
          <button
            key={player.playerId}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(player)}
            className={cn(
              "group grid min-h-14 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              isSelected
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
            )}
          >
            <span className="text-center font-minecraft text-sm text-muted-foreground tabular-nums">
              {player.rank === null ? "—" : `#${player.rank}`}
            </span>
            <span className="flex min-w-0 items-center gap-2.5">
              <img
                alt=""
                aria-hidden
                className="size-8 shrink-0 rounded-md bg-muted [image-rendering:pixelated]"
                height={32}
                loading="lazy"
                src={`https://mc-heads.net/avatar/${player.uuid}/32`}
                width={32}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {player.name}
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.12em] uppercase">
                  League {player.leagueTier}
                </span>
              </span>
            </span>
            <span className="text-right font-minecraft text-xs text-primary tabular-nums">
              {formatDuration(player.fastestTimeMs)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PlayerRowsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14 rounded-lg" />
      ))}
    </div>
  )
}

function LeaderboardContent({
  searchInputId,
  searchQuery,
  setSearchQuery,
  isSearch,
  isWaitingForSearch,
  players,
  selectedPlayerId,
  onSelect,
  scrollClassName,
}: {
  searchInputId: string
  searchQuery: string
  setSearchQuery: (value: string) => void
  isSearch: boolean
  isWaitingForSearch: boolean
  players: PlayerListEntry[]
  selectedPlayerId: Id<"players"> | null
  onSelect: (player: PlayerListEntry) => void
  scrollClassName: string
}) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div>
        <label
          htmlFor={searchInputId}
          className="mb-2 block text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
        >
          Search all leagues
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id={searchInputId}
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Player name"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-input bg-background/40 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground/65 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-b px-2 pb-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        <span>{isSearch ? "Player" : "Rank / player"}</span>
        <span className="flex items-center gap-1">
          <Clock3 className="size-3" aria-hidden />
          Fastest
        </span>
      </div>
      <div className={scrollClassName}>
        {isWaitingForSearch ? (
          <PlayerRowsSkeleton />
        ) : (
          <PlayerRows
            players={players}
            selectedPlayerId={selectedPlayerId}
            onSelect={onSelect}
            isSearch={isSearch}
          />
        )}
      </div>
    </div>
  )
}

export const StatsPlayerBrowser = memo(function StatsPlayerBrowser({
  fastestPlayers,
  selectedPlayer,
  onSelect,
}: StatsPlayerBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const normalizedSearchQuery = searchQuery.trim()
  const debouncedSearchQuery = useDebouncedValue(normalizedSearchQuery, 200)
  const isSearch = normalizedSearchQuery.length > 0
  const searchResults = useQuery(
    api.players.searchPlayers,
    debouncedSearchQuery ? { searchTerm: debouncedSearchQuery } : "skip"
  )
  const isWaitingForSearch =
    isSearch &&
    (debouncedSearchQuery !== normalizedSearchQuery ||
      searchResults === undefined)
  const players = isSearch ? (searchResults ?? []) : fastestPlayers
  const selectedPlayerId = selectedPlayer?.playerId ?? null

  return (
    <>
      <aside
        aria-label="Player leaderboard"
        className="hidden lg:sticky lg:top-24 lg:block"
      >
        <Card className="gap-0 py-0">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 font-minecraft text-sm tracking-[0.08em] uppercase">
              {isSearch ? (
                <Search className="size-4 text-primary" aria-hidden />
              ) : (
                <Trophy className="size-4 text-primary" aria-hidden />
              )}
              {isSearch ? "Search results" : "Fastest players"}
            </CardTitle>
            <CardDescription>
              {isSearch
                ? "Matching players from every league."
                : "Top 20 personal bests across all leagues."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 py-3">
            <LeaderboardContent
              searchInputId="stats-player-search-desktop"
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isSearch={isSearch}
              isWaitingForSearch={isWaitingForSearch}
              players={players}
              selectedPlayerId={selectedPlayerId}
              onSelect={onSelect}
              scrollClassName="max-h-[calc(100vh-22rem)] overflow-y-auto pr-1"
            />
          </CardContent>
        </Card>
      </aside>

      <div className="lg:hidden">
        <Drawer autoFocus open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger
            type="button"
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-input bg-card px-4 py-2 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {selectedPlayer ? (
              <img
                alt=""
                aria-hidden
                className="size-9 shrink-0 rounded-lg bg-muted [image-rendering:pixelated]"
                height={36}
                src={`https://mc-heads.net/avatar/${selectedPlayer.uuid}/36`}
                width={36}
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Trophy className="size-4" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {selectedPlayer ? "Selected player" : "Leaderboard"}
              </span>
              <span className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {selectedPlayer ? selectedPlayer.name : "Fastest players"}
                </span>
                {selectedPlayer ? (
                  <span className="shrink-0 font-minecraft text-xs text-primary tabular-nums">
                    {formatDuration(selectedPlayer.fastestTimeMs)}
                  </span>
                ) : null}
              </span>
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </DrawerTrigger>

          <DrawerContent>
            <DrawerHeader className="border-b px-5 pb-4 text-left">
              <DrawerTitle className="font-minecraft tracking-[0.08em] uppercase">
                {isSearch ? "Search results" : "Fastest players"}
              </DrawerTitle>
              <DrawerDescription>
                Search every league or browse the top 20 personal bests.
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden px-4 pt-4 pb-6">
              <LeaderboardContent
                searchInputId="stats-player-search-mobile"
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearch={isSearch}
                isWaitingForSearch={isWaitingForSearch}
                players={players}
                selectedPlayerId={selectedPlayerId}
                onSelect={(player) => {
                  onSelect(player)
                  setDrawerOpen(false)
                }}
                scrollClassName="max-h-[52vh] overflow-y-auto pr-1"
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  )
})
