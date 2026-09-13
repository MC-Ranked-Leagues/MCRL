export interface BotConfig {
  token: string;
}

export interface CommandDeploymentConfig extends BotConfig {
  applicationId: string;
  guildId?: string;
}

function requireEnvironmentVariable(
  environment: NodeJS.ProcessEnv,
  name: string
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function loadBotConfig(
  environment: NodeJS.ProcessEnv = process.env
): BotConfig {
  return {
    token: requireEnvironmentVariable(environment, "DISCORD_TOKEN"),
  };
}

export function loadCommandDeploymentConfig(
  environment: NodeJS.ProcessEnv = process.env
): CommandDeploymentConfig {
  const guildId = environment.DISCORD_GUILD_ID?.trim();

  return {
    ...loadBotConfig(environment),
    applicationId: requireEnvironmentVariable(
      environment,
      "DISCORD_APPLICATION_ID"
    ),
    ...(guildId ? { guildId } : {}),
  };
}
