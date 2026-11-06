import { useEffect, useEffectEvent, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@mcrl/backend/api";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { SITE_NAME } from "@/consts";
import { useHttpQuery } from "@/hooks/use-http-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSeedHistory } from "@/hooks/use-seed-history";
import {
  DEFAULT_LEAGUE_TIER,
  getWeekHref,
  readWeekSelection,
} from "@/lib/weekRoutes";
import { MatchRace } from "./MatchRace";
import { MatchStrip } from "./MatchStrip";
import { PlayerRuns } from "./PlayerRuns";
import { StandingsTable } from "./StandingsTable";
import { WeekHero } from "./WeekHero";

// Every week shares one HTML file, so each URL's details are set here.
function updatePageHead(weekNumber: number) {
  document.title = `Week ${weekNumber} Results | ${SITE_NAME}`;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      `Standings and matches for Week ${weekNumber} of ${SITE_NAME}.`
    );

  // Left out when `SITE_URL` isn't set, such as on preview deployments.
  if (!import.meta.env.SITE) return;
  let canonical = document.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = new URL(`/week/${weekNumber}`, import.meta.env.SITE).href;
}

function WeekContent() {
  const { data: weeks, failed: weeksFailed } = useHttpQuery(
    api.weekView.getAllWeeks,
    {}
  );
  const { data: leagues, failed: leaguesFailed } = useHttpQuery(
    api.leagues.listLeagues,
    {}
  );

  const [selection, setSelection] = useState(readWeekSelection);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [chosenMatchNumber, setChosenMatchNumber] = useState<number | null>(
    null
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // Below the side column's breakpoint the details open in a sheet instead.
  // Only one of them gets the details, so their requests aren't made twice.
  // Widening the window past it hides the sheet.
  const usesSheet = useIsMobile();

  function clearDetails() {
    setSelectedPlayerId(null);
    setChosenMatchNumber(null);
    setIsSheetOpen(false);
  }

  const onPopState = useEffectEvent(() => {
    setSelection(readWeekSelection());
    clearDetails();
  });
  useEffect(() => {
    const handlePopState = () => onPopState();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Weeks are sorted newest first.
  const newestWeekNumber = weeks?.[0]?.weekNumber ?? null;
  // Null until the lists load, so unknown weeks and leagues never get shown.
  const weekNumber = !weeks
    ? null
    : weeks.some((week) => week.weekNumber === selection.weekNumber)
      ? selection.weekNumber
      : newestWeekNumber;
  const leagueTier = !leagues
    ? null
    : leagues.some((league) => league.leagueTier === selection.leagueTier)
      ? selection.leagueTier
      : ((
          leagues.find((league) => league.leagueTier === DEFAULT_LEAGUE_TIER) ??
          leagues[0]
        )?.leagueTier ?? null);

  // Trusts the URL until the lists load, so an archived week's results don't
  // wait for them.
  const requestedWeek = weeks ? weekNumber : selection.weekNumber;
  const requestedLeague = leagues
    ? leagueTier
    : (selection.leagueTier ?? DEFAULT_LEAGUE_TIER);
  const isNewestWeek = requestedWeek === newestWeekNumber;
  const { data: archivedResults, failed: archivedResultsFailed } = useHttpQuery(
    api.weekView.getArchivedResults,
    requestedWeek !== null && requestedLeague !== null && !isNewestWeek
      ? { weekNumber: requestedWeek, leagueTier: requestedLeague }
      : "skip",
    { cache: true }
  );

  const liveArgs =
    weekNumber !== null &&
    leagueTier !== null &&
    (isNewestWeek || archivedResults === null)
      ? { weekNumber, leagueTier }
      : "skip";
  const liveStandings = useQuery(api.weekView.getWeekStandings, liveArgs);
  const liveMatches = useQuery(api.weekView.getWeekMatches, liveArgs);
  const standings = archivedResults?.standings ?? liveStandings;
  const matches = archivedResults?.matches ?? liveMatches;
  const seeds = useSeedHistory(weekNumber, leagueTier);
  const isArchived = archivedResults != null;
  const isLive =
    !isArchived &&
    (weeks?.find((week) => week.weekNumber === weekNumber)?.isActive ?? false);

  useEffect(() => {
    if (weekNumber === null || leagueTier === null) return;

    // Moves unknown weeks and leagues, and old links, onto the real URL.
    const href = getWeekHref(weekNumber, leagueTier);
    if (href !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", href);
    }
    updatePageHead(weekNumber);
  }, [weekNumber, leagueTier]);

  function navigate(nextWeekNumber: number, nextLeagueTier: number) {
    setSelection({ weekNumber: nextWeekNumber, leagueTier: nextLeagueTier });
    clearDetails();
    window.history.pushState(
      null,
      "",
      getWeekHref(nextWeekNumber, nextLeagueTier)
    );
  }

  // Falls back to the first match
  const match =
    matches?.find((entry) => entry.matchNumber === chosenMatchNumber) ??
    matches?.[0];
  const player = standings?.find(
    (standing) => standing.playerId === selectedPlayerId
  );

  function openSheet() {
    if (usesSheet) setIsSheetOpen(true);
  }

  function togglePlayer(playerId: string) {
    const isClosing = selectedPlayerId === playerId;
    setSelectedPlayerId(isClosing ? null : playerId);
    if (!isClosing) openSheet();
  }

  function showMatch(matchNumber: number) {
    setChosenMatchNumber(matchNumber);
    setSelectedPlayerId(null);
    openSheet();
  }

  const failed = weeksFailed || leaguesFailed || archivedResultsFailed;
  const details =
    player && weekNumber !== null && leagueTier !== null ? (
      <PlayerRuns
        standing={player}
        weekNumber={weekNumber}
        leagueTier={leagueTier}
        isArchived={isArchived}
        seeds={seeds}
        onMatch={showMatch}
      />
    ) : match ? (
      <MatchRace
        key={match._id}
        match={match}
        seed={seeds.get(match.matchNumber)}
        findPlayerId={(uuid) =>
          standings?.find((standing) => standing.uuid === uuid)?.playerId
        }
        onPlayer={togglePlayer}
      />
    ) : matches === undefined ? (
      <div aria-busy="true" className="flex flex-col gap-1">
        <Skeleton className="mb-3 h-8 w-40" />
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    ) : null;

  return (
    <>
      <WeekHero
        weeks={weeks}
        leagues={leagues}
        weekNumber={weekNumber}
        leagueTier={leagueTier}
        isLive={isLive}
        standings={failed ? [] : standings}
        onNavigate={navigate}
        onPlayer={togglePlayer}
      />

      {failed ? (
        <p className="mx-auto max-w-page px-6 py-8 text-home-muted">
          Couldn't load this week. Reload to try again.
        </p>
      ) : (
        <>
          <MatchStrip
            matches={matches}
            activeMatchNumber={player ? null : (match?.matchNumber ?? null)}
            onMatch={showMatch}
          />

          <div className="mx-auto grid max-w-page grid-cols-[minmax(0,1fr)] items-start gap-8 px-6 py-8 md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_27rem] lg:gap-20">
            <section>
              <StandingsTable
                standings={standings}
                leagueTier={leagueTier}
                isLive={isLive}
                selectedPlayerId={selectedPlayerId}
                onPlayer={togglePlayer}
              />
            </section>

            {/* Left out when there's no match to show. */}
            {matches?.length !== 0 && (
              <aside className="sticky top-20 border-3 border-obsidian-line bg-obsidian-deep p-4 max-md:hidden">
                {!usesSheet && details}
              </aside>
            )}
          </div>
        </>
      )}

      <Drawer
        open={usesSheet && isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setSelectedPlayerId(null);
        }}
      >
        <DrawerContent className="obsidian-page">
          <DrawerTitle className="sr-only">
            {player ? player.name : `Match ${match?.matchNumber}`}
          </DrawerTitle>
          <div className="overflow-y-auto px-4 pt-4 pb-6">
            {usesSheet && details}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function WeekPage() {
  return (
    <ConvexClientProvider>
      <WeekContent />
    </ConvexClientProvider>
  );
}
