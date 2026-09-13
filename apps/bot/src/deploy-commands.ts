import { REST, Routes } from "discord.js";

import { commands } from "./commands";
import { loadCommandDeploymentConfig } from "./config";

const commandDefinitions = commands.map((command) => command.data.toJSON());

if (commandDefinitions.length === 0) {
  console.info("No commands are defined. Discord was not changed.");
} else {
  const config = loadCommandDeploymentConfig();
  const rest = new REST().setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.applicationId, config.guildId)
    : Routes.applicationCommands(config.applicationId);

  await rest.put(route, { body: commandDefinitions });

  const scope = config.guildId ? `guild ${config.guildId}` : "global";
  console.info(`Registered ${commandDefinitions.length} ${scope} command(s).`);
}
