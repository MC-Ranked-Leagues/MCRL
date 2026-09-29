import { expect, spyOn, test } from "bun:test";
import { api } from "@mcrl/backend/api";
import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import {
  publishToWebsite,
  reportPublicationResults,
} from "./backend-publisher";
import { mockWebsite } from "../testing/website";
import { nmCommand } from "../commands/nm";
import { registrationChannel, resetDatabase } from "../testing/competition";
import { getActiveCompetition } from "../db/competitions";

const website = mockWebsite();
const prodGuild = Object.keys(guildConfiguration).find(
  (id) => !guildConfiguration[id]!.dev
)!;
const devGuild = Object.keys(guildConfiguration).find(
  (id) => guildConfiguration[id]!.dev
)!;
const send = (guildId: string) =>
  publishToWebsite(
    guildId,
    "Create competition: League 1, Week 1",
    (client, writerKey) =>
      client.mutation(api.writes.competitions.createCompetition, {
        writerKey,
        leagueTier: 1,
        weekNumber: 1,
        maxTimeLimitMs: 1000,
      })
  );

test("uses separate development and production clients with a 60-second request timeout", async () => {
  const timeout = spyOn(AbortSignal, "timeout");
  try {
    expect(await send(devGuild)).toEqual([]);
    expect(await send(prodGuild)).toEqual([]);
    expect(website.requests.map((request) => request.url)).toEqual([
      "https://dev-test.convex.cloud/api/mutation",
      "https://prod-test.convex.cloud/api/mutation",
    ]);
    expect(website.requests[0]!.args).toEqual([
      {
        writerKey: "dev-test-key",
        leagueTier: 1,
        weekNumber: 1,
        maxTimeLimitMs: 1000,
      },
    ]);
    expect(timeout).toHaveBeenCalledWith(60_000);
  } finally {
    timeout.mockRestore();
  }
});

test("requests keep submission order and later requests run after a failure without retries", async () => {
  let rejectFirst!: (error: Error) => void;
  website.respond = () =>
    new Promise<Response>((_, reject) => {
      rejectFirst = reject;
    });
  const first = send(devGuild);
  const second = send(devGuild);
  expect(website.requests).toHaveLength(1);
  website.respond = async () =>
    Response.json({ status: "success", value: null });
  rejectFirst(new Error("offline dev-test-key"));
  expect(await first).toEqual([
    {
      operation: "Create competition: League 1, Week 1",
      error: "offline [REDACTED]",
    },
  ]);
  expect(await second).toEqual([]);
  expect(website.requests).toHaveLength(2);
});

test("Discord finishes and local data stays saved while a website request waits, then times out", async () => {
  resetDatabase();
  let abort!: () => void;
  website.respond = () =>
    new Promise<Response>((_, reject) => {
      abort = () => reject(new Error("The operation timed out."));
    });
  const { channel } = registrationChannel();
  const config = guildConfiguration[devGuild]!;
  const [tier, league] = Object.entries(config.leagues)[0]!;
  const replies: string[] = [];
  const warnings: unknown[] = [];
  const logs: unknown[] = [];
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  let localReply!: () => void;
  const replied = new Promise<void>((resolve) => {
    localReply = resolve;
  });
  try {
    const command = nmCommand.execute({
      guildId: devGuild,
      channelId: league.infoChannelId,
      member: { roles: { cache: { has: () => true } } },
      guild: { channels: { fetch: async () => channel } },
      editReply: async (content: string) => {
        replies.push(content);
        localReply();
      },
      followUp: async (payload: unknown) => {
        warnings.push(payload);
      },
      client: {
        guilds: {
          fetch: async () => ({
            channels: {
              fetch: async () => ({
                isSendable: () => true,
                send: async (payload: unknown) => logs.push(payload),
              }),
            },
          }),
        },
      },
    } as unknown as ChatInputCommandInteraction<"cached">);
    await replied;
    expect(replies[0]).toContain("Started League");
    expect(getActiveCompetition(devGuild, Number(tier))).toBeDefined();
    expect(warnings).toEqual([]);
    abort();
    await command;
    expect(replies).toHaveLength(1);
    expect(warnings).toMatchObject([{ flags: MessageFlags.Ephemeral }]);
    expect(logs).toHaveLength(1);
    expect(getActiveCompetition(devGuild, Number(tier))).toBeDefined();
  } finally {
    errorLog.mockRestore();
  }
});

test("logs one short summary even if the private failure notice cannot be sent", async () => {
  const logs: unknown[] = [];
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  try {
    const interaction = {
      guildId: null,
      followUp: async () => {
        throw new Error("Expired interaction");
      },
      client: {
        guilds: {
          fetch: async () => ({
            channels: {
              fetch: async () => ({
                isSendable: () => true,
                send: async (message: unknown) => logs.push(message),
              }),
            },
          }),
        },
      },
    } as unknown as Parameters<typeof reportPublicationResults>[0];
    await reportPublicationResults(
      interaction,
      [
        {
          operation: "Register player: League 3, Week 5",
          error: "Unavailable",
        },
        {
          operation: "Register player: League 3, Week 5",
          error: "Unavailable",
        },
      ],
      devGuild
    );
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).toContain("2 requests failed");
    expect(JSON.stringify(logs)).not.toContain("writerKey");
  } finally {
    errorLog.mockRestore();
  }
});

test("configuration and payload mistakes become failures instead of interrupting the command", async () => {
  expect(await send("unconfigured-guild")).toMatchObject([
    { error: "Guild unconfigured-guild is not configured." },
  ]);
  expect(
    await publishToWebsite(devGuild, "Import match", () => {
      throw new Error("Invalid match data");
    })
  ).toEqual([{ operation: "Import match", error: "Invalid match data" }]);
  expect(website.requests).toHaveLength(0);
});
