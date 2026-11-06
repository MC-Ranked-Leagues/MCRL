import { useEffect, useSyncExternalStore } from "react";
import { mcsrranked, type MatchDetail } from "mcsrranked-sdk";

// Kept for the whole visit, so going back to a match doesn't fetch it again.
// Null marks a failed request, which isn't retried until the page reloads.
const matches = new Map<string, MatchDetail | null>();
const requested = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function requestMatch(rankedMatchId: string) {
  if (requested.has(rankedMatchId)) return;
  requested.add(rankedMatchId);

  const save = (match: MatchDetail | null) => {
    matches.set(rankedMatchId, match);
    for (const listener of listeners) listener();
  };
  mcsrranked.matches.get(Number(rankedMatchId)).then(save, (error: unknown) => {
    console.error("Error fetching Ranked match:", error);
    save(null);
  });
}

// Undefined while the match is loading, and null without an ID or after a
// failure.
export function useRankedMatch(rankedMatchId: string | null) {
  useEffect(() => {
    if (rankedMatchId !== null) requestMatch(rankedMatchId);
  }, [rankedMatchId]);

  return useSyncExternalStore(
    subscribe,
    () => (rankedMatchId === null ? null : matches.get(rankedMatchId)),
    () => undefined
  );
}
