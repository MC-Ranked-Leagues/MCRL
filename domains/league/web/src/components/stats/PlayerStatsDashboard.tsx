import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Activity, Clock3, Trophy, UserRoundX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AverageTimeTrend } from "./AverageTimeTrend"
import { WeeklyPerformance } from "./WeeklyPerformance"
import {
  formatDuration,
  mergeWeeklyPerformance,
  type PlayerStats,
} from "./stats-utils"

interface PlayerStatsDashboardProps {
  stats: PlayerStats | null | undefined
}

type RankedEloState =
  | { playerName: string; status: "success"; elo: number | null }
  | { playerName: string; status: "error" }

function useRankedElo(
  playerName: string | undefined
): RankedEloState | { status: "loading" } {
  const [state, setState] = useState<RankedEloState | null>(null)

  useEffect(() => {
    if (!playerName) return

    const controller = new AbortController()

    void fetch(
      `https://api.mcsrranked.com/users/${encodeURIComponent(playerName)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`MCSR Ranked returned ${response.status}`)

        const payload: unknown = await response.json()
        if (
          !payload ||
          typeof payload !== "object" ||
          !("status" in payload) ||
          payload.status !== "success" ||
          !("data" in payload) ||
          !payload.data ||
          typeof payload.data !== "object" ||
          !("eloRate" in payload.data) ||
          (typeof payload.data.eloRate !== "number" &&
            payload.data.eloRate !== null)
        ) {
          throw new Error("MCSR Ranked returned an unexpected response")
        }

        setState({
          playerName,
          status: "success",
          elo: payload.data.eloRate,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setState({ playerName, status: "error" })
      })

    return () => controller.abort()
  }, [playerName])

  if (state && state.playerName === playerName) return state
  return { status: "loading" }
}

function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between border-b px-4 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
      <div className="mt-3 min-w-0">
        <p className="truncate font-minecraft text-xl tracking-tight tabular-nums md:text-2xl">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <p className="sr-only" role="status">
        Loading player statistics.
      </p>
      <Card className="gap-0 py-0" aria-hidden="true">
        <CardContent className="px-5 py-6 md:px-7">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-9 w-52" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardContent>
        <CardContent className="grid border-t p-0 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="border-b p-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
            >
              <Skeleton className="h-20" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Skeleton className="h-88 rounded-xl" aria-hidden="true" />
      <Skeleton className="h-64 rounded-xl" aria-hidden="true" />
    </div>
  )
}

export function PlayerStatsDashboard({ stats }: PlayerStatsDashboardProps) {
  const weeks = useMemo(
    () => (stats ? mergeWeeklyPerformance(stats) : []),
    [stats]
  )
  const rankedElo = useRankedElo(stats?.name)

  if (stats === undefined) return <DashboardSkeleton />

  if (stats === null) {
    return (
      <Card className="min-h-80 items-center justify-center px-6 py-12 text-center">
        <UserRoundX className="size-10 text-muted-foreground/55" aria-hidden />
        <div>
          <h2 className="font-minecraft text-lg tracking-[0.08em] uppercase">
            Statistics unavailable
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            This player record is no longer available. Select another player to
            continue.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="min-w-0 space-y-5">
      <Card className="gap-0 py-0">
        <CardContent className="px-5 py-6 md:px-7 md:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col items-baseline gap-1 sm:flex-row md:gap-4">
              <h2 className="mt-2 truncate font-minecraft text-3xl tracking-tight uppercase md:text-4xl">
                {stats.name}
              </h2>
              <div className="mt-0 flex flex-wrap items-center gap-2 sm:mt-3">
                {rankedElo.status === "loading" ? (
                  <Skeleton className="h-10 w-24" />
                ) : (
                  <span className="font-minecraft text-xl text-primary tabular-nums md:text-2xl">
                    (
                    {rankedElo.status === "success" && rankedElo.elo !== null
                      ? rankedElo.elo
                      : "—"}{" "}
                    elo)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-2 self-end font-minecraft text-xl tracking-tight text-muted-foreground uppercase max-sm:-mt-6 md:text-2xl">
              {stats.currentLeague}
            </div>
          </div>
        </CardContent>
        <CardContent
          className="grid border-t p-0 sm:grid-cols-3"
          aria-label="Player summary"
        >
          <Metric
            icon={<Activity className="size-4" aria-hidden />}
            label="Matches played"
            value={String(stats.summary.totalMatches)}
            note="Recorded results"
          />
          <Metric
            icon={<Clock3 className="size-4" aria-hidden />}
            label="Average time"
            value={formatDuration(stats.summary.avgTimeMs)}
            note="Across recorded weeks"
          />
          <Metric
            icon={<Trophy className="size-4" aria-hidden />}
            label="Best time"
            value={formatDuration(stats.summary.bestTimeMs)}
            note="Fastest completion"
          />
        </CardContent>
      </Card>

      <AverageTimeTrend weeks={weeks} />
      <WeeklyPerformance weeks={weeks} />
    </div>
  )
}
