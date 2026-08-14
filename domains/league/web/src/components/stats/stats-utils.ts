import type { FunctionReturnType } from "convex/server"
import type { api } from "../../../../convex/_generated/api"

export type PlayerListEntry =
  | FunctionReturnType<typeof api.leaderboard.getFastestPlayers>[number]
  | FunctionReturnType<typeof api.players.searchPlayers>[number]
export type PlayerStats = NonNullable<
  FunctionReturnType<typeof api.playerStats.getPlayerStats>
>
export type MatchDetail =
  PlayerStats["weeklyBreakdown"][number]["matchDetails"][number]
export type Movement = PlayerStats["leagueHistory"][number]["movement"]

export interface WeeklyPerformance {
  weekNumber: number
  leagueNumber: number
  movement: Movement
  matches: number
  totalPoints: number
  averageTimeMs: number | null
  matchDetails: MatchDetail[]
}

export function formatDuration(
  ms: number | null | undefined,
  includeMs = true
): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) {
    return "—"
  }

  const roundedMs = Math.round(ms)
  const totalSeconds = Math.floor(roundedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = roundedMs % 1000

  return `${minutes}:${String(seconds).padStart(2, "0")}${includeMs ? `.${String(milliseconds).padStart(3, "0")}` : ""}`
}

export function buildPlayerUrl(
  currentHref: string,
  playerName: string
): string {
  const url = new URL(currentHref)
  url.searchParams.delete("league")
  url.searchParams.set("player", playerName)
  return `${url.pathname}${url.search}${url.hash}`
}

export function mergeWeeklyPerformance(
  stats: PlayerStats
): WeeklyPerformance[] {
  const historyByWeek = new Map(
    stats.leagueHistory.map((entry) => [entry.weekNumber, entry])
  )

  return stats.weeklyBreakdown
    .map((week) => {
      const history = historyByWeek.get(week.weekNumber)

      return {
        weekNumber: week.weekNumber,
        leagueNumber: history?.leagueNumber ?? week.leagueNumber,
        movement: history?.movement ?? "none",
        matches: week.matches,
        totalPoints: week.totalPoints,
        averageTimeMs:
          week.averageTimeMs !== null && week.averageTimeMs > 0
            ? Math.round(week.averageTimeMs)
            : null,
        matchDetails: [...week.matchDetails].sort(
          (a, b) => a.matchNumber - b.matchNumber
        ),
      }
    })
    .sort((a, b) => a.weekNumber - b.weekNumber)
}

export function movementLabel(movement: Movement): string {
  switch (movement) {
    case "promoted":
      return "Promoted"
    case "demoted":
      return "Demoted"
    case "none":
      return "Stayed"
  }
}
