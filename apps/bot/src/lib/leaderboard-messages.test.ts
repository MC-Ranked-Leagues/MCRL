import { importMatch } from "../db/matches";
import { updateLeaderboardMessages } from "./leaderboard-messages";
import { beforeEach, expect, test } from "bun:test";
import { type SendableChannels } from "discord.js";
import { endCompetition } from "../db/competitions";
import {
  resetDatabase,
  input,
  registrationChannel,
  setupMatchPlayers,
  rankedMatch,
} from "../testing/competition";

beforeEach(resetDatabase);

test("final leaderboard omits the missed section when everyone participated and retries after Discord failure", async () => {
  const competition = setupMatchPlayers(2);
  importMatch(competition.id, rankedMatch());
  endCompetition(input.guildId, competition.id);
  const failingChannel = {
    async send() {
      throw new Error("Discord unavailable");
    },
  } as unknown as SendableChannels;
  const error: unknown = await updateLeaderboardMessages(
    failingChannel,
    competition.id
  ).catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({ message: "Discord unavailable" });
  expect(endCompetition(input.guildId, competition.id).status).toBe(
    "already_ended"
  );
  const { channel, messages } = registrationChannel();
  await updateLeaderboardMessages(channel, competition.id);
  expect([...messages.values()].join("\n")).not.toContain("-----");
  expect([...messages.values()].join("\n")).not.toContain(" - missed");
});
