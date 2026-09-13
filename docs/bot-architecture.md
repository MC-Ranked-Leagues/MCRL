# Discord bot decisions

The bot code is a migration from the old bot cloned at `.tmp` file under this
projects root.

Command definitions and handlers stay together because Discord validates the
registered definition separately from the runtime handler.

Discord invalidates an interaction token unless the bot replies or defers within
three seconds. Operational replies are ephemeral. Public channel messages are
reserved for shared tournament state such as registration lists, standings, and
final results.

Command deployment remains separate from bot startup. Running `bot:deploy`
replaces the complete command set in the configured guild, or globally when no
guild is configured. Development uses guild deployment for immediate updates;
global deployment is a deliberate release action.

The intended permission budget is View Channels, Send Messages, Read Message
History, Attach Files, Manage Roles, and Pin Messages. Pin Messages is distinct
from Manage Messages. The bot deletes only its own messages, so it does not need
Manage Messages.

Local persistence uses Drizzle with Bun's SQLite driver under `apps/bot/src/db`.
The schema starts empty. Drizzle Kit generates versioned migrations in
`apps/bot/drizzle`, and deployments apply those migrations explicitly. The
historical bot's `data.json` is migration evidence, not the new schema.
