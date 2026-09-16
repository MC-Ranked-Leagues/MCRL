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

Use SQLite for persistent players and pending signup requests, replacing the old
JSON files. Retain upstream's signup review and channel moderation workflow.
Resolve the signup channel, reviewer, and roles through guild configuration,
including Manage Messages permission for deleting member messages in that channel.

The [account migration proposal](plans/player-accounts.md) still needs agreement.
Preserve current account and registration behavior until it is approved, including
admin registration with a supplied Minecraft username.

## Weekly finalization

When implementing `/em`, append `Missed: {list player names here}` below the final
table for registrations with no played matches. Include players with no result
rows or only missed placeholders; omit the line when nobody missed the entire
competition. Use Minecraft names and preserve registrations and results. Players
with a played DNF remain in the ranked table.

Retain only each player's latest three participating-week placements, tagged with
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
