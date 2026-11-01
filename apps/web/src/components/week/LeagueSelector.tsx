import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getWeekHref, isPlainClick } from "@/lib/weekRoutes";

interface League {
  leagueTier: number;
  name: string;
}

interface LeagueSelectorProps {
  leagues: League[] | undefined;
  selectedLeagueTier: number | null;
  weekNumber: number | null;
  onSelect: (weekNumber: number, leagueTier: number) => void;
}

export function LeagueSelector({
  leagues,
  selectedLeagueTier,
  weekNumber,
  onSelect,
}: LeagueSelectorProps) {
  if (!leagues || selectedLeagueTier === null || weekNumber === null) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-10 w-45 rounded-md" />
      </div>
    );
  }

  if (leagues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No leagues available.</p>
    );
  }

  const selectedLeague = leagues.find(
    (league) => league.leagueTier === selectedLeagueTier
  );

  return (
    <>
      <div className="w-full md:hidden">
        <Select
          value={String(selectedLeagueTier)}
          onValueChange={(value) => onSelect(weekNumber, Number(value))}
        >
          <SelectTrigger className="mx-auto w-full font-minecraft text-xs tracking-wider uppercase">
            <SelectValue placeholder="Select League">
              {selectedLeague?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {leagues.map((league) => (
              <SelectItem
                key={league.leagueTier}
                value={String(league.leagueTier)}
                className="font-minecraft text-xs tracking-wider uppercase"
              >
                {league.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={String(selectedLeagueTier)} className="max-md:hidden">
        <TabsList variant="line" className="flex-wrap bg-transparent">
          {leagues.map((league) => (
            <TabsTrigger
              key={league.leagueTier}
              value={String(league.leagueTier)}
              className="font-minecraft text-xs tracking-wider uppercase"
              nativeButton={false}
              render={
                <a
                  href={getWeekHref(weekNumber, league.leagueTier)}
                  onClick={(event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    onSelect(weekNumber, league.leagueTier);
                  }}
                />
              }
            >
              {league.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}
