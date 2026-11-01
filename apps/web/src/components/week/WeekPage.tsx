import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@mcrl/backend/api";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { WeekSelector } from "./WeekSelector";
import { LeagueSelector } from "./LeagueSelector";
import { StandingsTable } from "./StandingsTable";
import { MatchesList } from "./MatchesList";
import { useHttpQuery } from "@/hooks/use-http-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getWeekHref, readWeekSelection } from "@/lib/weekRoutes";
import { cn } from "@/lib/utils";
import SeedList from "./SeedList";

const LazyDetailsPanel = lazy(async () => {
  const module = await import("./DetailsPanel");
  return { default: module.DetailsPanel };
});

function DetailsPanelFallback({ showBorder = true }: { showBorder?: boolean }) {
  return (
    <div
      className={[
        "min-h-75 p-6 text-sm text-muted-foreground",
        showBorder ? "rounded-3xl border border-border" : "",
      ].join(" ")}
    >
      Loading details...
    </div>
  );
}

// Every week shares one HTML file, so each URL's details are set here.
function updatePageHead(weekNumber: number) {
  document.title = `Week ${weekNumber} Results | Ranked Leagues`;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      `Standings and matches for Week ${weekNumber} of Ranked Leagues.`
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
  const isMobile = useIsMobile();
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
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState("standings");

  useEffect(() => {
    const handlePopState = () => {
      setSelection(readWeekSelection());
      setSelectedPlayerId(null);
      setSelectedMatchId(null);
      setIsDrawerOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const onDrawerChange = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) {
      setSelectedPlayerId(null);
      setSelectedMatchId(null);
    }
  };

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
      : ((leagues.find((league) => league.leagueTier === 1) ?? leagues[0])
          ?.leagueTier ?? null);

  // Trusts the URL until the lists load, so an archived week's results don't
  // wait for them.
  const requestedWeek = weeks ? weekNumber : selection.weekNumber;
  const requestedLeague = leagues ? leagueTier : (selection.leagueTier ?? 1);
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

  useEffect(() => {
    if (weekNumber === null || leagueTier === null) return;

    // Moves unknown weeks and leagues, and old links, onto the real URL.
    const href = getWeekHref(weekNumber, leagueTier);
    if (href !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", href);
    }
    updatePageHead(weekNumber);
  }, [weekNumber, leagueTier]);

  function onSelect(nextWeekNumber: number, nextLeagueTier: number) {
    setSelection({ weekNumber: nextWeekNumber, leagueTier: nextLeagueTier });
    setSelectedPlayerId(null);
    setSelectedMatchId(null);
    setIsDrawerOpen(false);
    window.history.pushState(
      null,
      "",
      getWeekHref(nextWeekNumber, nextLeagueTier)
    );
  }

  function handlePlayerClick(playerId: string) {
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      if (isMobile) setIsDrawerOpen(false);
    } else {
      setSelectedPlayerId(playerId);
      setSelectedMatchId(null);
      if (isMobile) setIsDrawerOpen(true);
    }
  }

  function handleMatchClick(matchId: string) {
    if (selectedMatchId === matchId) {
      setSelectedMatchId(null);
      if (isMobile) setIsDrawerOpen(false);
    } else {
      setSelectedMatchId(matchId);
      setSelectedPlayerId(null);
      if (isMobile) setIsDrawerOpen(true);
    }
  }

  const standingsByPlayerId = useMemo(
    () =>
      new Map(
        (standings ?? []).map((standing) => [
          String(standing.playerId),
          standing,
        ])
      ),
    [standings]
  );
  const matchesById = useMemo(
    () => new Map((matches ?? []).map((match) => [String(match._id), match])),
    [matches]
  );
  const selectedPlayer =
    selectedPlayerId !== null
      ? standingsByPlayerId.get(selectedPlayerId)
      : null;
  const selectedMatch =
    selectedMatchId !== null ? matchesById.get(selectedMatchId) : null;

  const isArchived = archivedResults != null;
  const detailsPanelProps = useMemo(
    () => ({
      weekNumber,
      leagueTier,
      isArchived,
      playerId: selectedPlayerId,
      matchId: selectedMatchId,
      rankedMatchId: selectedMatch?.rankedMatchId ?? null,
      playerStats: selectedPlayer
        ? {
            name: selectedPlayer.name,
            totalPoints: selectedPlayer.totalPoints,
            rank: selectedPlayer.rank,
            averagePercentage: selectedPlayer.averagePercentage,
            projected: selectedPlayer.projected,
          }
        : null,
    }),
    [
      isArchived,
      leagueTier,
      weekNumber,
      selectedMatch,
      selectedMatchId,
      selectedPlayer,
      selectedPlayerId,
    ]
  );
  const hasDetailsSelection =
    detailsPanelProps.playerId !== null || detailsPanelProps.matchId !== null;

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 font-sans text-foreground md:pt-28">
      <div className="container mx-auto max-w-7xl px-4 md:px-8">
        <div className="mb-4 flex flex-col justify-between gap-4 border-b border-border/40 pb-4 md:flex-row md:items-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Weekly Leaderboards
          </h1>
          <WeekSelector
            weeks={weeks}
            selectedWeekNumber={weekNumber}
            leagueTier={leagueTier}
            onSelect={onSelect}
          />
        </div>

        <div className="mb-8">
          <LeagueSelector
            leagues={leagues}
            selectedLeagueTier={leagueTier}
            weekNumber={weekNumber}
            onSelect={onSelect}
          />
        </div>

        {weeksFailed || leaguesFailed || archivedResultsFailed ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load this week. Reload to try again.
          </p>
        ) : (
          <>
            {/* One copy of each list, laid out with CSS so the page's HTML is
                right on every screen size before hydration. */}
            <Tabs
              value={mobileTab}
              onValueChange={setMobileTab}
              className="w-full md:hidden"
            >
              <TabsList className="mt-4 mb-4 w-full justify-start rounded-none border-b bg-transparent p-0">
                <TabsTrigger
                  value="standings"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Standings
                </TabsTrigger>
                <TabsTrigger
                  value="matches"
                  className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  Matches
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="md:mt-4 md:flex md:min-h-150 md:items-start md:gap-8 lg:gap-16">
              <div className="md:flex md:flex-1 md:flex-row md:items-start md:gap-8 lg:gap-16">
                <div
                  className={cn(
                    "max-md:text-sm md:flex md:w-[320px] md:shrink-0 md:flex-col md:gap-4",
                    mobileTab !== "standings" && "max-md:hidden"
                  )}
                >
                  <StandingsTable
                    standings={standings}
                    selectedPlayerId={selectedPlayerId}
                    onPlayerClick={handlePlayerClick}
                  />
                </div>

                <div
                  className={cn(
                    "max-md:text-sm md:flex md:w-75 md:shrink-0 md:flex-col md:gap-2",
                    mobileTab !== "matches" && "max-md:hidden"
                  )}
                >
                  <MatchesList
                    matches={matches}
                    selectedMatchId={selectedMatchId}
                    onMatchClick={handleMatchClick}
                  />
                </div>
              </div>

              <div className="sticky top-24 w-125 shrink-0 max-md:hidden">
                {/* Hidden on phones, so skip its requests there too. */}
                {!isMobile &&
                  (hasDetailsSelection ? (
                    <Suspense fallback={<DetailsPanelFallback />}>
                      <LazyDetailsPanel {...detailsPanelProps} />
                    </Suspense>
                  ) : (
                    <SeedList weekNumber={weekNumber} leagueTier={leagueTier} />
                  ))}
              </div>
            </div>
          </>
        )}

        {isMobile && (
          <Drawer open={isDrawerOpen} onOpenChange={onDrawerChange}>
            <DrawerContent>
              <DrawerHeader className="border-b border-border/40 px-6 pb-4">
                <DrawerTitle className="font-minecraft text-xl">
                  {selectedPlayerId ? "Player Details" : "Match Details"}
                </DrawerTitle>
              </DrawerHeader>
              <div className="h-full overflow-y-auto px-6 py-4 pb-12">
                {hasDetailsSelection ? (
                  <Suspense
                    fallback={<DetailsPanelFallback showBorder={false} />}
                  >
                    <LazyDetailsPanel
                      {...detailsPanelProps}
                      showBorder={false}
                    />
                  </Suspense>
                ) : null}
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </div>
  );
}

export function WeekPage() {
  return (
    <ConvexClientProvider>
      <WeekContent />
    </ConvexClientProvider>
  );
}
