import { useEffect, useState } from "react";
import {
  SeedHistoryResponseSchema,
  type PublishedSeed,
} from "@/lib/seedHistoryResponse";

const SEED_API_URL = import.meta.env.PUBLIC_SEED_API_URL;
const NO_SEEDS = new Map<number, PublishedSeed>();

// Keyed by seed order, which matches the match number it was played in.
export function useSeedHistory(
  weekNumber: number | null,
  leagueTier: number | null
) {
  const [loaded, setLoaded] = useState<{
    key: string;
    seeds: Map<number, PublishedSeed>;
  } | null>(null);
  const key =
    weekNumber === null || leagueTier === null
      ? null
      : `${weekNumber}:${leagueTier}`;

  useEffect(() => {
    if (key === null) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const url = new URL("/api/seeds/history", SEED_API_URL);
        url.searchParams.set("weekNumber", String(weekNumber));
        url.searchParams.set("leagueNumber", String(leagueTier));
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const seeds = SeedHistoryResponseSchema.parse(await response.json());
        setLoaded({
          key,
          seeds: new Map(seeds.map((seed) => [seed.order, seed])),
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching seeds:", error);
        setLoaded({ key, seeds: NO_SEEDS });
      }
    })();

    return () => controller.abort();
  }, [key, weekNumber, leagueTier]);

  // Empty while loading or after a failure.
  return loaded?.key === key ? loaded.seeds : NO_SEEDS;
}
