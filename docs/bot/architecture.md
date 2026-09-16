# Bot architecture

Competition operations must work locally without reading Convex or depending on
website availability. SQLite owns live tournament state; Convex owns published
history. Publication failures must not block local or Discord operations.

Keep command deployment separate from startup: registering commands replaces the
whole command set, and global registration is a deliberate release action.
Apply database migrations explicitly during deployment.

Public messages carry shared tournament state; command replies are ephemeral.
Keep registration lists separate from leaderboards so hosts control announcements.
Discord refresh or audit-log failures must not undo saved competition changes.

Read [decisions](decisions.md) when changing tournament behavior or implementing
future features. They record agreed requirements and departures from the old bot.
Unresolved work lives in [plans](plans/README.md).
