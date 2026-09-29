# Bot decisions

Keep rationale, constraints, and tournament rules that code alone cannot explain
here. Preserve explicit rules where a bug could be mistaken for policy. Command
usage belongs in [commands](commands.md), and open questions in
[plans](plans/README.md).

## Rewrite scope

CrossaintBot commit
[`208931988f52`](https://github.com/BoboTheFlyngBox/CrossaintBot/tree/208931988f5240874da4ab4f0e5b64f1e6478f43)
is the reference for explicitly retained behavior, not the whole rewrite's spec.
Keep its seed points formula and signup review workflow. Championships,
best-of-three reporting and review, and z-scores are excluded.

General movement uses rolling percentages under the rules below. Do not infer
additional movement rules from the old bot.

## Participation

Order registrations by current-season peak Elo captured at registration, falling
back to saved current Elo when peak Elo is unavailable.

A played DNF counts as participation; a missed match does not. Players who have
not played remain registered so they can join later rounds. Imports and
finalization must not unregister them.

The first successful import closes self-service registration. Hosts cannot reopen
registration while imported matches remain; late additions use `/admin_reg`.
Clearing all imported matches allows a host to reopen registration manually.

Each competition stores its own host Minecraft UUID. When an import omits the
match ID, use the newest private game in that account's Ranked history. An
explicit match ID remains available when the host played an unrelated game.

Late host registration fetches every earlier imported Ranked match before saving
anything. Registration and all match replacements then commit together; if a
fetch or replacement fails, none of them are saved. Re-import each match with the
full current registration count so a late player who played receives their
result and everyone's placements and points reflect that player. Earlier matches
the player missed count at their time limits toward their average; only players
who participate appear in the standings.

## Player identity and registration

Identity is the guild and Discord ID together. Each Minecraft UUID belongs to
only one player per guild. A challenge account requires a separate Discord
account; Minecraft name changes never change identity.

No bulk role import or legacy player-data backfill is required; the rewrite targets
fresh databases.

When a player with exactly one configured league role uses `/signup`, `/me`, or
`/twitch` without a saved account, save their linked Ranked account and adopt that
role as their active league. Do not change an existing account through this path.
Players without a role use the reviewed signup flow.

Streaming is opt-in per competition. Only streaming registrations include Twitch
usernames in exports.

Normal registration adopts the player's single matching league role.
`/admin_reg` also adopts a matching role when the player has no saved membership,
and can register after registration closes. Existing saved membership must match
the role and league. It has no force option. Use `/assign` to resolve league
mismatches before registering.

When configured, successful `/reg` and `/admin_reg` registrations add the current
week role. `/unreg` and `/admin_unreg` remove it when the player has no other
registration, and
`/advance_week` clears it from the remaining registered players. Discord role
failures do not undo saved changes and must be corrected manually.

Manual assignment preserves the account but clears percentage history when the
league changes, unless the host explicitly chooses to preserve it. Assignments
are blocked while the current account has participated in a competition that has not used `/relegate`, including played DNFs. Registration
alone does not block assignment. Same-league assignments preserve history.
Stale signup reviews must not overwrite membership activated through registration
or assignment.

`/admin_unreg` removes one registration from an active competition, even after
matches have been imported. Remove that player's match results and recalculate
each imported match's placements and points as if they had never registered.
Refresh the registration list and leaderboard. An ended competition must be
reopened with `/unend` first; a relegated competition cannot be changed.
The command does not ban the player from registering again. Test-player
cleanup must preserve regular players and registration snapshots in other
competitions.

## Account migration

Account changes require player confirmation and host approval. Host review makes
repeated switches visible instead of allowing self-service history resets.
Reject destinations owned by another player and block migration during any active
competition registration. Recheck ownership, registration, and the Ranked link
at approval.

Approval preserves membership but clears retained percentages. The new pairing
starts with no history, not zero percentages. Old competition snapshots and
published results never transfer. Account versions keep those histories separate
even when a player returns to an earlier UUID; weekly finalization must retain
percentages only for the current version.

Migration review shows prior request and approval counts and the last approved
migration date. Keep the audit history through later migrations and history
resets. Rejected requests are not completed account changes.

## Weekly finalization

Only `/relegate` appends percentage history. Keep at most three entries, each with
its week and league. Staying appends the actual current percentage. Promotion
clears all history. Automatic demotion preserves prior entries and appends 85%
instead of the current percentage. This bonus gives no immunity or cooldown, and
manual assignment does not grant it.

Missing the entire competition leaves history unchanged. Skipped weeks neither
count as zero nor consume a slot; calendar age does not expire an entry. No
history is distinct from 0%.

Published history belongs in Convex; add no separate local results-history table.

Movement finalization and week cleanup are separate, deliberate host actions.
Cleanup requires every competition to have used `/relegate`, unless explicitly
forced. It preserves players, percentage history, and Discord messages.

Before writing, `/relegate` checks every configured league. Without `force`, a
missing current-week competition or any active competition blocks the whole
operation. With `force`, skip those leagues. Process only ended competitions for
the stored guild week, once each, including empty competitions. A later run can
finish previously skipped leagues.

Calculate every eligible league before changing memberships, and save all
movements and history together. Preserve the movement decisions and averages from
before history resets or the 85% replacement so later displays cannot change the
recorded outcome.

An old account snapshot uses no history from the new account version and cannot
change that account's membership or history. Its competition decision remains on
the registration. `/unend` and result edits are blocked after relegation.

Saved movement is authoritative even if Discord role updates fail. Hosts correct
failed roles manually; repeating finalization must not reapply movement. Test
players do not receive Discord role updates.

Role updates remove the previous league role before adding the new one, naming
only league roles in single-role updates so unrelated roles are never touched.
A failed addition therefore leaves no role instead of a wrong one; members
without a league role re-apply through `/signup`.

## League movement

Weekly order is points descending, average time ascending, then Minecraft name
alphabetical. For positive-point rank `r` among `S` positive-point players, the
current percentage is `100 * (S - r + 1) / S`. All zero-point participants get 0%.
Five scoring players therefore receive 100%, 80%, 60%, 40%, and 20%.

Average the unstored current percentage with the latest two saved percentages.
Use only available entries, with no minimum history or zero padding. Compare
unrounded values and round only for display. Break equal movement averages by
final weekly placement.

Each promotion and demotion quota is `Math.round(participants * 0.15)`. Count only
registered players who played, including played DNFs. Players who missed the
entire competition are ineligible even if they have saved history. The weekly
winner occupies one promotion slot; fill the remaining slots by movement average.
Demote every eligible player with a zero rolling percentage average, even if
that exceeds the quota. If fewer have zero averages, fill the remaining quota
from the bottom of the ranking. Exclude promoted players. League 1
cannot promote, and League 6 cannot demote.

For tiny fields, a rounded quota of zero adds no quota-based movements; the
zero-average demotion rule still applies. An all-zero field uses the
existing weekly order to select its winner. These are implementation defaults
for cases without a separate tournament policy.

League 7 qualifies separately. At least one played match and either an imported
finish strictly under 25 minutes or a competition average strictly under 30
minutes promotes the player to League 6. Use that competition's results,
independently of rolling percentages. League 7 uses no percentage average
and appends no percentage history. Qualifying promotions clear history on entering
League 6. Automatic relegation stops at League 6; manual assignment can use any
configured league, including League 7.

The final leaderboard previews the same movement calculation used by relegation
without changing membership or history. After finalization, it uses the saved
decisions.

## Website publication

SQLite owns live operations. After a successful local save, start typed Convex
mutation calls in the same order as those saves, before awaiting Discord work.
Finish roles, messages, and the command reply without waiting for the website;
then report any website failure in a separate private notice and one short log
summary. Use one Convex client per deployment and a 60-second timeout per HTTP
request. A timeout can leave the remote outcome unknown.

Do not store backend calls, pause publication, or retry failed or unsent calls.
A failed update can cause later updates to fail or leave the website incomplete.
This is an accepted limitation. The owner can copy SQLite before `/advance_week`
and use it for manual repair; hosts do not need a recovery workflow. Website
availability must not block week advancement. Development and production guilds
publish to separate Convex deployments.

Keep each registration's final `currentPercentage` in SQLite so manual repairs
can use the saved weekly value. Keep rolling percentage history in Convex for
the future player statistics page. Its average can differ from the average used
to decide a completed week's movement, particularly after a promotion resets
history or a demotion appends 85%.

Normal match imports compare new valid times with the saved personal best.
Only corrections or deletions that affect that best need to recheck the player's
remaining history. At this event's scale, use straightforward queries without
arbitrary row-count cutoffs or separate large-roster paths.

The website treats Minecraft accounts independently of Discord identity.
Migration creates or updates the destination account and clears rolling
percentage history for both accounts. Published match results and historical
registration percentages remain intact; the old account keeps its last known
league. A return to that account updates its league without a promotion record.

`/em` ends the competition and publishes each registration's current and average
percentages with its expected movement in one Convex transaction. `/unend` removes that preview. `/relegate` publishes final
movement and marks the competition done. Convex sorts website standings from
the submitted match points and times for now. The implementation plan is in
[website publishing](plans/website-publishing.md).
