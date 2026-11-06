import { describe, expect, it } from "vitest";
import {
  cleanTimeDigits,
  estimateLeague,
  formatTimeDigits,
  parseTimeDigits,
  timeToDigits,
} from "./leagueFinder";

const noStats = { elo: null, average: null, best: null };

// These use players far from any league boundary, so regenerating the summary
// from a newer snapshot shouldn't change the answers.
describe("estimateLeague", () => {
  it("places very strong players in League 1", () => {
    const { league } = estimateLeague({ elo: 2200, average: 540, best: 420 });
    expect(league).toBe(1);
  });

  it("places slower players in League 6", () => {
    const { league } = estimateLeague({ elo: 700, average: 1500, best: 1320 });
    expect(league).toBe(6);
  });

  it("works from a single stat", () => {
    expect(estimateLeague({ ...noStats, elo: 2200 }).league).toBe(1);
    expect(estimateLeague({ ...noStats, best: 1300 }).league).toBe(6);
  });

  it("uses League 7 from a 30 minute average or a 25 minute best", () => {
    expect(estimateLeague({ ...noStats, average: 30 * 60 }).league).toBe(7);
    expect(estimateLeague({ ...noStats, best: 25 * 60 }).league).toBe(7);
    // Either limit is enough, even when the other stats look fast.
    expect(
      estimateLeague({ elo: 2200, average: 540, best: 25 * 60 }).league
    ).toBe(7);
  });

  it("doesn't use League 7 under those limits, or from Elo", () => {
    expect(
      estimateLeague({ ...noStats, average: 30 * 60 - 1 }).league
    ).not.toBe(7);
    expect(estimateLeague({ ...noStats, best: 25 * 60 - 1 }).league).not.toBe(
      7
    );
    expect(estimateLeague({ ...noStats, elo: 100 }).league).not.toBe(7);
  });

  it("returns shares that add up to one, closest league first", () => {
    const { league, shares } = estimateLeague({ ...noStats, elo: 1350 });
    expect(shares[0]?.league).toBe(league);
    const total = shares.reduce((sum, { share }) => sum + share, 0);
    expect(total).toBeCloseTo(1);
  });
});

describe("time digits", () => {
  it("fills left to right, adding the colon when seconds start", () => {
    const shown = ["1", "12", "124", "1245"].map(formatTimeDigits);
    expect(shown).toEqual(["1", "12", "12:4", "12:45"]);
  });

  it("drops letters and extra digits, and takes a pasted time", () => {
    expect(cleanTimeDigits("1a")).toBe("1");
    expect(cleanTimeDigits("12:456")).toBe("1245");
    expect(cleanTimeDigits("09:30")).toBe("0930");
  });

  it("gets past the colon on backspace", () => {
    expect(cleanTimeDigits("12:")).toBe("12");
    expect(formatTimeDigits("12")).toBe("12");
  });

  it("reads the digits as typed", () => {
    expect(parseTimeDigits("5")).toBe(300);
    expect(parseTimeDigits("51")).toBe(3060);
    expect(parseTimeDigits("124")).toBe(724);
    expect(parseTimeDigits("1245")).toBe(765);
  });

  it("rejects bad seconds, times under 3 minutes, and nothing typed", () => {
    expect(parseTimeDigits("1275")).toBeNull();
    expect(parseTimeDigits("2")).toBeNull();
    expect(parseTimeDigits("02")).toBeNull();
    expect(parseTimeDigits("")).toBeNull();
  });

  it("converts looked up seconds", () => {
    expect(formatTimeDigits(timeToDigits(305))).toBe("05:05");
  });
});
