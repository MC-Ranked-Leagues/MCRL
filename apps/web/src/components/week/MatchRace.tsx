import { PlayerHead } from "@/components/PlayerHead";
import { Skeleton } from "@/components/ui/skeleton";
import { useRankedMatch } from "@/hooks/use-ranked-match";
import { formatRunTime } from "@/lib/format";
import { buildRuns } from "@/lib/matchTimeline";
import {
  SEED_TYPE_LABELS,
  type PublishedSeed,
} from "@/lib/seedHistoryResponse";
import { cn } from "@/lib/utils";
import { PhaseBar, PhaseLegend } from "./PhaseBar";
import type { WeekMatch } from "./weekData";

export function MatchRace({
  match,
  seed,
  findPlayerId,
  onPlayer,
}: {
  match: WeekMatch;
  seed: PublishedSeed | undefined;
  findPlayerId: (uuid: string) => string | undefined;
  onPlayer: (playerId: string) => void;
}) {
  const rankedMatch = useRankedMatch(match.rankedMatchId);
  const runs = rankedMatch ? buildRuns(rankedMatch) : [];
  const scale = Math.max(...runs.map((run) => run.finalTime), 1);

  return (
    <>
      <h2 className="flex flex-wrap items-baseline gap-x-3 text-pixel-sm">
        Match {match.matchNumber}
        {seed?.type && (
          <span className="font-display text-base font-normal text-muted text-shadow-none">
            {SEED_TYPE_LABELS[seed.type]}
          </span>
        )}
      </h2>
      {seed && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">
            Seed for this match
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-sm">
            {(
              [
                ["Overworld", seed.overworld],
                ["Nether", seed.nether],
                ["End", seed.end],
                ["RNG", seed.rng],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="break-all tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {rankedMatch && <PhaseLegend />}

      <div className="mt-2">
        {rankedMatch === undefined ? (
          <div aria-busy="true" className="flex flex-col gap-1">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : rankedMatch === null ? (
          <p className="text-muted">
            {match.rankedMatchId
              ? "Couldn't load this match from Ranked. Reload to try again."
              : "This match has no Ranked timeline."}
          </p>
        ) : (
          <ol>
            {runs.map((run, index) => {
              const playerId = findPlayerId(run.uuid);
              const content = (
                <>
                  <span
                    className={cn(
                      "font-minecraft text-lg leading-none text-muted pixel-shadow",
                      run.isFinished ? "text-right" : "text-center"
                    )}
                  >
                    {run.isFinished ? index + 1 : "–"}
                  </span>
                  <PlayerHead player={run.uuid} />
                  {/* Inset by the transparent edge around the face image, so
                      the name and bar line up with the visible face. */}
                  <span className="flex h-8 min-w-0 flex-col justify-between py-px">
                    <span className="flex items-baseline justify-between gap-2 leading-none">
                      <span className="min-w-0 truncate font-minecraft">
                        {run.nickname}
                      </span>
                      <span className="text-sm whitespace-nowrap">
                        {/* Muted so an unfinished run's last time doesn't read
                            as a finish. */}
                        <span
                          className={cn(
                            "font-minecraft",
                            !run.isFinished && "text-muted"
                          )}
                        >
                          {formatRunTime(run.finalTime)}
                        </span>
                        {run.statusText && (
                          <span className="text-muted lowercase">
                            {" "}
                            {run.statusText}
                          </span>
                        )}
                      </span>
                    </span>
                    <PhaseBar blocks={run.blocks} scale={scale} />
                  </span>
                </>
              );
              const rowClass =
                "grid w-full grid-cols-[1.5rem_2rem_minmax(0,1fr)] items-center gap-x-2 py-1.5 pr-1 text-left";
              return (
                <li key={run.uuid}>
                  {playerId ? (
                    <button
                      type="button"
                      onClick={() => onPlayer(playerId)}
                      className={cn(
                        rowClass,
                        "cursor-pointer transition-colors hover:bg-background-raised"
                      )}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
