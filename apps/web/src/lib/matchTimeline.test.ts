import { describe, expect, it } from "vitest";
import { buildRuns } from "./matchTimeline";

function events(uuid: string, list: [string, number][]) {
  return list.map(([type, time]) => ({ uuid, type, time }));
}

function phases(player: { blocks: { phase: string; duration: number }[] }) {
  return player.blocks.map(({ phase, duration }) => [phase, duration]);
}

describe("buildRuns", () => {
  it("sorts each player's events by time before building phases", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [
        ["nether.find_bastion", 300],
        ["story.enter_the_nether", 100],
      ]),
    });

    expect(phases(player!)).toEqual([
      ["overworld", 100],
      ["nether", 200],
    ]);
  });

  it("groups related events into one phase and ignores minor ones", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [
        ["story.enter_the_nether", 100],
        ["nether.find_bastion", 200],
        ["projectelo.timeline.death", 250],
        ["nether.loot_bastion", 300],
        ["nether.find_fortress", 400],
        ["nether.obtain_blaze_rod", 500],
        ["projectelo.timeline.blind_travel", 600],
      ]),
    });

    expect(phases(player!)).toEqual([
      ["overworld", 100],
      ["nether", 100],
      ["bastion", 200],
      ["fortress", 200],
    ]);
  });

  it("goes back to the overworld when a player resets mid-run", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [
        ["story.enter_the_nether", 100],
        ["projectelo.timeline.reset", 200],
        ["story.enter_the_nether", 300],
        ["nether.find_bastion", 400],
      ]),
    });

    expect(phases(player!)).toEqual([
      ["overworld", 100],
      ["nether", 100],
      ["overworld", 100],
      ["nether", 100],
    ]);
  });

  it("keeps everything after the dragon dies as one finished block", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [
        ["story.enter_the_end", 100],
        ["projectelo.timeline.dragon_death", 200],
        ["projectelo.timeline.reset", 250],
        ["projectelo.timeline.complete", 300],
      ]),
    });

    expect(phases(player!)).toEqual([
      ["overworld", 100],
      ["end", 100],
      ["complete", 100],
    ]);
  });

  it("prefers the completion's time over the complete event's", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [["projectelo.timeline.complete", 300]]),
      completions: [{ uuid: "a", time: 290 }],
    });

    expect(player).toMatchObject({
      isFinished: true,
      finalTime: 290,
      statusText: null,
    });
  });

  it("counts a complete event as finishing without a completion", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [["projectelo.timeline.complete", 300]]),
    });

    expect(player).toMatchObject({ isFinished: true, finalTime: 300 });
  });

  it("ends an unfinished run at its last event, in its last major phase", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: events("a", [
        ["nether.find_fortress", 200],
        ["projectelo.timeline.death", 350],
      ]),
    });

    expect(player).toMatchObject({
      isFinished: false,
      finalTime: 350,
      statusText: "Fortress",
    });
    expect(phases(player!)).toEqual([
      ["overworld", 200],
      ["fortress", 150],
    ]);
  });

  it("handles a player with no timeline", () => {
    const [player] = buildRuns({
      players: [{ uuid: "a" }],
      timelines: [],
    });

    expect(player).toMatchObject({
      isFinished: false,
      finalTime: 0,
      statusText: "Overworld",
      blocks: [],
    });
  });

  it("puts finishers first by time, then unfinished runs by how far they got", () => {
    const players = buildRuns({
      players: [
        { uuid: "short" },
        { uuid: "slow" },
        { uuid: "long" },
        { uuid: "fast" },
      ],
      timelines: [
        ...events("short", [["story.enter_the_nether", 100]]),
        ...events("long", [["story.enter_the_nether", 900]]),
      ],
      completions: [
        { uuid: "slow", time: 800 },
        { uuid: "fast", time: 400 },
      ],
    });

    expect(players.map((player) => player.uuid)).toEqual([
      "fast",
      "slow",
      "long",
      "short",
    ]);
  });
});
