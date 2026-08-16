import {
  SeedHistoryResponseSchema,
  type PublishedSeed,
} from "@mcrl/contracts/seed-history";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SeedLoadState = {
  requestKey: string;
  status: "success" | "error";
  seeds: PublishedSeed[];
};

const SEED_TYPE_LABELS: Record<NonNullable<PublishedSeed["type"]>, string> = {
  BURIED_TREASURE: "Buried Treasure",
  VILLAGE: "Village",
  DESERT_TEMPLE: "Desert Temple",
  JUNGLE_PYRAMID: "Jungle Pyramid",
  RUINED_PORTAL: "Ruined Portal",
  SHIPWRECK: "Shipwreck",
};

const SEED_API_URL = import.meta.env.PUBLIC_SEED_API_URL;

const SeedList = ({
  weekNumber,
  leagueTier,
  showBorder = true,
}: {
  weekNumber: number | null;
  leagueTier: number | null;
  showBorder?: boolean;
}) => {
  const [loadState, setLoadState] = useState<SeedLoadState | null>(null);
  const requestKey =
    weekNumber === null || leagueTier === null
      ? null
      : `${weekNumber}:${leagueTier}`;

  useEffect(() => {
    if (weekNumber === null || leagueTier === null) return;

    const controller = new AbortController();
    const currentRequestKey = `${weekNumber}:${leagueTier}`;

    void (async () => {
      try {
        const url = new URL("/api/seeds/history", SEED_API_URL);
        url.searchParams.set("weekNumber", String(weekNumber));
        url.searchParams.set("leagueNumber", String(leagueTier));

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const rawData: unknown = await response.json();
        const seeds = SeedHistoryResponseSchema.parse(rawData);
        setLoadState({
          requestKey: currentRequestKey,
          status: "success",
          seeds,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Error fetching seeds:", error);
        setLoadState({
          requestKey: currentRequestKey,
          status: "error",
          seeds: [],
        });
      }
    })();

    return () => controller.abort();
  }, [weekNumber, leagueTier]);

  if (weekNumber === null || leagueTier === null) {
    return null;
  }

  const currentLoadState =
    loadState?.requestKey === requestKey ? loadState : null;
  const isLoading = currentLoadState === null;
  const hasError = currentLoadState?.status === "error";
  const seeds = currentLoadState?.seeds ?? [];

  return (
    <div
      className={cn(
        "p-0 md:bg-muted/10 md:p-4 lg:p-8",
        showBorder && "rounded-3xl border border-border"
      )}
    >
      <div className="mb-6 flex items-center justify-between border-b border-border/50 pb-6">
        <span className="text-xl tracking-widest text-foreground">Seeds</span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : hasError ? (
        <div className="py-4 text-sm text-muted-foreground opacity-50">
          Couldn't load seeds...
        </div>
      ) : seeds.length === 0 ? (
        <div className="py-4 text-sm text-muted-foreground opacity-50">
          No seeds published yet...
        </div>
      ) : (
        <div className="flex flex-col font-minecraft">
          <div className="flex flex-col gap-4">
            {seeds.map((seed) => (
              <div
                key={seed.order}
                className="flex flex-col gap-2 border-b border-border/50 pb-4 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">
                    Seed {seed.order}
                  </span>
                  {seed.type ? (
                    <span className="text-xs text-muted-foreground">
                      {SEED_TYPE_LABELS[seed.type]}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>OW: {seed.overworld}</span>
                  <span>Nether: {seed.nether}</span>
                  <span>End: {seed.end}</span>
                  <span>RNG: {seed.rng}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedList;
