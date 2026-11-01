import { ChevronLeft, ChevronRight } from "lucide-react";
import { CustomButton } from "@/components/ui-custom/Button";
import { getWeekHref, isPlainClick } from "@/lib/weekRoutes";

interface Week {
  weekNumber: number;
  isActive: boolean;
}

interface WeekSelectorProps {
  weeks: Week[] | undefined;
  selectedWeekNumber: number | null;
  leagueTier: number | null;
  onSelect: (weekNumber: number, leagueTier: number) => void;
}

const ARROW_CLASS = "text-muted-foreground hover:text-foreground";

export function WeekSelector({
  weeks,
  selectedWeekNumber,
  leagueTier,
  onSelect,
}: WeekSelectorProps) {
  if (
    !weeks ||
    weeks.length === 0 ||
    selectedWeekNumber === null ||
    leagueTier === null
  ) {
    return <div className="h-10 w-48 animate-pulse rounded bg-muted"></div>;
  }

  const currentIndex = weeks.findIndex(
    (week) => week.weekNumber === selectedWeekNumber
  );
  const currentWeek = weeks[currentIndex];
  if (!currentWeek) {
    return <div className="h-10 w-48 animate-pulse rounded bg-muted"></div>;
  }

  const nextWeek = weeks[currentIndex - 1];
  const previousWeek = weeks[currentIndex + 1];

  const renderWeekLink = (
    week: Week | undefined,
    label: string,
    icon: React.ReactNode
  ) => {
    if (!week) {
      return (
        <CustomButton
          variant="ghost"
          size="icon"
          disabled
          aria-label={label}
          className={ARROW_CLASS}
        >
          {icon}
        </CustomButton>
      );
    }

    return (
      <CustomButton
        variant="ghost"
        size="icon"
        href={getWeekHref(week.weekNumber, leagueTier)}
        aria-label={label}
        className={ARROW_CLASS}
        onClick={(event: React.MouseEvent) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onSelect(week.weekNumber, leagueTier);
        }}
      >
        {icon}
      </CustomButton>
    );
  };

  return (
    <div className="flex items-center gap-4">
      {renderWeekLink(
        previousWeek,
        "Previous week",
        <ChevronLeft className="h-5 w-5" />
      )}

      <div className="min-w-30 text-center">
        <h3 className="text-lg font-medium tracking-tight text-foreground">
          Week {currentWeek.weekNumber}
        </h3>
      </div>

      {renderWeekLink(
        nextWeek,
        "Next week",
        <ChevronRight className="h-5 w-5" />
      )}
    </div>
  );
}
