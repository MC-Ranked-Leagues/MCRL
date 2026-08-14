import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Id } from "../../../convex/_generated/dataModel"
import { CrownIcon } from "lucide-react"

interface MatchRow {
  _id: Id<"matches">
  matchNumber: number
  winnerName: string
}

interface MatchesListProps {
  matches: MatchRow[] | undefined
  selectedMatchId: string | null
  onMatchClick: (matchId: string) => void
}

export function MatchesList({
  matches,
  selectedMatchId,
  onMatchClick,
}: MatchesListProps) {
  if (!matches) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (matches.length === 0) {
    return <div className="text-sm text-muted-foreground">No matches found</div>
  }

  return (
    <div className="flex flex-col font-minecraft">
      {matches.map((match) => {
        const isSelected = selectedMatchId === match._id

        return (
          <button
            key={match._id}
            onClick={() => onMatchClick(match._id)}
            className={cn(
              "flex items-center gap-6 rounded-md px-4 py-2 text-left transition-colors hover:bg-muted/50",
              isSelected && "bg-muted/50 text-foreground"
            )}
          >
            <span className="w-16 text-sm text-muted-foreground">
              Match {match.matchNumber}
            </span>
            <div className="flex items-center gap-2">
              <CrownIcon className="size-4 text-muted-foreground" />
              <span className="text-sm">{match.winnerName}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
