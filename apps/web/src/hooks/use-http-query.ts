import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ConvexHttpClient } from "convex/browser";
import {
  getFunctionName,
  makeFunctionReference,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";

// Bump only when the shape of a cached result changes, so a deploy doesn't
// throw away data that's still valid.
const CACHE_VERSION = 1;
const CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;

const httpClient = new ConvexHttpClient(import.meta.env.PUBLIC_CONVEX_URL);
const subscribeToNothing = () => () => {};

function readCache(key: string): unknown {
  try {
    const entry = JSON.parse(localStorage.getItem(key) ?? "null") as {
      version: number;
      savedAt: number;
      result: unknown;
    } | null;
    return entry?.version === CACHE_VERSION &&
      Date.now() - entry.savedAt < CACHE_LIFETIME_MS
      ? entry.result
      : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, result: unknown) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), result })
    );
  } catch {
    // Full or blocked storage only costs a refetch next time.
  }
}

// For data that doesn't need live updates, so it never opens a WebSocket. With
// `cache`, only results that aren't null are kept.
export function useHttpQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
  { cache = false }: { cache?: boolean } = {}
) {
  const functionName = getFunctionName(query);
  const argsJson = args === "skip" ? null : JSON.stringify(args);
  const key = argsJson === null ? null : `${functionName}:${argsJson}`;

  // The page's HTML has no results, so cached ones must wait for hydration.
  const isHydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
  const cached = useMemo(
    () => (cache && isHydrated && key !== null ? readCache(key) : undefined),
    [cache, isHydrated, key]
  );
  const [response, setResponse] = useState<{
    key: string;
    result?: unknown;
    failed?: boolean;
  } | null>(null);

  useEffect(() => {
    if (
      !isHydrated ||
      key === null ||
      argsJson === null ||
      cached !== undefined
    ) {
      return;
    }

    // A slower response for a previous selection must not overwrite this one.
    let isCurrent = true;
    httpClient
      .query(
        makeFunctionReference<"query">(functionName),
        JSON.parse(argsJson) as Record<string, never>
      )
      .then(
        (result: unknown) => {
          if (cache && result !== null) writeCache(key, result);
          if (isCurrent) setResponse({ key, result });
        },
        () => {
          if (isCurrent) setResponse({ key, failed: true });
        }
      );
    return () => {
      isCurrent = false;
    };
  }, [argsJson, cache, cached, functionName, isHydrated, key]);

  const current = response?.key === key ? response : null;
  return {
    data: (cached ?? current?.result) as FunctionReturnType<Query> | undefined,
    failed: current?.failed ?? false,
  };
}
