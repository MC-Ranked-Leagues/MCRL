import type { Doc } from "../_generated/dataModel";

type WeekStandingRegistration = Pick<
  Doc<"registrations">,
  "averageTimeMs" | "playerIgn" | "totalPoints"
>;

export function compareWeekStandingRegistrations(
  a: WeekStandingRegistration,
  b: WeekStandingRegistration
): number {
  if (a.averageTimeMs === null && b.averageTimeMs !== null) return 1;
  if (a.averageTimeMs !== null && b.averageTimeMs === null) return -1;

  if (a.averageTimeMs !== null && b.averageTimeMs !== null) {
    const pointsDiff = b.totalPoints - a.totalPoints;
    if (pointsDiff !== 0) return pointsDiff;

    const averageTimeDiff = a.averageTimeMs - b.averageTimeMs;
    if (averageTimeDiff !== 0) return averageTimeDiff;
  }

  return a.playerIgn.localeCompare(b.playerIgn);
}

interface ProjectionParticipant {
  totalPoints: number;
  history: readonly number[];
}

interface ProjectedMovement {
  currentPercentage: number;
  averagePercentage: number;
  movement: "promoted" | "demoted" | "none";
}

/**
 * Projects percentage-based movement for a live week. This mirrors the bot's
 * `calculateLeagueMovement`, which stays authoritative when the week ends.
 * Participants must be in weekly order, with nonparticipants excluded.
 */
export function projectWeekMovement(
  leagueTier: number,
  participants: readonly ProjectionParticipant[]
): ProjectedMovement[] {
  const scoringCount = participants.filter(
    (player) => player.totalPoints > 0
  ).length;
  const projections = participants.map(
    (player, index): ProjectedMovement & { placement: number } => {
      const currentPercentage =
        player.totalPoints > 0
          ? (100 * (scoringCount - index)) / scoringCount
          : 0;
      const entries = [...player.history, currentPercentage].slice(-3);
      return {
        placement: index + 1,
        currentPercentage,
        averagePercentage:
          entries.reduce((sum, percentage) => sum + percentage, 0) /
          entries.length,
        movement: "none",
      };
    }
  );

  const quota = Math.round(participants.length * 0.15);
  const ranked = [...projections].sort(
    (a, b) =>
      b.averagePercentage - a.averagePercentage || a.placement - b.placement
  );
  if (leagueTier > 1 && quota > 0) {
    const winner = projections[0]!;
    winner.movement = "promoted";
    for (const player of ranked
      .filter((player) => player !== winner)
      .slice(0, quota - 1)) {
      player.movement = "promoted";
    }
  }
  if (leagueTier < 6) {
    const demotionCandidates = ranked
      .filter((player) => player.movement !== "promoted")
      .reverse();
    for (const [index, player] of demotionCandidates.entries()) {
      if (player.averagePercentage === 0 || index < quota)
        player.movement = "demoted";
    }
  }

  return projections;
}
