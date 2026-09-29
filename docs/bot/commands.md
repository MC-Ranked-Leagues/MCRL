# Bot commands

League commands use the current information or chat channel. Host commands require
the configured command role. Replies are private; registration lists and
leaderboards are public. Discord role, message, notification, or logging failures
do not undo saved changes. Commands are logged with their actor, channel,
invocation, and timestamp in the configured log channel.

Website failures also leave saved changes intact and produce a private notice
and log entry. Writes are not stored or retried. If manual website repair is
needed, the owner should copy SQLite before `/advance_week`. Week advancement
does not wait for the website.

## Player commands

Use `/signup` in the signup channel, and `/reg` or `/unreg` in your league's
information or chat channel. Other player commands work in any server channel.
If you have exactly one league role but no saved account, `/signup`, `/me`, and
`/twitch` save your linked Ranked account in that league without review.

### `/signup`

Request reviewed league placement. Repeat to retry review delivery or restore an
assigned league role. A host can reconsider a rejected signup through `/assign`.

### `/me`

Show your saved account, league, and percentage history.

### `/ranked`

Look up your Discord-linked MCSR Ranked profile without a saved league account.

### `/link`

Show a guide to linking Discord in the MCSR Ranked client.
Run `/ranked` afterward to check the link.

### `/twitch username`

Save a Twitch username for streaming registrations. Accepts a username,
`@handle`, or Twitch profile URL.

### `/reg [streaming]`

Register your Discord-linked MCSR Ranked account. Registration must be open and
your single league role must match. If configured, registration also grants the
current week role.

With `streaming:true`, use your saved Twitch username or import the Twitch
connection from your Ranked profile. If neither exists, set one with `/twitch`
first.

### `/unreg`

Remove your registration while registration is open, provided you have no results
in an imported match. If configured, this also removes the current week role when
you have no other registration.

### `/migrate_account`

Request host approval for a new Minecraft account after linking it to Discord on
Ranked. Confirm within 60 seconds. You cannot migrate while registered in an
active competition.

Approval keeps your league, clears retained percentages, and leaves old results
with the old account. Repeat to retry review delivery; a host must deny the
pending request before you can request a different account. If approved role
updates fail, retry through `/signup` or `/assign`.

## Host commands

### `/nm`

Start a competition for the server's stored week and post its registration list
in the league's information channel. Only one competition can be active per league.

### `/list`

Export the current registration list as a `.ranked` file, including saved Twitch
usernames for streaming registrations.

### `/admin_reg user`

Register a Discord-linked account even when registration is closed. The player's
league role must match. If the player has no saved membership, registration creates
it from that role; otherwise the saved league must match. Resolve mismatches
through `/assign`. If configured, registration grants the current week role.

Fetch and re-import every earlier match before saving the registration, so a
player who participated receives their actual results. If any match cannot be
fetched or saved, leave the registration and all results unchanged.

### `/admin_unreg user`

Remove a player and their imported results from the active competition, then
recalculate the remaining players' placements and points. Use `/unend` first if
the competition has ended; finalized competitions cannot be reopened. This does
not ban the player from registering again while registration is open. If
configured, it removes the current week role when no other registration remains.

### `/assign user league [preserve_history]`

Assign league membership and replace league roles, including League 7. Works in
any server channel. Creates missing players from their Discord-linked Ranked
account; existing players keep their account.

Changing league clears percentage history unless `preserve_history:true` is set.
Same-league assignments keep history. Blocked if the player participated in a
competition that has not used `/relegate`. Retry assignment if role updates fail.

### `/toggle_registration`

Open or close registration for the current league. Reopening requires clearing
all imported matches first.

### `/host [mc_name]`

Set the host Minecraft account for the active competition. Omit the name to use
your Discord-linked Ranked account, or supply a Minecraft name to use another
account. Repeating the command replaces the host for this competition.

### `/import [match_id] [match_number]`

Import an MCSR Ranked match. Omit the ID to use the newest private game in the
saved host's Ranked match history. Supply an ID to choose a match directly, even
when no host is set. Omit the number to create the next match; supply one to
create or replace that match and all its results. Unregistered Ranked players
are reported and excluded. The first successful import closes registration.

### `/clear [match_number]`

Delete a match and its results, defaulting to the latest match. Registrations and
other match numbers stay unchanged. Clearing every import removes the leaderboard
and allows manual reopening of registration.

### `/em`

End the active competition, close registration, and post final standings. Requires
at least one imported match. Preserves registrations and results.

If configured, removes the current week role from this competition's registered
players. Repeat `/em` to retry failed role removals.

Movement is a preview until relegation, then uses saved decisions. If a message
update fails, repeat before starting another competition. With no active
competition, refreshes the most recently ended competition's messages.

### `/unend`

Reopen the most recently ended competition with registration closed. Preserves
registrations and results; result editing and host registration resume.
Unavailable after relegation or while another competition is active in the
league. Does not reapply the current week role.

### `/relegate [force]`

Apply current-week movements across all configured leagues. Requires an ended
competition in each league; `force:true` skips missing or active competitions.
Already processed competitions are skipped, so later runs can finish skipped
leagues without reapplying movements.

Saves membership, percentage history, and movement decisions together. Keeps
competitions and the current week. Result edits and `/unend` are then blocked.

Attempts Discord role updates once and reports failures for manual correction.
Members left without a league role can re-apply through `/signup`. Repeating the
command does not retry roles for processed competitions.

### `/advance_week [force]`

After confirmation, delete every competition in the server, including
registrations, matches, and results, and advance the stored week. Preserves
players, retained percentages, and Discord messages.

Does not change the current week role; `/em` removes it when a competition ends.

Every competition must have used `/relegate` unless `force:true` is set. Rechecks
this at confirmation and cancels if the stored week changed in the meantime.

## Development commands

The test commands require the host role and a `dev: true` server.

### `/dev_change_week week`

Set the stored week without changing competitions. Only the server's configured
developer can use it.

### `/relegate_reapply [week]`

Re-apply Discord league roles from saved relegation movements without changing
memberships, history, or competitions. Only the server's configured developer
can use it. Reports failures for manual correction; members without a league
role can re-apply through `/signup`.

### `/test_fill match_id`

After confirmation within 60 seconds, add the match's players as test
registrations, skipping registered accounts and accounts owned by real players.
Works with registration closed. Import the match separately for results.

### `/test-clear`

After confirmation within 60 seconds, remove the current competition's test
registrations and results, plus test membership and percentage history for its
league. Works with registration closed. Preserves regular players and other
competitions' registrations. Unused test Minecraft accounts are also removed
from the development website.
Accounts referenced by older published results remain there for that history,
with their rolling percentage history cleared.

Re-import matches if remaining players' points and placements need recalculating.
Repeat if the Discord refresh fails.

### `/test_migrate ign`

Immediately replace your saved Minecraft UUID and IGN in this server with the
supplied Ranked account. Keeps your actual Ranked Discord link, league, retained
percentages, and membership in other servers. Rejects active registrations,
pending migrations, and accounts owned by another player in this server.

To test migration, run `/reg` with registration open and the matching league role
to see the account mismatch, then `/migrate_account` and complete host approval to
return to your real account. Approval clears retained percentages as usual.
