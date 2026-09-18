# Bot decisions

These are agreed requirements, including work that is not implemented yet.
Use current code to check what has been built. Keep implementation descriptions
in code and user-facing command usage in [commands](commands.md).

## Rewrite scope

The reference is CrossaintBot commit
[`208931988f52`](https://github.com/BoboTheFlyngBox/CrossaintBot/tree/208931988f5240874da4ab4f0e5b64f1e6478f43),
available locally under `.tmp/CrossaintBot` when cloned. Consult it for behavior
explicitly retained below; it is not a specification for the whole rewrite.
Championships, best-of-three score reporting and review, and z-scores are excluded.

Keep the upstream seed points formula. General promotion and relegation policy
changes to rolling placements; upstream percentage quotas, all-DNF rules,
demotion cooldown, and movement tie-breakers do not carry over.

## Competition corrections and host control

Use an explicit Ranked match ID for imports, without an `/ns` step or host match-ID
lookup. Hosts can replace a numbered match or clear it without renumbering others.

Order registrations by current-season peak Elo captured at registration, with an
explicit saved-current-Elo fallback when peak Elo is unavailable.

Players who have not played remain registered so they can join later rounds.
Imports and finalization must not unregister them. A played DNF counts as
participation; a missed match does not. Explicit unregistration remains a
separate host or player action and preserves the future persistent player record.

## Player persistence and signup

Use SQLite for persistent players. Signup creates a player with pending status;
approval activates that same player and rejection retains it with rejected status.
Store signup review details on the player, with no separate signup-request table. Retain upstream's signup review and channel moderation workflow.
Resolve the signup channel, reviewer, and roles through guild configuration,
including Manage Messages permission for deleting member messages in that channel.
A rejected signup can be reconsidered through host assignment. Registration with
a valid league role can activate a pending player; stale review buttons must not
overwrite that membership. This implementation targets fresh databases; no legacy
player-data adoption or backfill is required.

### Player identity and registration

Player identity is the guild and Discord ID together. Within a guild, both
Discord IDs and active Minecraft UUIDs are unique across players. A separate
challenge account requires a separate Discord account. Minecraft name changes
never change identity.

Normal `/reg` requires exactly one configured league role matching the channel.
It creates a missing player from the Discord-linked Ranked account, or updates
an existing player's stored league to match that role. A different linked UUID
must stop registration before changing membership and direct the player to
`/migrate_account`, naming both the saved and currently linked accounts. Existing
members join storage lazily through registration; no role-scraping import is
required.

`/admin_reg` only uses the Discord-linked account; remove `mc_username`. Without
`force`, both the player's role and existing stored league must match the target
competition. `force` bypasses league checks for that competition only and never
bypasses account checks or changes existing league membership or roles. For a
new player, preserve their single league role as membership; without an
unambiguous role, leave membership unassigned until `/assign`.

`/assign` changes roles and updates membership when a player entry exists.
`/admin_unreg` is intentionally excluded from the command registry.

Test registrations create explicitly marked persistent players with stable
synthetic Discord IDs so they can participate in multi-week testing. Test cleanup
removes their membership and retained placements as well as the selected
competition's test registrations and results; regular players are preserved.

### Account migration

`/migrate_account` resolves the newly Discord-linked Ranked account and asks the
player to confirm the old and new accounts before requesting host approval.
Reject destinations already owned by another player in the guild. Block migration
while the player is registered in any active competition. Recheck these conditions
and the Ranked link when approving a saved request.

Approval replaces the active Minecraft link on the existing player, preserves
league membership, and clears retained placements. The new pairing starts with
no performance history, not zero placements. Migration does not register the new
account. Competition registration snapshots and published results keep their old
UUID and are never transferred. Account versions distinguish registrations made
before and after a migration, even if a player later returns to an earlier UUID.
Future weekly finalization must only retain placements for the current version.

Retain migration requests with old and new UUIDs and names, request and decision
times, reviewer, and outcome. Show previous request and approved-migration counts
to the reviewing host, together with old and new account names, current league,
and last approved migration date. Keep detailed history in storage; do not send
a file attachment or raw database identifiers in the review. Rejected requests are not completed
account changes. This history survives subsequent migrations and placement resets.
Host review makes repeated switches visible instead of allowing self-service
placement resets. A separate `/admin_migrate` is deferred until needed.

## Weekly finalization

When implementing `/em`, append `Missed: {list player names here}` below the final
table for registrations with no played matches. Include players with no result
rows or only missed placeholders; omit the line when nobody missed the entire
competition. Use Minecraft names and preserve registrations and results. Players
with a played DNF remain in the ranked table.

During `/relegate`, retain only each player's latest three participating-week placements, tagged with
week and league. Skipped weeks neither count as zero nor consume a slot. The
rolling average uses those three placements regardless of age. `/past` will show
them. Published history belongs in Convex; add no separate local results-history
table.

Guild-wide `/relegate` will finalize movements, advance a stored guild week, and
clean up completed competitions while preserving players and their retained
placements. `/nm` will use the stored week. Remove temporary `/dm` cleanup when
`/relegate` replaces it. Preserve old registration and leaderboard messages in
Discord during weekly cleanup.

## League movement

Compare players by rolling average placement over their last three participating
weeks. [Movement counts, ties, and short histories](plans/weekly-lifecycle.md)
remain open; do not inherit those policies from upstream.

Retain League 7's separate qualification rule: at least one played match and either
a valid imported finish strictly under 25 minutes or a competition average
strictly under 30 minutes promotes the player to League 6. Use that competition's
results independently of rolling placements. Automatic relegation stops at League 6. Manual `/assign` can assign any configured league, including League 7.
