import { requiredEnv } from "./lib/environment";
import { client } from "./client";

try {
  await client.login(requiredEnv("DISCORD_TOKEN"));
} catch (error) {
  console.error("Discord bot failed to start.", error);
  process.exitCode = 1;
}
