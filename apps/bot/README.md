# MCRL Discord bot

## Run the bot

Copy `.env.example` to `.env` and set `DISCORD_TOKEN` to the bot token from the
Discord Developer Portal. Then run:

```sh
bun run dev:bot
```

The client requests only the `Guilds` intent. Add another intent only when a
feature needs the events covered by that intent.

## Add commands

Put each command definition and handler together in its own file under
`src/commands`, then import it into the explicit registry in
`src/commands/index.ts`. Each handler must reply or defer its interaction within
three seconds. Register changed command definitions separately from bot startup:

```sh
bun run --filter @mcrl/bot commands:deploy
```

`DISCORD_APPLICATION_ID` is required for command deployment.
`DISCORD_GUILD_ID` is optional. When it is present, the script registers guild
commands for faster development. Otherwise, it registers global commands. The
script exits without changing Discord when the registry is empty.

## Project structure

- `src/index.ts` starts and stops the process.
- `src/config.ts` validates environment variables.
- `src/client.ts` creates the Discord client and dispatches interactions.
- `src/commands` holds the command contract, registry, and future command files.
- `src/deploy-commands.ts` registers command definitions through Discord's REST
  API.
- `src/db` is reserved for the future Drizzle and SQLite implementation.
- `src/lib` is reserved for helpers shared by multiple bot modules.
