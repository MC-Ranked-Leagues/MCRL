import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getWeekHref, isPlainClick } from "@/lib/weekRoutes";
import type { League, Week, WeekStanding } from "./weekData";

const PODIUM = [
  { place: 2, step: "h-24", head: "size-16" },
  { place: 1, step: "h-32", head: "size-20" },
  { place: 3, step: "h-20", head: "size-16" },
];

const ARROW =
  "flex size-10 shrink-0 items-center justify-center border-3 border-obsidian-line transition-colors";

export function WeekHero({
  weeks,
  leagues,
  weekNumber,
  leagueTier,
  isLive,
  standings,
  onNavigate,
  onPlayer,
}: {
  weeks: Week[] | undefined;
  leagues: League[] | undefined;
  weekNumber: number | null;
  leagueTier: number | null;
  isLive: boolean;
  standings: WeekStanding[] | undefined;
  onNavigate: (weekNumber: number, leagueTier: number) => void;
  onPlayer: (playerId: string) => void;
}) {
  // Weeks are sorted newest first.
  const index = weeks?.findIndex((week) => week.weekNumber === weekNumber);
  const older = index === undefined ? undefined : weeks?.[index + 1];
  const newer =
    index === undefined || index < 1 ? undefined : weeks?.[index - 1];
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const ranked = standings?.filter((standing) => standing.rank !== null);
  // Only a finished week has a podium.
  const showsPodium = !isLive && ranked?.length !== 0;

  function weekArrow(week: Week | undefined, label: string, icon: ReactNode) {
    if (!week || leagueTier === null) {
      return (
        <span aria-hidden="true" className={cn(ARROW, "opacity-30")}>
          {icon}
        </span>
      );
    }
    return (
      <NavLink
        href={getWeekHref(week.weekNumber, leagueTier)}
        onNavigate={() => onNavigate(week.weekNumber, leagueTier)}
        aria-label={label}
        className={cn(ARROW, "hover:bg-obsidian-raised")}
      >
        {icon}
      </NavLink>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <img
        src="/images/4.webp"
        alt=""
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-r from-obsidian/95 via-obsidian/70 to-obsidian/50" />
      <div className="absolute inset-0 bg-linear-to-t from-obsidian-deep to-transparent to-40%" />

      <div className="relative mx-auto grid max-w-page items-end gap-8 px-6 pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <div className="pb-8">
          <div className="flex items-center gap-3">
            {weekArrow(
              older,
              "Previous week",
              <ChevronLeft className="size-5" />
            )}
            <h1 className="text-4xl leading-none font-bold whitespace-nowrap md:text-6xl">
              {weeks && weekNumber !== null && leagueTier !== null ? (
                <Popover.Root
                  open={isPickerOpen}
                  onOpenChange={setIsPickerOpen}
                >
                  <Popover.Trigger className="flex cursor-pointer items-center gap-2 transition-colors hover:text-gold">
                    Week {weekNumber}
                    <ChevronDown aria-hidden className="size-6 md:size-8" />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner sideOffset={12} align="start">
                      <Popover.Popup className="z-50 border-3 border-obsidian-line bg-obsidian-deep p-3">
                        <Popover.Title className="mb-2 text-sm text-muted">
                          Jump to a week
                        </Popover.Title>
                        {/* Oldest first, so the newest week ends the grid. */}
                        <ul className="grid grid-cols-6 gap-1 font-minecraft">
                          {weeks.toReversed().map((week) => (
                            <li key={week.weekNumber}>
                              <NavLink
                                href={getWeekHref(week.weekNumber, leagueTier)}
                                onNavigate={() => {
                                  setIsPickerOpen(false);
                                  onNavigate(week.weekNumber, leagueTier);
                                }}
                                aria-current={
                                  week.weekNumber === weekNumber
                                    ? "page"
                                    : undefined
                                }
                                className={cn(
                                  "block w-10 py-1.5 text-center text-base transition-colors",
                                  week.weekNumber === weekNumber
                                    ? "bg-lava font-bold text-lava-ink"
                                    : "bg-obsidian-raised text-muted hover:text-foreground"
                                )}
                              >
                                {week.weekNumber}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              ) : (
                <>Week{weekNumber !== null && ` ${weekNumber}`}</>
              )}
            </h1>
            {/* Every week shares one prerendered page, so the number only shows
                once the week list confirms it. */}
            {weekNumber === null && (
              <Skeleton aria-hidden className="h-9 w-12 md:h-14 md:w-20" />
            )}
            {weekArrow(newer, "Next week", <ChevronRight className="size-5" />)}
            {isLive && (
              <span className="font-minecraft text-sm text-gold">Live</span>
            )}
          </div>

          <nav aria-label="Leagues" className="mt-6 max-w-96">
            {leagues && weekNumber !== null ? (
              <ul className="grid auto-cols-fr grid-flow-col gap-1 font-minecraft">
                {leagues.map((league) => (
                  <li key={league.leagueTier}>
                    <NavLink
                      href={getWeekHref(weekNumber, league.leagueTier)}
                      onNavigate={() =>
                        onNavigate(weekNumber, league.leagueTier)
                      }
                      aria-label={league.name}
                      aria-current={
                        league.leagueTier === leagueTier ? "page" : undefined
                      }
                      className={cn(
                        "block py-1.5 text-center transition-colors",
                        league.leagueTier === leagueTier
                          ? "bg-lava font-bold text-lava-ink"
                          : "bg-obsidian-raised text-muted hover:text-foreground"
                      )}
                    >
                      {league.leagueTier}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton className="h-9" />
            )}
            <p className="mt-1 flex justify-between text-xs text-muted">
              <span>Fastest</span>
              <span>Slowest</span>
            </p>
          </nav>
        </div>

        {/* Its fixed height keeps the page from shifting on weeks
            without one. */}
        <ol className="grid h-64 w-full grid-cols-3 items-end gap-1 max-lg:hidden">
          {showsPodium &&
            PODIUM.map(({ place, step, head }) => {
              const standing = ranked?.[place - 1];
              if (!ranked) {
                return (
                  <li key={place} aria-hidden="true">
                    <Skeleton className={step} />
                  </li>
                );
              }
              if (!standing) return <li key={place} />;
              return (
                <li key={place} className="min-w-0 text-center">
                  <button
                    type="button"
                    onClick={() => onPlayer(standing.playerId)}
                    className="group block w-full cursor-pointer"
                  >
                    <PlayerHead
                      player={standing.uuid}
                      className={cn("mx-auto", head)}
                    />
                    <span className="mt-2 block truncate font-minecraft">
                      {standing.name}
                    </span>
                    <span
                      className={cn(
                        "mt-1 flex flex-col items-center justify-start border-x-3 border-t-3 border-obsidian-line bg-obsidian-deep/90 pt-2 font-minecraft transition-colors group-hover:bg-obsidian-raised",
                        step
                      )}
                    >
                      <span
                        className={cn(
                          "text-3xl leading-none font-bold",
                          place === 1 ? "text-gold" : "text-foreground"
                        )}
                      >
                        {place}
                      </span>
                      <span className="mt-1 text-sm text-muted">
                        {standing.totalPoints} pts
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
        </ol>
      </div>
    </section>
  );
}

// A real link, so crawlers can follow it, that changes the page in place on a
// plain click.
function NavLink({
  onNavigate,
  ...props
}: ComponentProps<"a"> & { onNavigate: () => void }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onNavigate();
      }}
    />
  );
}
