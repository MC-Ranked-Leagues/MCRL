import { beforeEach, expect, test } from "bun:test";
import {
  getActiveCompetition,
  startCompetition,
  toggleRegistration,
} from "./competitions";
import {
  getGuildRegistrationDiscordIds,
  hasGuildRegistration,
  registerPlayer,
  unregisterPlayer,
} from "./registrations";
import { input, resetDatabase } from "../testing/competition";

beforeEach(resetDatabase);

test("week role cleanup uses remaining real registrations in this guild", () => {
  startCompetition(input);
  startCompetition({ ...input, leagueNumber: 6 });
  startCompetition({ ...input, guildId: "other-guild" });
  const first = getActiveCompetition(input.guildId, 5)!;
  const second = getActiveCompetition(input.guildId, 6)!;
  const other = getActiveCompetition("other-guild", 5)!;
  toggleRegistration(input.guildId, 5);
  toggleRegistration(input.guildId, 6);
  toggleRegistration("other-guild", 5);

  for (const [competitionId, userId, mode] of [
    [first.id, "multi", "self"],
    [second.id, "multi", "self"],
    [first.id, "solo", "self"],
    [first.id, "test:fake", "test"],
    [other.id, "elsewhere", "self"],
  ] as const) {
    expect(
      registerPlayer(
        {
          competitionId,
          discordUserId: userId,
          discordUsername: userId,
          minecraftUuid: userId,
          ign: userId,
          registeredAt: new Date(),
        },
        { mode }
      )
    ).toBe("registered");
  }

  expect(getGuildRegistrationDiscordIds(input.guildId).sort()).toEqual([
    "multi",
    "solo",
  ]);
  expect(unregisterPlayer(first.id, "multi").status).toBe("unregistered");
  expect(hasGuildRegistration(input.guildId, "multi")).toBe(true);
  expect(unregisterPlayer(second.id, "multi").status).toBe("unregistered");
  expect(hasGuildRegistration(input.guildId, "multi")).toBe(false);
  expect(getGuildRegistrationDiscordIds(input.guildId)).toEqual(["solo"]);
});
