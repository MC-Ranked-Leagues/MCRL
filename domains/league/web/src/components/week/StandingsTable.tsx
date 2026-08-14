import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Id } from "../../../../convex/_generated/dataModel"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

interface StandingRow {
  rank: number | null
  playerId: Id<"players">
  name: string
  totalPoints: number
  movement?: "promoted" | "demoted" | "none" | null
}

interface StandingsTableProps {
  standings: StandingRow[] | undefined
  selectedPlayerId: string | null
  onPlayerClick: (playerId: string) => void
}

export function StandingsTable({
  standings,
  selectedPlayerId,
  onPlayerClick,
}: StandingsTableProps) {
  if (!standings) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (standings.length === 0) {
    return <div className="text-sm text-muted-foreground">No records found</div>
  }

  const firstUnrankedIndex = standings.findIndex((row) => row.rank === null)

  return (
    <div className="flex flex-col font-minecraft">
      {standings.map((row, index) => {
        const isSelected = selectedPlayerId === row.playerId

        return (
          <div key={row.playerId}>
            {index === firstUnrankedIndex && firstUnrankedIndex > 0 && (
              <div
                role="separator"
                className="mt-3 mb-1 flex items-center gap-3 px-4 text-[10px] tracking-wider text-muted-foreground/70 uppercase"
              >
                <span className="h-px flex-1 bg-border" />
                <span>Didn't show up</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onPlayerClick(row.playerId)}
              aria-pressed={isSelected}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-4 py-2 text-left transition-colors hover:bg-muted/50",
                row.rank === null && "text-muted-foreground",
                isSelected && "border border-border bg-muted/50"
              )}
            >
              <div className="flex items-center gap-4">
                <span
                  aria-hidden={row.rank === null}
                  className="w-6 text-center text-muted-foreground"
                >
                  {row.rank}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    row.movement === "promoted" && "text-green-400",
                    row.movement === "demoted" && "text-destructive"
                  )}
                >
                  {row.movement === "promoted" && (
                    <ArrowUpIcon className="size-4" />
                  )}
                  {row.movement === "demoted" && (
                    <ArrowDownIcon className="size-4" />
                  )}
                  {row.name}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-muted-foreground tabular-nums">
                  {row.totalPoints} pts
                </span>
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
