# Bot commands

League commands use the current information or chat channel. Host commands require
the configured command role. Replies are private; registration lists and
leaderboards are public. Saved changes survive Discord refresh failures, which
are reported to the host. Commands are logged with their actor, channel,
invocation, and timestamp in the configured log channel.

## Player commands

### `/signup`

Request reviewed league placement in the signup channel. The reviewer receives a
Ranked profile summary. Repeat to retry review delivery or restore an assigned
league role. If you already have one league role but no saved account, `/signup`
saves your linked Ranked account in that league without review. A host can
reconsider a rejected signup through `/assign`.

### `/me`

Show your saved account, league, membership status, and retained percentages,
including latest-two and latest-three averages and entry count. Works in any
server channel. If you have one league role but no saved account, it saves your
linked Ranked account first.

### `/ranked`

Look up your Discord-linked MCSR Ranked account: current-season Elo, peak Elo,
completions, average completion time, PB, and profile link. Works in any server
channel without a saved league account.

### `/link`

Show a private, illustrated guide to linking Discord in the MCSR Ranked client.
Run `/ranked` afterward to check the link. Works in any server channel.

### `/twitch username`

Save the Twitch username shown in the registration list for streaming players
and used in streaming registration exports. Accepts a
username, `@handle`, or Twitch profile URL with or without `https://`. Trims
whitespace and saves lowercase. Usernames allow letters, numbers, and underscores,
up to 25 characters. Works in any server channel. If you have one league role but
no saved account, it saves your linked Ranked account first.

### `/reg [streaming]`

Register your Discord-linked MCSR Ranked account. Registration must be open and
your single league role must match. Before any imports, this refreshes only the
registration list. If configured, registration also grants the current week role.

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
updates fail, retry through `/signup` or `/assign`. Notification failures do not
undo approval.

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

For earlier imports, add missed results and recalculate points using the current
registration count. Re-import a match to recover the player's actual result.
Refresh both the registration list and leaderboard if matches exist, otherwise
only the registration list.

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
Refreshes the registration list and leaderboard.

### `/clear [match_number]`

Delete a match and its results, defaulting to the latest match. Registrations and
other match numbers stay unchanged. Refreshes the leaderboard, deleting it when
no imports remain. Clearing every import allows manual reopening of registration.

### `/em`

End the active competition, close registration, and post final standings. Requires
at least one imported match. Preserves registrations and results. Standings
include played DNFs, movement averages and markers, and a separate list of players
who missed the entire competition.

Movement is a preview until relegation, then uses saved decisions. If a message
update fails, repeat before starting another competition. With no active
competition, refreshes the most recently ended competition's messages.

### `/unend`

Reopen the most recently ended competition with registration closed and refresh
its messages. Preserves registrations, matches, results, and message IDs. Normal
result editing and host registration resume. Unavailable after relegation or
while another competition is active in the league.

### `/relegate [force]`

Apply current-week movements across all configured leagues. Requires an ended
competition in each league; `force:true` skips missing or active competitions.
Already processed competitions are skipped, so later runs can finish skipped
leagues without reapplying movements.

Saves membership, percentage history, and movement decisions together. Keeps
competitions and the current week. Result edits and `/unend` are then blocked.
The leaderboard already shows the movement values and does not need a refresh.

Attempts Discord role updates once and reports failed players and destination
leagues for manual correction. Failures do not undo movements or stop other role
updates. Repeating the command does not retry roles for processed competitions.

### `/advance_week [force]`

After confirmation, delete every competition in the server, including
registrations, matches, and results, and advance the stored week. Preserves
players, retained percentages, and Discord messages.

If configured, removes the current week role from remaining registered players
who hold it. Failed role removals are reported for manual correction and do not
undo week advancement.

Every competition must have used `/relegate` unless `force:true` is set. Rechecks
this at confirmation and cancels if the stored week changed in the meantime.

## Development commands

The test commands require the host role and a `dev: true` server.

### `/dev_change_week week`

Set the stored week without changing competitions. Only the server's configured
developer can use it.

### `/test_fill match_id`

After confirmation within 60 seconds, add the match's players as test
registrations, skipping registered accounts and accounts owned by real players.
Works with registration closed. Import the match separately for results.

### `/test-clear`

After confirmation within 60 seconds, remove the current competition's test
registrations and results, plus test membership and percentage history for its
league. Works with registration closed. Preserves regular players and other
competitions' registrations.

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

## Unavailable commands

`/admin_unreg` is intentionally unavailable.
