# Bot commands

Player commands operate on the league associated with the current information
or chat channel. Host commands require the configured command role.

`/me`, `/ranked`, and `/twitch` work in any server channel and reply privately.
`/me` shows your saved Ranked Leagues account, league, membership status, and
retained placements for this server. `/ranked` looks up your currently
Discord-linked MCSR Ranked account and shows current-season Elo, peak Elo,
completions, average completion time, PB, and a profile link. It does not require
a saved league account.

| Command                           | Use                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/signup`                         | Request reviewed league placement in the signup channel, or restore a saved league role.                                                                                                                |
| `/migrate_account`                | Confirm a new Discord-linked Minecraft account and request host approval.                                                                                                                               |
| `/nm week`                        | Start a competition and post its registration list in the league's information channel. Only one competition can be active per league.                                                                  |
| `/twitch username`                | Save the Twitch username used by registration exports.                                                                                                                                                  |
| `/reg [streaming]`                | Register your Discord-linked MCSR Ranked account. Streaming uses the saved `/twitch` username or the Twitch account linked on Ranked. Registration must be open and your single league role must match. |
| `/list`                           | Export the current registration list as a `.ranked` file. Streaming registrations include the player's saved Twitch username.                                                                           |
| `/admin_reg user [force]`         | Register the Discord-linked account even when registration is closed. Role and stored league must match unless force is true. Force applies only to this competition.                                   |
| `/unreg`                          | Remove your registration while registration is open, provided you have no results in an imported match.                                                                                                 |
| `/assign user league`             | Assign league membership and replace the user's league roles. Works in any server channel and can assign League 7.                                                                                      |
| `/toggle_registration`            | Open or close registration for the current league. Cannot reopen while imported matches remain.                                                                                                         |
| `/import match_id [match_number]` | Import an MCSR Ranked match. Omit the number to create the next match; supply a number to create or replace that match and all its results. Unregistered Ranked players are reported and excluded.      |
| `/clear [match_number]`           | Delete a match and its results, defaulting to the latest match. Registrations and other match numbers remain unchanged.                                                                                 |
| `/em`                             | End the active competition, close registration, and post final standings. Requires at least one imported match.                                                                                         |
| `/unend`                          | Make the most recently ended competition active again with registration closed, then refresh its messages. Fails if another competition is active for the league.                                       |
| `/dm`                             | Delete the active competition and all registrations, matches, and results after confirmation within 60 seconds.                                                                                         |

`/test_fill match_id` and `/test-clear` require the host role and a `dev: true`
server. Both require confirmation within 60 seconds and work with registration
closed.

`/test_fill` adds the match's players as test registrations, skipping registered
accounts and accounts owned by real players. Run `/import` separately for results.

`/test_migrate ign` requires the host role and a `dev: true` server. It immediately
changes only your saved Minecraft UUID and IGN in that server, using the supplied
Ranked account. Your actual Ranked Discord link, league, and retained placements
stay unchanged. It rejects active competition registrations, pending migrations,
and accounts owned by another player in the same server. No separate database is
needed; your membership in other servers is unaffected.
Run `/reg` with registration open and the matching league role to check the account
mismatch, then `/migrate_account` and complete host approval to return to your real
account. Approval clears retained placements as usual.

`/test-clear` removes the current competition's test registrations and results,
and clears test membership and placements for its league. Regular players and
other competitions' registrations remain. Re-import matches to recalculate the
remaining players' points and placements if needed. If the Discord refresh fails,
run `/test-clear` again.

The first successful `/import` closes registration and refreshes both the
registration list and leaderboard. `/admin_reg` adds missed results for previous
imports, recalculates points using the current registration count, and refreshes
both messages. Re-import a match explicitly to recover a late player's actual
result. Before any imports, registration only refreshes the registration list.
`/clear` refreshes the leaderboard and deletes it when no imported matches remain.
Clearing every import permits manual reopening
with `/toggle_registration`. Saved changes remain if a Discord refresh
fails; the bot reports the failure to the host.

`/reg streaming:true` saves the Twitch username already set through `/twitch`,
or imports the Twitch connection from the linked MCSR Ranked profile. If neither
exists, registration stops and asks the player to run `/twitch` first. `/list`
then exports the saved username for streaming registrations.

`/twitch username` accepts a username, an `@handle`, or a Twitch profile URL
with or without `https://`. It trims surrounding whitespace and saves the
username in lowercase. Invalid characters and URLs are rejected. Usernames may
contain letters, numbers, and underscores, up to 25 characters.

`/em` preserves registrations and results. The final leaderboard includes played
DNFs and lists Minecraft names of players who missed the entire competition below
the table.
If a message update fails, run `/em` again before starting another competition.
With no active competition, it refreshes the most recently ended competition's
messages.

`/unend` clears the end timestamp but preserves registrations, matches, results,
and message IDs. Registration remains closed. Once active again, the normal
`/import`, `/clear`, `/admin_reg`, and `/dm` behavior applies. If a competition is
already active for the league, `/unend` changes nothing, including its messages.

Every completed or failed slash command is logged with the actor, invocation
channel, command text, and interaction timestamp in the configured log channel.

`/admin_unreg` is intentionally not registered and is unavailable.

`/signup` sends the reviewer a Ranked profile summary to approve or deny.
Repeat the command to retry review delivery or restore an assigned league role.
Contact a host to reconsider a rejected signup through `/assign`.

`/assign` creates missing players using their Discord-linked Ranked account.
Existing players keep their account and performance history.

`/migrate_account` requires linking the new Minecraft account to Discord on Ranked
first. Confirmation expires after 60 seconds. Host approval keeps the league,
resets retained placements, and leaves old results attached to the old account.
You cannot migrate while registered in an active competition.

Repeat `/migrate_account` to retry review delivery. This keeps the original
request; a host must deny it before you can request a different account.

If approval or assignment succeeds but role updates fail, retry through `/assign`
or `/signup`. Notification failures do not undo approved changes.
