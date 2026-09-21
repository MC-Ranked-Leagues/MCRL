# MCRL Discord bot

Copy `apps/bot/.env.example` to `apps/bot/.env` and set `DISCORD_TOKEN` and
`DB_FILE_NAME`. Configure your server IDs in `apps/bot/config/guilds.ts`,
including `developerId` for the account allowed to run `/dev_change_week`.
From the repository root:

```sh
bun run bot:migrate
bun run dev:bot
```

## Local maintenance

After changing the database schema, generate a migration with
`bun run --filter @mcrl/bot db:generate`, then apply it with `bun run bot:migrate`.
To recreate the local database (this deletes all data), stop the bot and run `bun run bot:reset`.

To register command changes in a development server, set `DISCORD_APPLICATION_ID`
and `DISCORD_GUILD_ID`, then run `bun run bot:deploy`. This replaces that server's
complete command set. Omitting `DISCORD_GUILD_ID` targets global commands.

The intended Discord permissions are View Channels, Send Messages, Read Message
History, Attach Files, Manage Roles, and Pin Messages. Signup moderation requires Manage Messages in its channel.

## Documentation

- [Command reference](../../docs/bot/commands.md) for players and hosts.
- [Architecture](../../docs/bot/architecture.md) for technical constraints.
- [Decisions](../../docs/bot/decisions.md) for agreed requirements.
- [Plans](../../docs/bot/plans/README.md) for proposals and open questions.
