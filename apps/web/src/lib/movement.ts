export type Movement = "promoted" | "demoted" | "none";

// The move to show for a week's standing, or null when there's nothing to say.
// League 7 only moves players once the week is over, so during a live week a
// plain "none" that isn't projected says nothing yet.
export function visibleMovement(
  standing: {
    rank: number | null;
    movement: Movement | null;
    projected: boolean;
  },
  isLive: boolean
) {
  if (standing.rank === null || standing.movement === null) return null;
  if (standing.movement === "none" && isLive && !standing.projected) {
    return null;
  }
  return standing.movement;
}

// The UI only ever says promoted, demoted or stayed.
export function movementLabel(movement: Movement) {
  if (movement === "promoted") return "Promoted";
  if (movement === "demoted") return "Demoted";
  return "Stayed";
}

// An edge bar in the full color keeps the tint readable at a glance.
export const MOVE_TINTS: Record<Movement, string> = {
  promoted: "bg-promoted-tint shadow-[inset_3px_0_0_var(--color-promoted)]",
  demoted: "bg-demoted-tint shadow-[inset_3px_0_0_var(--color-demoted)]",
  none: "",
};

type AveragedStanding = {
  rank: number | null;
  movement: Movement | null;
  averagePercentage: number | null;
};

function movementGroup(standing: AveragedStanding) {
  // The weekly winner takes the first promotion slot regardless of average.
  if (standing.rank === 1 && standing.movement === "promoted") return 0;
  if (standing.movement === "promoted") return 1;
  if (standing.movement === "demoted") return 3;
  return 2;
}

// Average decides the other moves, so sorting by it puts each kind of move in
// a block.
export function sortByAverage<T extends AveragedStanding>(standings: T[]) {
  return [...standings].sort(
    (a, b) =>
      movementGroup(a) - movementGroup(b) ||
      (b.averagePercentage ?? 0) - (a.averagePercentage ?? 0)
  );
}
