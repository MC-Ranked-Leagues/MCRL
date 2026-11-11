import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { sortByAverage } from "@/lib/movement";
import { cn } from "@/lib/utils";
import { getWeekHref, isPlainClick } from "@/lib/weekRoutes";
import type { League, Week, WeekStanding } from "./weekData";

const PODIUM = [
  { place: 2, step: "h-20", head: "size-14" },
  { place: 1, step: "h-28", head: "size-16" },
  { place: 3, step: "h-16", head: "size-14" },
];

const ARROW =
  "flex size-10 shrink-0 items-center justify-center border-2 border-border transition-colors";
// Shared by the week picker and the league picker.
const PICKER_ITEM =
  "block border-2 py-1 text-center font-minecraft transition-colors";
const PICKER_ITEM_CURRENT =
  "border-primary bg-primary font-bold text-primary-foreground";
const PICKER_ITEM_OTHER =
  "border-border text-muted hover:border-muted hover:text-foreground";

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
  const played = standings?.filter((standing) => standing.rank !== null);
  // finished weeks with averages rank by them, older weeks by points.
  const ranked = played?.some((standing) => standing.averagePercentage !== null)
    ? sortByAverage(played)
    : played;
  // Only a finished week has a podium.
  const showsPodium = !isLive && ranked?.length !== 0;

  function weekArrow(week: Week | undefined, label: string, icon: ReactNode) {
    if (!week || leagueTier === null) {
      return (
        <span aria-hidden="true" className={cn(ARROW, "text-muted opacity-40")}>
          {icon}
        </span>
      );
    }
    return (
      <NavLink
        href={getWeekHref(week.weekNumber, leagueTier)}
        onNavigate={() => onNavigate(week.weekNumber, leagueTier)}
        aria-label={label}
        className={cn(ARROW, "hover:border-muted")}
      >
        {icon}
      </NavLink>
    );
  }

  return (
    <section>
      <div className="mx-auto grid max-w-page items-end gap-8 px-6 pt-22 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="pb-7">
          <div className="flex items-center gap-3">
            {weekArrow(
              older,
              "Previous week",
              <ChevronLeft className="size-5" />
            )}
            <h1 className="text-pixel-lg whitespace-nowrap text-shadow-none md:text-pixel-xl">
              {weeks && weekNumber !== null && leagueTier !== null ? (
                <Popover.Root
                  open={isPickerOpen}
                  onOpenChange={setIsPickerOpen}
                >
                  <Popover.Trigger className="group flex cursor-pointer items-center gap-2">
                    Week {weekNumber}
                    <ChevronDown
                      aria-hidden
                      className="size-5 text-muted transition-colors group-hover:text-foreground md:size-7"
                    />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner sideOffset={12} align="start">
                      <Popover.Popup className="z-50 border-2 border-border bg-background-deep p-3 font-display">
                        <Popover.Title className="mb-2 font-display text-sm text-muted text-shadow-none">
                          Jump to a week
                        </Popover.Title>
                        {/* Oldest first, so the newest week ends the grid. */}
                        <ul className="grid grid-cols-6 gap-1 text-base">
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
                                  PICKER_ITEM,
                                  "w-10",
                                  week.weekNumber === weekNumber
                                    ? PICKER_ITEM_CURRENT
                                    : PICKER_ITEM_OTHER
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
              <Skeleton aria-hidden className="h-7 w-12 md:h-10 md:w-18" />
            )}
            {weekArrow(newer, "Next week", <ChevronRight className="size-5" />)}
            {isLive && (
              <span className="ml-1 flex items-center gap-2 font-minecraft text-sm text-primary-hover uppercase pixel-shadow">
                <span aria-hidden className="size-2 bg-primary" />
                Live
              </span>
            )}
          </div>

          <nav aria-label="Leagues" className="mt-6 max-w-96">
            <p className="mb-1.5 text-sm font-semibold">League</p>
            {leagues && weekNumber !== null ? (
              <ul className="grid auto-cols-fr grid-flow-col gap-1">
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
                        PICKER_ITEM,
                        league.leagueTier === leagueTier
                          ? PICKER_ITEM_CURRENT
                          : PICKER_ITEM_OTHER
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
          </nav>
        </div>

        {/* Its fixed height keeps the page from shifting on weeks
            without one. */}
        <ol className="grid h-56 w-full grid-cols-3 items-end gap-1 max-lg:hidden">
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
                    <span className="mt-2 block truncate px-1 font-minecraft">
                      {standing.name}
                    </span>
                    <span
                      className={cn(
                        "mt-1.5 flex items-baseline justify-center gap-2 border-t-2 bg-background-raised pt-2.5 transition-colors group-hover:bg-border",
                        place === 1 ? "border-gold" : "border-border",
                        step
                      )}
                    >
                      <span
                        className={cn(
                          "font-minecraft text-pixel-md pixel-shadow",
                          place === 1 && "text-gold"
                        )}
                      >
                        {place}
                      </span>
                      <span className="font-minecraft text-sm text-muted">
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
