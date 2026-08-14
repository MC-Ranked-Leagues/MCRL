import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

interface League {
  leagueTier: number
  name: string
}

interface LeagueSelectorProps {
  leagues: League[] | undefined
  selectedLeagueTier: number | null
  onSelect: (leagueTier: number) => void
  isMobile?: boolean
}

export function LeagueSelector({
  leagues,
  selectedLeagueTier,
  onSelect,
  isMobile,
}: LeagueSelectorProps) {
  if (!leagues || selectedLeagueTier === null) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-10 w-45 rounded-md" />
      </div>
    )
  }

  if (leagues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No leagues available.</p>
    )
  }

  const selectedLeague = leagues.find(
    (league) => league.leagueTier === selectedLeagueTier
  )

  if (isMobile) {
    return (
      <div className="w-full">
        <Select
          value={String(selectedLeagueTier)}
          onValueChange={(value) => onSelect(Number(value))}
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
    )
  }

  return (
    <Tabs
      value={String(selectedLeagueTier)}
      onValueChange={(value) => onSelect(Number(value))}
    >
      <TabsList variant="line" className="flex-wrap bg-transparent">
        {leagues.map((league) => (
          <TabsTrigger
            key={league.leagueTier}
            value={String(league.leagueTier)}
            className="font-minecraft text-xs tracking-wider uppercase"
          >
            {league.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
