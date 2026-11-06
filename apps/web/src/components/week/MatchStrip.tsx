import { PlayerHead } from "@/components/PlayerHead";
import { cn } from "@/lib/utils";
import type { WeekMatch } from "./weekData";

// Each match's winner in a strip of matches
export function MatchStrip({
  matches,
  activeMatchNumber,
  onMatch,
}: {
  matches: WeekMatch[] | undefined;
  activeMatchNumber: number | null;
  onMatch: (matchNumber: number) => void;
}) {
  return (
    <nav
      aria-label="Matches"
      className="border-y-3 border-obsidian-line bg-obsidian-deep"
    >
      {!matches ? (
        <div className="h-14" aria-busy="true" />
      ) : matches.length === 0 ? (
        <p className="mx-auto flex h-14 max-w-page items-center px-6 text-home-muted">
          No matches played.
        </p>
      ) : (
        // The tiles' own padding brings their content in line with the page's
        // usual px-6 edge.
        <ol className="mx-auto flex max-w-page snap-x overflow-x-auto px-3">
          {matches.map((match) => {
            const isActive = match.matchNumber === activeMatchNumber;
            return (
              <li key={match._id} className="min-w-max flex-1 snap-start">
                <button
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onMatch(match.matchNumber)}
                  className={cn(
                    "flex h-full w-full cursor-pointer items-center gap-2 border-b-3 border-transparent px-3 py-2 text-left transition-colors hover:bg-obsidian-raised",
                    isActive && "border-lava bg-obsidian-raised"
                  )}
                >
                  <PlayerHead player={match.winnerUuid ?? match.winnerName} />
                  <span>
                    <span className="block font-minecraft text-sm text-home-gold">
                      Match {match.matchNumber}
                    </span>
                    <span className="block font-minecraft text-sm">
                      {match.winnerName}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
