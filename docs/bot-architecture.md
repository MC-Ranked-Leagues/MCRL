# Discord bot decisions

The bot code is a migration from the old bot cloned under `.tmp` in the project
root. The migration decisions below take precedence over upstream behavior.
They describe the intended implementation; planned features are not necessarily
implemented yet.

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
from Manage Messages. Current competition message management deletes only the
bot's own messages. The planned signup-channel moderation also deletes member
messages and will require Manage Messages in that channel.

Stable Discord configuration lives in `apps/bot/config/guilds.ts`. Role IDs keep
league assignment independent of Discord role names.

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

## Message lifecycle

Registration messages stay separate from leaderboards so hosts control public
announcements. Registration changes edit the tracked registration messages in place.
When implemented, `/import` replaces only the previous leaderboard messages.
Weekly cleanup preserves old registration and leaderboard messages in Discord.

## Planned player and weekly lifecycle

The event must work without reading Convex. A SQLite players table replaces
upstream's `players.json`. The [player account proposal](player_accounts.md)
describes pairing one Discord ID with one active Minecraft UUID, challenge-account
identity, and host-approved migration. This policy is pending discussion at a team
meeting; keep current bot behavior unchanged until then. Persistent players may
also have a default Twitch.
Registrations retain the account used for that competition. Order registrations
by peak Elo, captured from the Ranked profile's current-season high at
registration. Fall back to saved current Elo when the peak is unavailable,
including registrations created before peak snapshots were stored. Display that
fallback explicitly. `/admin_reg` accepts an optional Minecraft username so an admin can
register a player without relying on their linked Discord profile. Admin registration
bypasses registration closure and the target's league role, but still requires an
active competition and a unique Discord user and Minecraft account within it.

`/unreg` requires open registration and rejects removal when the player has a
result in an imported match. `/admin_unreg` bypasses those restrictions. Removal
deletes the competition registration and its dependent match results, so hosts
can correct registrations without deleting the competition. Both commands use
the invoking channel's league and refresh its registration messages.

Players who register but play no matches stay out of standings. Ending a
competition unregisters those players. A played match that ends in DNF counts
as participation; an automatically created DNF placeholder does not. Removing
a competition registration preserves the persistent player record.

Keep only the latest three placements on each player, tagged with week and league.
The rolling average uses their last three placements regardless of age, rather
than three consecutive weeks. There will be no separate local results-history
table; Convex retains published history. A future `/past` shows the retained three.

Future guild-wide `/relegate` finalizes movements, advances a stored guild week,
and cleans up completed competition data while preserving players and their three
placements. `/nm` will use that stored week instead of a host-supplied number.
Keep `/dm` as temporary cleanup until `/relegate` is implemented, then remove it.

## Migration scope agreed on 15 September 2026

The upstream reference is CrossaintBot commit
[`208931988f52`](https://github.com/BoboTheFlyngBox/CrossaintBot/tree/208931988f5240874da4ab4f0e5b64f1e6478f43).
It supplies behavior to evaluate, not a feature list to port wholesale.
Championships, best-of-three score reporting and review, and z-scores are outside
the rewrite's scope. Their commands, state, and player fields are not needed.

### Weekly points

Keep upstream's seed point formula, including a minimum of one point for every
valid completion. Let `H = floor(seed player count / 2)`. A finisher with placement
`P <= H` earns `max(1, H - P + 1 + podium bonus)` points. The podium bonuses are
5, 3, and 1 for first, second, and third. Other finishers earn one point; DNFs
earn zero. The bonus is part of the top-half formula, not an additional bonus
for finishers outside that half.

### Promotions and relegations

General movement will compare players using their rolling average placement
over the latest three weeks they participated in. Skipped weeks do not become
zero placements or consume a slot. Use the retained placements described above.
The upstream percentage quotas, all-DNF rules, demotion cooldown, and movement
tie-breakers are not the new policy.

Discuss the remaining policy when implementing `/relegate`, including movement
counts or thresholds, ties, and players with fewer than three placements.
Do not infer those decisions from the old bot.

League 7 retains its separate qualification rule: promote to League 6 after at
least one played match and either a valid imported finish under 25 minutes or
a competition average time under 30 minutes. These are strict thresholds and
use that competition's results, independently of the rolling placement policy.
Automatic relegation cannot move a player into League 7; League 6 remains the
demotion boundary. `/assign` is a manual override and can assign any configured
league, including League 7, without promotion or relegation policy restrictions.

### Signup workflow

Keep the upstream signup workflow for now, backed by the players table:

- `/signup` runs in `#league-signups` for players without a league role. The signup
  channel must be configured per guild in `guilds.ts`.
- A returning player with a saved league receives that role again.
- A new applicant sends a reviewer a profile summary with current and peak Elo,
  Ranked average and PB, a profile link, and a suggested league based on the
  nearest upstream peak-Elo target. The reviewer chooses the actual league.
- Prevent duplicate pending requests. The reviewer can select a league, confirm
  the selection, go back, or deny the request. Confirmation assigns the role,
  saves the player, clears the request, and sends the welcome DM. Denial clears
  the request and notifies the applicant.
- Preserve signup-channel moderation: delete messages from non-bot members who
  do not have the League Helper role.

Store pending signup state in SQLite as well. Resolve Discord configuration
through the application's guild configuration rather than copying upstream's
hardcoded reviewer identity into handlers.

### Future website integration

Catch and report website errors while allowing the bot to continue its normal
local and Discord work. A website failure must not prevent competition
operations. Website integration and its retry or reconciliation behavior remain
future work; a successful bot operation does not imply successful publication.
