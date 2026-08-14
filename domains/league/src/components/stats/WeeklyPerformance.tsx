import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleMinus,
  Flag,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  formatDuration,
  movementLabel,
  type MatchDetail,
  type Movement,
  type WeeklyPerformance as WeeklyPerformanceData,
} from "./stats-utils"

function MovementBadge({ movement }: { movement: Movement }) {
  const label = movementLabel(movement)

  if (movement === "promoted") {
    return (
      <Badge className="border-primary/20 bg-primary/10 text-primary">
        <ArrowUp data-icon="inline-start" aria-hidden />
        {label}
      </Badge>
    )
  }

  if (movement === "demoted") {
    return (
      <Badge variant="destructive">
        <ArrowDown data-icon="inline-start" aria-hidden />
        {label}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      <CircleMinus data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  )
}

function getMatchStatus(match: MatchDetail) {
  if (match.missed) {
    return { label: "Missed", className: "text-muted-foreground" }
  }
  if (match.dnf) {
    return { label: "DNF", className: "text-destructive" }
  }
  if (match.placement !== null) {
    return { label: `#${match.placement}`, className: "text-foreground" }
  }
  return { label: "—", className: "text-muted-foreground" }
}

function MatchRow({ match }: { match: MatchDetail }) {
  const status = getMatchStatus(match)
  const hasFinish = !match.missed && !match.dnf
  const finishTime = hasFinish ? formatDuration(match.timeMs) : "—"

  return (
    <li className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border/60 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_5rem_7.5rem_5rem]">
      <div className="min-w-0">
        <p className="text-sm font-medium">Match {match.matchNumber}</p>
        <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
          {hasFinish ? finishTime : "No finish time"}
          <span aria-hidden> · </span>
          <span className="text-primary">+{match.pointsWon} pts</span>
        </p>
      </div>
      <span
        className={cn(
          "text-right font-minecraft text-xs tabular-nums sm:text-left",
          status.className
        )}
      >
        {status.label}
      </span>
      <span className="hidden text-sm text-muted-foreground tabular-nums sm:block">
        {finishTime}
      </span>
      <span className="hidden text-right text-sm font-medium text-primary tabular-nums sm:block">
        +{match.pointsWon} pts
      </span>
    </li>
  )
}

export function WeeklyPerformance({
  weeks,
}: {
  weeks: WeeklyPerformanceData[]
}) {
  const newestFirst = [...weeks].reverse()

  return (
    <section aria-labelledby="weekly-performance-heading">
      <div className="mb-3 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            History
          </p>
          <h3
            id="weekly-performance-heading"
            className="mt-1 font-minecraft text-base tracking-[0.08em] uppercase"
          >
            Weekly performance
          </h3>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
        </span>
      </div>

      {weeks.length === 0 ? (
        <Card className="items-center px-6 py-12 text-center">
          <Flag className="size-8 text-muted-foreground/55" aria-hidden />
          <div>
            <p className="font-medium">No weekly results yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This player does not have recorded match history.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          {newestFirst.map((week) => (
            <details
              key={week.weekNumber}
              className="group border-b border-border/70 last:border-b-0"
            >
              <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 px-4 py-4 transition-colors outline-none hover:bg-muted/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:px-5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href={`/week/?week=${week.weekNumber}&league=${week.leagueNumber}`}
                      className="hover:underline focus-visible:underline"
                    >
                      <h4 className="font-minecraft text-sm tracking-[0.08em] uppercase">
                        Week {week.weekNumber}
                      </h4>
                    </a>
                    <span className="text-xs text-muted-foreground">
                      {`League ${week.leagueNumber}`}
                    </span>
                    <MovementBadge movement={week.movement} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-4 sm:max-w-xl">
                    <div>
                      <dt className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Points
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-primary tabular-nums">
                        {week.totalPoints}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Average
                      </dt>
                      <dd className="mt-0.5 text-sm tabular-nums">
                        {formatDuration(week.averageTimeMs)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Matches
                      </dt>
                      <dd className="mt-0.5 text-sm tabular-nums">
                        {week.matches}
                      </dd>
                    </div>
                  </dl>
                </div>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>

              <div className="border-t border-border/60 bg-background/25 px-4 py-3 md:px-5">
                <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7.5rem_5rem] gap-4 pb-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:grid">
                  <span>Match</span>
                  <span>Status</span>
                  <span>Time</span>
                  <span className="text-right">Points</span>
                </div>
                <ul>
                  {week.matchDetails.map((match) => (
                    <MatchRow key={match.matchId} match={match} />
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </Card>
      )}
    </section>
  )
}
