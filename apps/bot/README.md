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
Each league has `infoChannelId`, `chatChannelId`, `leagueRoleId`, and a default
competition time limit. Configure these IDs for your server.

- `/nm week` starts a competition for the league associated with the current info
  or chat channel. Each league can have only one active competition.
- `/reg` registers your Discord-linked MCSR Ranked account in the current league
  and updates its registration list. Registration must be open, and you need the
  league role or the command role. The list sorts by descending peak Elo, with
  Minecraft name breaking ties. Peak Elo is captured from the Ranked profile's
  current-season high at registration. Older registrations or profiles without
  a peak use saved current Elo as a fallback; unrated players appear last.
- `/admin_reg user [mc_username]` registers a player even when registration is
  closed, without requiring their league role. A supplied Minecraft username is
  looked up directly on MCSR Ranked; otherwise the target's Discord link is used.
- `/unreg` removes your registration while registration is open, provided you have
  no results in an imported match.
- `/admin_unreg user` removes a player's registration even when registration is
  closed or they have imported results. Their match results are also removed.
  Both removal commands refresh the current league's registration list.
- `/assign user league` replaces the user's configured league roles with the
  destination league role. It can run in any server channel and assign any
  configured league, regardless of automatic promotion or relegation rules.
- `/toggle_registration` flips registration for the current channel's league.
- `/import match_id [match_number]` imports a supplied MCSR Ranked match ID.
  Omitting `match_number` creates the next match. Supplying it creates that exact
  match or replaces all its existing results. Only registered Minecraft UUIDs
  count; unmatched Ranked players are reported. A Ranked ID already used by
  another match in the competition is rejected. Results stay in SQLite.
- `/clear [match_number]` deletes a match and all its results. Omitting the number
  deletes the latest match. Other match numbers and registrations stay intact.
  Both commands refresh the public leaderboard separately from registration.
- `/dm` deletes that league's active competition and all its registrations,
  matches, and results after the requester confirms within 60 seconds.

Host commands require the configured command role. `/nm` creates the tracked
registration list in the information channel;
`/toggle_registration` edits its status without posting an announcement.
League 7 is special and sits outside the League 1–6 promotion/relegation range.

After every slash command finishes or fails, the bot sends the actor, invocation
channel, command text, and timestamp to the guild's configured log channel.

## Manage the database

The bot uses Drizzle with Bun's SQLite driver. Set `DB_FILE_NAME` to the SQLite
file path, then apply pending migrations with:

```sh
bun run bot:migrate
```

Migration `0002` enforces one active competition per guild and league. If an
existing database contains multiple active weeks for a league, resolve those
records before applying it. The migration fails rather than discarding data.

Migration `0004` adds the nullable registration peak-Elo snapshot. Apply it before
running the updated bot. Existing registrations retain their current Elo and
use it for ordering until a new registration captures a peak.

Migration `0005` adds tracked leaderboard message IDs. Apply it before running
`/import` or `/clear`, and deploy the updated command definitions separately.

Run the bot's database tests with `bun run --filter @mcrl/bot test`. They apply
migrations to an in-memory database.

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
