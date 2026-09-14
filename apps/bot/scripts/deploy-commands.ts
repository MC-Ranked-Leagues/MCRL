import { REST, Routes } from "discord.js";

import { requiredEnv } from "../src/lib/environment";
import { commands } from "../src/commands";

const commandDefinitions = commands.map((command) => command.data.toJSON());

if (commandDefinitions.length === 0) {
  console.info("No commands are defined. Discord was not changed.");
} else {
  const applicationId = requiredEnv("DISCORD_APPLICATION_ID");
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  const rest = new REST().setToken(requiredEnv("DISCORD_TOKEN"));
  const route = guildId
    ? Routes.applicationGuildCommands(applicationId, guildId)
    : Routes.applicationCommands(applicationId);

  await rest.put(route, { body: commandDefinitions });

  const scope = guildId ? `guild ${guildId}` : "global";
  console.info(`Registered ${commandDefinitions.length} ${scope} command(s).`);
}
