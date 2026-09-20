# Bot decisions

Keep requirements and constraints here, command usage in [commands](commands.md),
and open questions in [plans](plans/README.md).

## Rewrite scope

CrossaintBot commit
[`208931988f52`](https://github.com/BoboTheFlyngBox/CrossaintBot/tree/208931988f5240874da4ab4f0e5b64f1e6478f43)
is the reference for explicitly retained behavior, not the whole rewrite's spec.
Keep its seed points formula and signup review workflow. Championships,
best-of-three reporting and review, and z-scores are excluded.

General movement uses rolling placements. Upstream percentage quotas, all-DNF
rules, demotion cooldown, and movement tie-breakers do not carry over.

## Participation

Order registrations by current-season peak Elo captured at registration, falling
back to saved current Elo when peak Elo is unavailable.

A played DNF counts as participation; a missed match does not. Players who have
not played remain registered so they can join later rounds. Imports and
finalization must not unregister them. Explicit unregistration preserves the
persistent player.

The first successful import closes self-service registration. Hosts cannot reopen
registration while imported matches remain; late additions use `/admin_reg`.
Clearing all imported matches allows a host to reopen registration manually.

Late registration adds a missed result for every earlier imported match and
recalculates each match's points using the full current registration count.
Existing placements remain unchanged. Earlier missed matches count at their time
limits toward the late player's average; only players who participate appear in
the standings. Recover an actual earlier performance by explicitly re-importing
that match. Registration and scoring changes are saved together.

## Player identity and registration

Identity is the guild and Discord ID together. Each Minecraft UUID belongs to
only one player per guild. A challenge account requires a separate Discord
account; Minecraft name changes never change identity.

Existing members enter storage through registration or assignment; no role import
or legacy player-data backfill is required. The database baseline targets fresh
databases.

Players save their current Twitch username with `/twitch`. Each competition
registration separately records whether the player is streaming. Registration
uses that saved username, falling back to the Twitch connection on the player's
MCSR Ranked profile. Streaming registration requires one of those usernames.
Exports include it only for registrations that opted in.

Normal registration adopts the player's single matching league role. Forced
registration bypasses league checks for that competition only; it must never
bypass account checks or change existing membership or roles. New players without
an unambiguous league role remain unassigned until `/assign`.

`/assign` creates missing players from their Discord-linked Ranked account and
activates pending or rejected players. Assigning an existing player preserves
their account and performance history. Stale signup reviews must not overwrite
membership activated through registration or assignment.

`/admin_unreg` is intentionally unavailable. Test-player cleanup must preserve
regular players and registration snapshots in other competitions.

## Account migration

Account changes require player confirmation and host approval. Host review makes
repeated switches visible instead of allowing self-service placement resets.
Reject destinations owned by another player and block migration during any active
competition registration. Recheck ownership, registration, and the Ranked link
at approval.

Approval preserves membership but clears retained placements. The new pairing
starts with no history, not zero placements. Old competition snapshots and
published results never transfer. Account versions keep those histories separate
even when a player returns to an earlier UUID; weekly finalization must retain
placements only for the current version.

Migration review shows prior request and approval counts and the last approved
migration date. Keep the audit history through later migrations and placement
resets. Rejected requests are not completed account changes.

## Weekly finalization

During `/relegate`, retain the latest three participating-week placements, with
week and league. Skipped weeks neither count as zero nor consume a slot; age does
not expire a placement. `/past` will show these placements. Published history
belongs in Convex; add no separate local results-history table.

Guild-wide `/relegate` will finalize movements, advance the stored guild week,
and clean up completed competitions while preserving players and placements.
`/nm` will use that week. Remove temporary `/dm` when `/relegate` replaces it.
Preserve old registration and leaderboard messages during cleanup.

## League movement

Compare rolling average placement over the last three participating weeks.
[Movement counts, ties, and short histories](plans/weekly-lifecycle.md) remain
open; do not inherit those policies from upstream.

League 7 qualifies separately. At least one played match and either an imported
finish strictly under 25 minutes or a competition average strictly under 30
minutes promotes the player to League 6. Use that competition's results,
independently of rolling placements. Automatic relegation stops at League 6;
manual assignment can use any configured league, including League 7.
