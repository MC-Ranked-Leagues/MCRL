import { createBotClient } from "./client";
import { loadBotConfig } from "./config";

const config = loadBotConfig();
const client = createBotClient();

function shutDown(signal: NodeJS.Signals): void {
  console.info(`Received ${signal}. Closing the Discord connection.`);
  void client.destroy().catch((error: unknown) => {
    console.error("Failed to close the Discord connection.", error);
    process.exitCode = 1;
  });
}

process.once("SIGINT", shutDown);
process.once("SIGTERM", shutDown);

try {
  await client.login(config.token);
} catch (error) {
  console.error("Discord bot failed to start.", error);
  process.exitCode = 1;
}
