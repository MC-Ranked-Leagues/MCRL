// Turns a Ranked match's raw timelines into each player's phase bars.

export type Phase =
  | "overworld"
  | "nether"
  | "bastion"
  | "fortress"
  | "blind"
  | "stronghold"
  | "end"
  | "complete";

export type PhaseBlock = {
  phase: Phase;
  startTime: number;
  duration: number;
};

export const phaseNames: Record<Phase, string> = {
  overworld: "Overworld",
  nether: "Nether",
  bastion: "Bastion",
  fortress: "Fortress",
  blind: "Blind Travel",
  stronghold: "Stronghold",
  end: "The End",
  complete: "Finished",
};

// Events that start a new phase. Deaths and other minor events return null.
function phaseForEvent(type: string): Phase | null {
  if (type === "projectelo.timeline.reset") return "overworld";
  if (type === "story.enter_the_nether") return "nether";
  if (type === "nether.find_bastion" || type === "nether.loot_bastion")
    return "bastion";
  if (type === "nether.find_fortress" || type === "nether.obtain_blaze_rod")
    return "fortress";
  if (type === "projectelo.timeline.blind_travel") return "blind";
  if (type === "story.follow_ender_eye") return "stronghold";
  if (type === "story.enter_the_end") return "end";
  return null;
}

type TimelineEvent = { uuid: string; time: number; type: string };

export function buildRuns<Player extends { uuid: string }>(match: {
  players: Player[];
  timelines: TimelineEvent[];
  completions?: { uuid: string; time: number }[] | null;
}) {
  const timelinesByUuid = new Map<string, TimelineEvent[]>();
  for (const timeline of match.timelines) {
    const current = timelinesByUuid.get(timeline.uuid);
    if (current) {
      current.push(timeline);
    } else {
      timelinesByUuid.set(timeline.uuid, [timeline]);
    }
  }
  for (const timelines of timelinesByUuid.values()) {
    timelines.sort((a, b) => a.time - b.time);
  }

  const completionsByUuid = new Map(
    (match.completions ?? []).map((completion) => [completion.uuid, completion])
  );

  const runs = match.players.map((player) => {
    const timelines = timelinesByUuid.get(player.uuid) ?? [];

    const completion = completionsByUuid.get(player.uuid);
    const finishEvent = timelines.find(
      (t) => t.type === "projectelo.timeline.complete"
    );
    const dragonDeathEvent = timelines.find(
      (t) => t.type === "projectelo.timeline.dragon_death"
    );
    const isFinished = !!(completion || finishEvent);
    const finalTime = isFinished
      ? completion?.time || finishEvent?.time || 0
      : timelines[timelines.length - 1]?.time || 0;
    const finishStartTime =
      isFinished && dragonDeathEvent && dragonDeathEvent.time < finalTime
        ? dragonDeathEvent.time
        : null;
    const phaseEndTime = finishStartTime ?? finalTime;

    let currentPhase: Phase = "overworld";
    let currentStartTime = 0;

    const blocks: PhaseBlock[] = [];

    for (const event of timelines) {
      // Keep the post-dragon-death stretch as the finished block.
      if (event.time > phaseEndTime) continue;

      const next = phaseForEvent(event.type);
      if (next && next !== currentPhase) {
        blocks.push({
          phase: currentPhase,
          startTime: currentStartTime,
          duration: event.time - currentStartTime,
        });
        currentPhase = next;
        currentStartTime = event.time;
      }
    }

    // Close the last active phase before the finish animation starts.
    blocks.push({
      phase: currentPhase,
      startTime: currentStartTime,
      duration: phaseEndTime - currentStartTime,
    });

    if (finishStartTime !== null && finishStartTime < finalTime) {
      blocks.push({
        phase: "complete",
        startTime: finishStartTime,
        duration: finalTime - finishStartTime,
      });
    }

    // Unfinished runs name the phase they stopped in.
    const statusText = isFinished ? null : phaseNames[currentPhase];

    return {
      ...player,
      isFinished,
      finalTime,
      statusText,
      blocks: blocks.filter((block) => block.duration > 0),
    };
  });

  return runs.sort((a, b) => {
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;
    if (a.isFinished && b.isFinished) return a.finalTime - b.finalTime;
    return b.finalTime - a.finalTime;
  });
}
