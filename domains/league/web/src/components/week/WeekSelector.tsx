import { ChevronLeft, ChevronRight } from "lucide-react"
import { CustomButton } from "@/components/ui-custom/Button"

interface Week {
  weekNumber: number
  isActive: boolean
}

interface WeekSelectorProps {
  weeks: Week[] | undefined
  selectedWeekNumber: number | null
  onSelect: (weekNumber: number) => void
}

export function WeekSelector({
  weeks,
  selectedWeekNumber,
  onSelect,
}: WeekSelectorProps) {
  if (!weeks || weeks.length === 0 || selectedWeekNumber === null) {
    return <div className="h-10 w-48 animate-pulse rounded bg-muted"></div>
  }

  const currentIndex = weeks.findIndex((week) => week.weekNumber === selectedWeekNumber)
  const currentWeek = weeks[currentIndex]

  const hasNext = currentIndex > 0
  const hasPrev = currentIndex < weeks.length - 1

  const handlePrev = () => {
    if (hasPrev) onSelect(weeks[currentIndex + 1].weekNumber)
  }

  const handleNext = () => {
    if (hasNext) onSelect(weeks[currentIndex - 1].weekNumber)
  }

  return (
    <div className="flex items-center gap-4">
      <CustomButton
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        disabled={!hasPrev}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </CustomButton>

      <div className="min-w-30 text-center">
        <h3 className="text-lg font-medium tracking-tight text-foreground">
          Week {currentWeek.weekNumber}
        </h3>
      </div>

      <CustomButton
        variant="ghost"
        size="icon"
        onClick={handleNext}
        disabled={!hasNext}
        className="text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-5 w-5" />
      </CustomButton>
    </div>
  )
}
