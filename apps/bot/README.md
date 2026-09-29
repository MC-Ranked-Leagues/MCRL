# MCRL Discord bot

Copy `apps/bot/.env.example` to `apps/bot/.env` and set `DISCORD_TOKEN` and
`DB_FILE_NAME`. Configure your server IDs in `apps/bot/config/guilds.ts`,
including `developerId` for the account allowed to run `/dev_change_week`.
Set `currentWeekRoleId` in a guild's configuration to give registered players
a current week role until `/unreg` or `/em`. The bot needs Manage Roles
and a role above that role in Discord's role order.
Set `DEV_CONVEX_URL` and `DEV_CONVEX_WRITER_KEY` for the development guild, and
`PROD_CONVEX_URL` and `PROD_CONVEX_WRITER_KEY` for the production guild. The bot
selects the pair using each guild's `dev` setting. Configure the matching
`WRITER_API_KEY` in each Convex deployment. Website failures leave local and Discord
changes intact and produce a private notice plus a short log entry. Calls are
not stored or retried. The owner can copy SQLite before `/advance_week` if manual
website repair is needed.
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
