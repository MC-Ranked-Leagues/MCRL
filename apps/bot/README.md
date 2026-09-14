# MCRL Discord bot

## Run the bot

Copy `.env.example` to `.env` and set `DISCORD_TOKEN` to the bot token from the
Discord Developer Portal. Then run:

```sh
bun run dev:bot
```

Run only one bot instance per Discord token. The developer running the bot is
responsible for this; the bot does not check for other instances.

The client requests only the `Guilds` intent. Add another intent when a feature
needs it.

## Configure Discord

Stable guild, role, channel, and league settings live in `config/guilds.ts`.
Each league has a public information channel and a default competition time
limit. `/nm` can run in any channel and sends its public message to the selected
league's information channel.

After every slash command finishes or fails, the bot sends the actor, invocation
channel, command text, and timestamp to the guild's configured log channel.

## Manage the database

The bot uses Drizzle with Bun's SQLite driver. Set `DB_FILE_NAME` to the SQLite
file path, then apply pending migrations with:

```sh
bun run bot:migrate
```

After changing `src/db/schema.ts`, generate and apply a migration:

```sh
bun run --filter @mcrl/bot db:generate
bun run bot:migrate
```

During development, replace the configured database and apply every migration
with:

```sh
bun run bot:reset
```

Stop the bot before resetting its database. Reset also deletes the database's
SQLite journal files. Run `bun run --filter @mcrl/bot db:studio` to inspect the
local database.

## Add commands

Put each command definition and handler together in its own file under
`src/commands`, then import it into the explicit registry in
`src/commands/index.ts`. The dispatcher defers each command with an ephemeral
reply before calling its handler. Handlers respond with `interaction.editReply()`.

Register changed command definitions separately from bot startup:

```sh
bun run --filter @mcrl/bot commands:deploy
```

`DISCORD_APPLICATION_ID` is required for command deployment.
`DISCORD_GUILD_ID` is optional. When present, the script registers guild
commands for faster development. Otherwise, it registers global commands. The
script exits without changing Discord when the registry is empty.

## Project structure

- `src/index.ts` logs the Discord client in.
- `src/lib/environment.ts` reads required environment variables.
- `config/guilds.ts` contains stable Discord and league settings.
- `config/drizzle.ts` configures Drizzle Kit.
- `src/client.ts` owns the client and dispatches interactions.
- `src/commands` contains command definitions, handlers, and the registry.
- `src/db` contains database access, competition persistence, and the schema.
- `src/lib` contains helpers shared by bot modules.
- `scripts` contains command deployment and database maintenance scripts.
