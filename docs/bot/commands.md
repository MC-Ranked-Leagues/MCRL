# Bot commands

Player commands operate on the league associated with the current information
or chat channel. Host commands require the configured command role.

| Command                           | Use                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/signup`                         | Request reviewed league placement in the signup channel, or restore a saved league role.                                                                                                                |
| `/migrate_account`                | Confirm a new Discord-linked Minecraft account and request host approval.                                                                                                                               |
| `/nm week`                        | Start a competition and post its registration list in the league's information channel. Only one competition can be active per league.                                                                  |
| `/reg`                            | Register your Discord-linked MCSR Ranked account. Registration must be open and your single league role must match. Creates your player entry or updates its league; account changes require migration. |
| `/admin_reg user [force]`         | Register the Discord-linked account even when registration is closed. Role and stored league must match unless force is true. Force applies only to this competition.                                   |
| `/unreg`                          | Remove your registration while registration is open, provided you have no results in an imported match.                                                                                                 |
| `/assign user league`             | Update existing stored membership and replace the user's configured league roles. Works in any server channel and can assign League 7.                                                                  |
| `/toggle_registration`            | Open or close registration for the current league.                                                                                                                                                      |
| `/import match_id [match_number]` | Import an MCSR Ranked match. Omit the number to create the next match; supply a number to create or replace that match and all its results. Unregistered Ranked players are reported and excluded.      |
| `/clear [match_number]`           | Delete a match and its results, defaulting to the latest match. Registrations and other match numbers remain unchanged.                                                                                 |
| `/em`                             | End the active competition, close registration, and post final standings. Requires at least one imported match.                                                                                         |
| `/dm`                             | Delete the active competition and all registrations, matches, and results after confirmation within 60 seconds.                                                                                         |

`/test_fill match_id` is a host command available only when the guild has
`dev: true`. After confirmation within 60 seconds, it adds the match's players
as test registrations with persistent test-player entries, skipping registered accounts
and accounts owned by real players. Existing test membership and placements are preserved. It works
with registration closed and does not import results. Run `/import` separately.
Cancel or let the confirmation expire to leave registrations unchanged.

`/test-clear` is also a host command restricted to `dev: true` servers. After
confirmation within 60 seconds, it removes only `/test_fill` registrations from
the current league's active competition, even when registration is closed.
Their result rows are deleted by the registration foreign key. The competition,
matches, regular registrations, and other players' saved results remain.
Remaining players' points and placements are not recalculated. Re-import a match
to recalculate them if needed.
It refreshes the registration list and any existing leaderboard. If a refresh
fails, the deletion remains saved; run `/test-clear` again to retry.
It also deletes persistent test players registered in that competition or assigned
to its league, including their retained placements. Registration snapshots in
other competitions remain. Real player membership is preserved.

Registration commands refresh the registration list; `/import` and `/clear`
refresh the separate leaderboard. Saved changes remain if a Discord refresh
fails; the bot reports the failure to the host.

`/em` preserves registrations and results. The final leaderboard includes played
DNFs and lists Minecraft names of players who missed the entire competition below
the table.
If a message update fails, run `/em` again before starting another competition.
With no active competition, it refreshes the most recently ended competition's
messages.

Every completed or failed slash command is logged with the actor, invocation
channel, command text, and interaction timestamp in the configured log channel.

`/admin_unreg` is intentionally not registered and is unavailable.

`/signup` sends the configured reviewer a DM containing Ranked profile details and
league selection buttons. The reviewer selects a league and confirms, or denies
the signup. The pending player survives restarts; repeat `/signup` to retry
review message delivery. A rejected signup stays on the player entry; contact a
host for reconsideration through `/assign`. Existing members with a saved league can restore its role.
Members who already have a league role can create their player entry with `/reg`.

`/migrate_account` requires linking the new Minecraft account to Discord on Ranked
first. Confirmation expires after 60 seconds. The reviewer must have the host role;
the review shows old and new account names, current league, previous request and
approval counts, and the last approved migration date.
A pending request survives restarts. Repeating the command retries delivery of the
original request and does not replace its destination account. The reviewer can
deny a stale request so the player can submit another.

Approval keeps the current league, clears retained placements, and leaves old
registrations and results attached to the old account. Active competition
registration blocks migration. Neither `force` nor a Minecraft name change
bypasses account ownership checks.

If signup approval succeeds but Discord role updates fail, the membership remains
saved. Retry roles through `/assign` or `/signup`. Notification failures do not
undo approved changes. `/assign` can set membership for a player created by forced
registration without an existing league role.
