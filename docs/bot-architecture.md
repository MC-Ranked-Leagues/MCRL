# Discord bot decisions

The bot code is a migration from the old bot cloned under `.tmp` in the project
root.

Command definitions and handlers stay together because Discord validates the
registered definition separately from the runtime handler. The command registry
is an explicit array, and the dispatcher checks that an interaction belongs to
a cached guild before calling a handler.

Discord invalidates an interaction token unless the bot replies or defers within
three seconds. The dispatcher defers slash commands once, and handlers edit that
ephemeral reply. Public channel messages are reserved for shared tournament
state such as registration lists, standings, and final results.

Command deployment remains separate from bot startup. Running `bot:deploy`
replaces the complete command set in the configured guild, or globally when no
guild is configured. Development uses guild deployment for immediate updates.
Global deployment is a deliberate release action.

The intended permission budget is View Channels, Send Messages, Read Message
History, Attach Files, Manage Roles, and Pin Messages. Pin Messages is distinct
from Manage Messages. The bot deletes only its own messages, so it does not need
Manage Messages.

Stable Discord configuration lives in `apps/bot/config/guilds.ts`. Role IDs keep
league assignment independent of Discord role names.

League 7 is special. Future promotion and relegation must stay within Leagues 1–6;
League 6 remains the relegation boundary.

Local persistence uses Drizzle with Bun's SQLite driver under `apps/bot/src/db`.
Competitions and future tournament state live in SQLite. Each competition copies
the configured time limit when it starts so later default changes do not rewrite history.

After every slash command finishes or fails, the bot sends the actor, invocation
channel, rendered command, and Discord interaction timestamp to the invoking
guild's configured log channel. A logging failure does not change the command's
result.

Drizzle Kit generates versioned migrations in `apps/bot/drizzle`, and
deployments apply those migrations explicitly. The historical bot's `data.json`
is migration evidence, not the new schema.
