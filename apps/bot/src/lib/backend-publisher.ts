import { api } from "@mcrl/backend/api";
import { ConvexHttpClient } from "convex/browser";
import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import type { getPlayer } from "../db/players";
import { requiredEnv } from "./environment";

interface PublicationFailure {
  operation: string;
  error: string;
}
const deployments = new Map<
  string,
  { client: ConvexHttpClient; writerKey: string }
>();

function deploymentFor(guildId: string) {
  const guild = guildConfiguration[guildId];
  if (!guild) throw new Error(`Guild ${guildId} is not configured.`);
  const prefix = guild.dev ? "DEV" : "PROD";
  let deployment = deployments.get(prefix);
  if (!deployment) {
    deployment = {
      client: new ConvexHttpClient(requiredEnv(`${prefix}_CONVEX_URL`), {
        fetch: ((input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.timeout(60_000),
          })) as typeof fetch,
      }),
      writerKey: requiredEnv(`${prefix}_CONVEX_WRITER_KEY`),
    };
    deployments.set(prefix, deployment);
  }
  return deployment;
}

// Call immediately after saving locally. Submit related mutations together so
// the shared client's ordering follows local saves, before Discord work awaits.
export async function publishToWebsite(
  guildId: string,
  operation: string,
  send: (
    client: ConvexHttpClient,
    writerKey: string
  ) => Promise<unknown> | Promise<unknown>[]
): Promise<PublicationFailure[]> {
  let writerKey: string | undefined;
  try {
    const deployment = deploymentFor(guildId);
    writerKey = deployment.writerKey;
    const requests = send(deployment.client, writerKey);
    const results = await Promise.allSettled(
      Array.isArray(requests) ? requests : [requests]
    );
    return results.flatMap((result) =>
      result.status === "rejected"
        ? [{ operation, error: errorMessage(result.reason, writerKey) }]
        : []
    );
  } catch (error) {
    // Configuration and payload preparation failures must not interrupt Discord.
    return [{ operation, error: errorMessage(error, writerKey) }];
  }
}

function errorMessage(error: unknown, writerKey?: string) {
  const message = error instanceof Error ? error.message : String(error);
  return writerKey ? message.replaceAll(writerKey, "[REDACTED]") : message;
}

export function publishPlayer(
  player: NonNullable<ReturnType<typeof getPlayer>>
) {
  return publishToWebsite(
    player.guildId,
    `Update player ${player.minecraftUuid}`,
    (client, writerKey) => {
      if (player.leagueNumber === null)
        throw new Error("Player has no assigned league.");
      return client.mutation(api.writes.players.upsertPlayer, {
        writerKey,
        uuid: player.minecraftUuid,
        ign: player.ign,
        leagueTier: player.leagueNumber,
        percentageHistory: player.percentageHistory,
      });
    }
  );
}

export async function reportPublicationResults(
  interaction: ChatInputCommandInteraction<"cached"> | ButtonInteraction,
  publication: Promise<PublicationFailure[]> | readonly PublicationFailure[],
  guildId = interaction.guildId
): Promise<void> {
  const failures = await publication;
  if (!failures.length) return;
  const first = failures[0]!;
  const summary = `Website update failed: ${first.operation}. ${failures.length > 1 ? `${failures.length} requests failed. ` : ""}${first.error}`;
  console.error(summary);
  try {
    await interaction.followUp({
      content: "Bot changes saved. The website update could not be confirmed.",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(
      "Could not send website failure notice.",
      errorMessage(error)
    );
  }
  try {
    if (!guildId) return;
    const config = guildConfiguration[guildId];
    if (!config) return;
    const guild = await interaction.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(config.logChannelId);
    if (!channel?.isSendable()) throw new Error("Log channel unavailable.");
    await channel.send({
      content: summary.slice(0, 2_000),
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error(
      "Could not log website failure to Discord.",
      errorMessage(error)
    );
  }
}
