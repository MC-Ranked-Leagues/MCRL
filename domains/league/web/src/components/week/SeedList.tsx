import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Seed = {
  order: number;
  overworld: string;
  nether: string;
  end: string;
  rng: string;
  type:
    | "BURIED_TREASURE"
    | "VILLAGE"
    | "DESERT_TEMPLE"
    | "RUINED_PORTAL"
    | "SHIPWRECK"
    | null;
};

const SEED_TYPE_LABELS: Record<NonNullable<Seed["type"]>, string> = {
  BURIED_TREASURE: "Buried Treasure",
  VILLAGE: "Village",
  DESERT_TEMPLE: "Desert Temple",
  RUINED_PORTAL: "Ruined Portal",
  SHIPWRECK: "Shipwreck",
};

const SeedList = ({
  weekNumber,
  leagueTier,
  showBorder = true,
}: {
  weekNumber: number | null;
  leagueTier: number | null;
  showBorder?: boolean;
}) => {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const fetchSeeds = useCallback(async () => {
    if (weekNumber === null || leagueTier === null) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const res = await fetch(
        `https://pastel-shrimp-251.convex.site/api/seeds/history?weekNumber=${weekNumber}&leagueNumber=${leagueTier}`
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setSeeds(data);
    } catch (err) {
      console.error("Error fetching seeds:", err);
      setSeeds([]);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [weekNumber, leagueTier]);

  useEffect(() => {
    fetchSeeds();
  }, [fetchSeeds]);

  if (weekNumber === null || leagueTier === null) {
    return null;
  }

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
