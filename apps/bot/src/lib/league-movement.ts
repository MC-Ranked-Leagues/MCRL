import { averagePercentage, type RetainedPercentage } from "./player-history";

interface MovementDecision {
  registrationId: number;
  placement: number;
  percentage: number;
  averageUsed: number;
  movement: "none" | "promote" | "demote";
}

export interface MovementParticipant {
  registrationId: number;
  points: number;
  history: readonly RetainedPercentage[];
}

// Participants must be in final weekly order, with nonparticipants excluded.
export function calculateLeagueMovement(
  leagueNumber: number,
  participants: readonly MovementParticipant[]
) {
  const scoringCount = participants.filter(
    (player) => player.points > 0
  ).length;
  const decisions = participants.map((player, index): MovementDecision => {
    const percentage =
      player.points > 0 ? (100 * (scoringCount - index)) / scoringCount : 0;
    const averageUsed = averagePercentage(
      [...player.history.map((entry) => entry.percentage), percentage],
      3
    )!;
    return {
      registrationId: player.registrationId,
      placement: index + 1,
      percentage,
      averageUsed,
      movement: "none",
    };
  });

  const quota = Math.round(participants.length * 0.15);
  const ranked = [...decisions].sort(
    (a, b) => b.averageUsed - a.averageUsed || a.placement - b.placement
  );
  // In an all-zero field the existing weekly order decides the winner.
  if (leagueNumber > 1 && quota > 0) {
    const winner = decisions[0]!;
    winner.movement = "promote";
    for (const player of ranked
      .filter((player) => player !== winner)
      .slice(0, quota - 1)) {
      player.movement = "promote";
    }
  }
  if (leagueNumber < 6) {
    const demotionCandidates = ranked
      .filter((player) => player.movement !== "promote")
      .reverse();
    // Zero rolling averages all demote, even when they exceed the normal quota.
    for (const [index, player] of demotionCandidates.entries()) {
      if (player.averageUsed === 0 || index < quota) player.movement = "demote";
    }
  }

  return decisions;
}

// Only participating players are supplied, just as for percentage-based movement.
export function calculateLeague7Qualification(
  participants: readonly {
    registrationId: number;
    averageTimeMs: number;
    bestFinishTimeMs: number | null;
  }[]
) {
  return participants.map((player) => {
    const qualifies =
      (player.bestFinishTimeMs !== null &&
        player.bestFinishTimeMs < 25 * 60_000) ||
      player.averageTimeMs < 30 * 60_000;
    return {
      registrationId: player.registrationId,
      percentage: null,
      averageUsed: null,
      movement: qualifies ? ("promote" as const) : ("none" as const),
    };
  });
}
