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
