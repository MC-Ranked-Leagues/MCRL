import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, Search } from "lucide-react";
import { PlayerHead } from "@/components/PlayerHead";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@mcrl/backend/api";
import type { Id } from "@mcrl/backend/data-model";
import { formatRunTime } from "@/lib/format";
import type { PlayerListEntry } from "./stats-utils";

function useDebouncedValue(value: string, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedValue(value),
      delayMs
    );
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function PlayerRows({
  players,
  selectedPlayerId,
  onSelect,
  isSearch,
}: {
  players: PlayerListEntry[];
  selectedPlayerId: Id<"players"> | null;
  onSelect: (player: PlayerListEntry) => void;
  isSearch: boolean;
}) {
  if (players.length === 0) {
    return (
      <p className="py-6 text-home-muted">
        {isSearch ? "No players with that name." : "No finished runs yet."}
      </p>
    );
  }

  // Search results aren't ranked.
  const List = isSearch ? "ul" : "ol";

  return (
    <List>
      {players.map((player) => {
        const isSelected = player.playerId === selectedPlayerId;

        return (
          <li key={player.playerId}>
            <button
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(player)}
              className={cn(
                "grid w-full cursor-pointer items-center gap-x-2.5 border-b border-obsidian-line/60 py-1.5 pr-3 pl-1 text-left transition-colors hover:bg-obsidian-raised",
                // Search results have no rank, so their rows skip that column.
                player.rank === null
                  ? "grid-cols-[minmax(0,1fr)_auto]"
                  : "grid-cols-[2rem_minmax(0,1fr)_auto]",
                isSelected &&
                  "bg-obsidian-raised shadow-[inset_3px_0_0_var(--color-lava)]"
              )}
            >
              {player.rank !== null && (
                <span
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    player.rank === 1 && "text-home-gold"
                  )}
                >
                  {player.rank}
                </span>
              )}
              <span className="flex min-w-0 items-center gap-2.5">
                <PlayerHead player={player.uuid} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-minecraft">
                    {player.name}
                  </span>
                  <span className="block text-sm text-home-muted">
                    League {player.leagueTier}
                  </span>
                </span>
              </span>
              <span className="font-minecraft text-home-muted tabular-nums">
                {formatRunTime(player.fastestTimeMs)}
              </span>
            </button>
          </li>
        );
      })}
    </List>
  );
}

function PlayerList({
  inputId,
  searchQuery,
  setSearchQuery,
  isSearch,
  players,
  selectedPlayerId,
  onSelect,
  listClassName,
}: {
  inputId: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  isSearch: boolean;
  // Undefined while loading.
  players: PlayerListEntry[] | undefined;
  selectedPlayerId: Id<"players"> | null;
  onSelect: (player: PlayerListEntry) => void;
  listClassName: string;
}) {
  return (
    <>
      <label htmlFor={inputId} className="block font-semibold">
        Search every league
      </label>
      <input
        id={inputId}
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Player name"
        autoComplete="off"
        spellCheck={false}
        className="stat-slot mt-1 block h-12 w-full px-3 font-minecraft text-lg outline-none placeholder:text-home-muted/60"
      />
      <h2 className="mt-5 text-2xl font-bold">
        {isSearch ? "Search results" : "Fastest players"}
      </h2>
      <p className="mb-2 text-sm text-home-muted">
        {isSearch
          ? "Players from every league."
          : "The 20 best times across every league."}
      </p>
      <div
        className={cn("border-t border-obsidian-line/60 pr-1", listClassName)}
      >
        {players === undefined ? (
          <div aria-busy="true" className="mt-1 flex flex-col gap-1">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : (
          <PlayerRows
            players={players}
            selectedPlayerId={selectedPlayerId}
            onSelect={onSelect}
            isSearch={isSearch}
          />
        )}
      </div>
    </>
  );
}

// A side column on wide screens, and a sheet opened from a button on smaller ones.
export function StatsPlayerBrowser({
  fastestPlayers,
  selectedPlayer,
  onSelect,
}: {
  fastestPlayers: PlayerListEntry[] | undefined;
  selectedPlayer: PlayerListEntry | null;
  onSelect: (player: PlayerListEntry) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const normalizedSearchQuery = searchQuery.trim();
  const debouncedSearchQuery = useDebouncedValue(normalizedSearchQuery, 200);
  const isSearch = normalizedSearchQuery.length > 0;
  const searchResults = useQuery(
    api.players.searchPlayers,
    debouncedSearchQuery ? { searchTerm: debouncedSearchQuery } : "skip"
  );
  // Shows the loading rows until the results match what's typed.
  const players = isSearch
    ? debouncedSearchQuery === normalizedSearchQuery
      ? searchResults
      : undefined
    : fastestPlayers;
  const selectedPlayerId = selectedPlayer?.playerId ?? null;

  return (
    <>
      <aside
        aria-label="Find a player"
        className="sticky top-20 border-3 border-obsidian-line bg-obsidian-deep p-4 max-lg:hidden"
      >
        <PlayerList
          inputId="stats-player-search"
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearch={isSearch}
          players={players}
          selectedPlayerId={selectedPlayerId}
          onSelect={onSelect}
          listClassName="max-h-[calc(100svh-19rem)] overflow-y-auto"
        />
      </aside>

      <div className="lg:hidden">
        <Drawer autoFocus open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <DrawerTrigger className="flex h-12 w-full cursor-pointer items-center gap-3 border-3 border-obsidian-line bg-obsidian-deep px-3 text-left font-semibold transition-colors hover:bg-obsidian-raised">
            <Search aria-hidden className="size-5 text-home-muted" />
            <span className="flex-1">Find a player</span>
            <ChevronDown aria-hidden className="size-5 text-home-muted" />
          </DrawerTrigger>
          <DrawerContent className="obsidian-page">
            <DrawerTitle className="sr-only">Find a player</DrawerTitle>
            <div className="flex min-h-0 flex-col px-4 pt-4 pb-6">
              <PlayerList
                inputId="stats-player-search-sheet"
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearch={isSearch}
                players={players}
                selectedPlayerId={selectedPlayerId}
                onSelect={(player) => {
                  onSelect(player);
                  setIsSheetOpen(false);
                }}
                listClassName="max-h-[50svh] overflow-y-auto"
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
