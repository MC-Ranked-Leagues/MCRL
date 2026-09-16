# Bot commands

Player commands operate on the league associated with the current information
or chat channel. Host commands require the configured command role.

| Command                           | Use                                                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/nm week`                        | Start a competition and post its registration list in the league's information channel. Only one competition can be active per league.                                                             |
| `/reg`                            | Register your Discord-linked MCSR Ranked account. Registration must be open and you need the league role or command role.                                                                          |
| `/admin_reg user [mc_username]`   | Register a player even when registration is closed or they lack the league role. Supply a Minecraft username to bypass the Discord-linked lookup.                                                  |
| `/unreg`                          | Remove your registration while registration is open, provided you have no results in an imported match.                                                                                            |
| `/admin_unreg user`               | Remove a player's registration and their match results, even when registration is closed.                                                                                                          |
| `/assign user league`             | Replace a user's configured league roles with the selected league role. Works in any server channel and can assign League 7.                                                                       |
| `/toggle_registration`            | Open or close registration for the current league.                                                                                                                                                 |
| `/import match_id [match_number]` | Import an MCSR Ranked match. Omit the number to create the next match; supply a number to create or replace that match and all its results. Unregistered Ranked players are reported and excluded. |
| `/clear [match_number]`           | Delete a match and its results, defaulting to the latest match. Registrations and other match numbers remain unchanged.                                                                            |
| `/em`                             | End the active competition, close registration, and post final standings. Requires at least one imported match.                                                                                    |
| `/dm`                             | Delete the active competition and all registrations, matches, and results after confirmation within 60 seconds.                                                                                    |

`/test_fill match_id` is a host command available only when the guild has
`dev: true`. After confirmation within 60 seconds, it adds the match's players
as test registrations, skipping already registered Minecraft accounts. It works
with registration closed and does not import results. Run `/import` separately.
Cancel or let the confirmation expire to leave registrations unchanged.

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
