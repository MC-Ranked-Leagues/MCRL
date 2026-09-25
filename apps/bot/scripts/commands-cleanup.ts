import { REST, Routes } from "discord.js";

const args = process.argv.slice(2);

const isGlobal = args.includes("--global");

const guildIdIndex = args.indexOf("--guildId");
const guildId = guildIdIndex !== -1 ? args[guildIdIndex + 1] : undefined;

if (isGlobal && guildId) {
  console.error("Use either --global or --guildId, not both.");
  process.exit(1);
}

if (!isGlobal && !guildId) {
  console.error(
    "Usage:\n" +
      "  bun clear-commands.ts --guildId <guild-id>\n" +
      "  bun clear-commands.ts --global"
  );

  process.exit(1);
}

const applicationId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_TOKEN;

if (!applicationId) {
  console.error("Missing DISCORD_APPLICATION_ID environment variable.");
  process.exit(1);
}

if (!token) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}

const rest = new REST().setToken(token);

const route = isGlobal
  ? Routes.applicationCommands(applicationId)
  : Routes.applicationGuildCommands(applicationId, guildId!);

await rest.put(route, { body: [] });

console.info(
  isGlobal
    ? "Removed all global application commands."
    : `Removed all application commands from guild ${guildId}.`
);
