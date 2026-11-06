import { describe, expect, it } from "vitest";
import { formatPercentage, formatRunTime } from "./format";

describe("formatRunTime", () => {
  it("shows hundredths by default", () => {
    expect(formatRunTime(83_456)).toBe("1:23.45");
  });

  it("rounds to whole seconds without hundredths", () => {
    expect(formatRunTime(605_000, { hundredths: false })).toBe("10:05");
    // 1:59.6 carries into the minute.
    expect(formatRunTime(119_600, { hundredths: false })).toBe("2:00");
  });

  it("uses an em dash for missing values", () => {
    expect(formatRunTime(null)).toBe("—");
    expect(formatRunTime(0)).toBe("—");
  });
});

describe("formatPercentage", () => {
  it("always shows two decimals", () => {
    expect(formatPercentage(100)).toBe("100.00%");
    expect(formatPercentage(86.6666)).toBe("86.67%");
    expect(formatPercentage(null)).toBe("—");
  });
});
