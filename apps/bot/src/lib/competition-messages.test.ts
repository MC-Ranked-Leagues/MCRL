import { importMatch } from "../db/matches";
import { replyWithCompetitionUpdate } from "./competition-messages";
import { registerPlayer } from "../db/registrations";
import { beforeEach, expect, spyOn, test } from "bun:test";
import { type ChatInputCommandInteraction } from "discord.js";
import { getActiveCompetition } from "../db/competitions";
import { registrations } from "../db/schema";
import {
  resetDatabase,
  database,
  input,
  registrationChannel,
  setupMatchPlayers,
  rankedMatch,
} from "../testing/competition";

beforeEach(resetDatabase);

test("competition refresh updates registration and rescored standings even if registration refresh fails", async () => {
  const competition = setupMatchPlayers(5);
  const { channel, messages, rawChannel } = registrationChannel();
  const replies: string[] = [];
  const interaction = {
    guild: {
      channels: {
        fetch: async () => ({
          ...channel,
          isSendable: () => true,
        }),
      },
    },
    editReply: async ({ content }: { content: string }) => {
      replies.push(content);
    },
  } as unknown as ChatInputCommandInteraction<"cached">;
  await replyWithCompetitionUpdate(
    interaction,
    competition.id,
    "info",
    "Registered."
  );
  expect(messages.size).toBe(1);
  importMatch(competition.id, rankedMatch());
  await replyWithCompetitionUpdate(
    interaction,
    competition.id,
    "info",
    "Imported."
  );
  expect([...messages.values()].join("\n")).toContain("Registration: **OFF**");
  expect([...messages.values()].join("\n")).toContain("7 pts");
  registerPlayer(
    {
      competitionId: competition.id,
      discordUserId: "late",
      discordUsername: "late",
      minecraftUuid: "late",
      ign: "Late",
      registeredAt: new Date(),
    },
    { mode: "admin" }
  );
  const registrationId = getActiveCompetition(input.guildId, 5)!
    .registrationMessageIds[0]!;
  const fetchMessage = rawChannel.messages.fetch.bind(rawChannel.messages);
  const fetchSpy = spyOn(rawChannel.messages, "fetch").mockImplementation(
    (id: string) => {
      if (id === registrationId)
        return Promise.reject(new Error("Simulated Discord failure"));
      return fetchMessage(id);
    }
  );
  const logSpy = spyOn(console, "error").mockImplementation(() => {});
  try {
    await replyWithCompetitionUpdate(
      interaction,
      competition.id,
      "info",
      "Registered Late."
    );
  } finally {
    fetchSpy.mockRestore();
    logSpy.mockRestore();
  }
  expect([...messages.values()].join("\n")).toContain("8 pts");
  expect(replies.at(-1)).toContain("The changes are saved");
  expect(database.select().from(registrations).all()).toHaveLength(6);
});
