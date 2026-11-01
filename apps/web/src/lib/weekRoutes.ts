import type { MouseEvent } from "react";

export function getWeekHref(weekNumber: number, leagueTier: number) {
  return leagueTier === 1
    ? `/week/${weekNumber}`
    : `/week/${weekNumber}?league=${leagueTier}`;
}

function parseNumber(value: string | null | undefined) {
  const parsedValue = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function readWeekSelection() {
  if (typeof window === "undefined") {
    return { weekNumber: null, leagueTier: null };
  }

  const { pathname, searchParams } = new URL(window.location.href);
  return {
    // Old links use `/week/?week=30&league=1`.
    weekNumber: parseNumber(
      pathname.match(/^\/week\/(\d+)\/?$/)?.[1] ?? searchParams.get("week")
    ),
    leagueTier: parseNumber(searchParams.get("league")),
  };
}

// Lets ctrl-click and similar open the link's real URL in a new tab.
export function isPlainClick(event: MouseEvent) {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
