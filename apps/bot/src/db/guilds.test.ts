import { beforeEach, expect, test } from "bun:test";
import { getCurrentWeek, setCurrentWeek } from "./guilds";
import { resetDatabase, input } from "../testing/competition";

beforeEach(resetDatabase);

test("guild weeks default to one and can be explicitly changed", () => {
  expect(getCurrentWeek(input.guildId)).toBe(1);
  setCurrentWeek(input.guildId, 8);
  expect(getCurrentWeek(input.guildId)).toBe(8);
  expect(() => setCurrentWeek(input.guildId, 0)).toThrow();
  expect(() => setCurrentWeek(input.guildId, 1.5)).toThrow();
});
