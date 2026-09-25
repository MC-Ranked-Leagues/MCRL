# Website publishing

The [architecture](../architecture.md) establishes that publication failures must
not block competition operations. A successful bot operation does not imply
successful publication.

## Direction agreed so far

- SQLite remains the live tournament state. After a successful local change, the
  bot calls a typed Convex mutation through `ConvexHttpClient`. Convex never
  determines points or movement policy.
- Replace the write HTTP routes with public Convex mutations. Each write mutation
  checks a supplied writer key against its Convex environment variable with a
  direct equality comparison. Keep the read HTTP route separate.
- Save every intended Convex call and its result in a local `backend_calls` table.
  Store the mutation name, exact arguments, guild, week, order, and outcome, but
  never the writer key. `/website export` produces JSON with all leagues,
  successful, failed, skipped, and unsent calls, their mutation arguments,
  timestamps, and errors. A replay script is outside this work. Attempt each
  normal call once, even when an earlier call failed; do not automatically retry
  failed or unsent calls on startup. Report failures in the command's private
  reply and the configured log channel.
- Host-only `/website status`, `/website pause`, and `/website resume` operate
  on the current competition selected by the league channel where the host runs
  them. Status reports whether publication is paused, not the failed-call count.
  Pause skips future sends but still records calls. Pause survives bot restarts.
  Resume enables only future sends; it does not backfill skipped calls. A
  backfill command may be considered later.
- `/advance_week` clears the past week's call records, including failures. Its
  confirmation should show failed and unsent counts and remind hosts to export
  records they need before confirming. It also clears every competition's pause
  state so the new week starts unpaused. Publication must not block advancement.
- `/import` creates or replaces a match directly. The new bot has no `/ns`.
  `/adjust` will be added later. Repeating `/nm` for an existing league and week
  warns the host rather than replacing anything; correcting a match remains an
  `/import` operation.
- After a late `/admin_reg`, send corrected full snapshots for every imported
  match. The bot already recalculates the points in SQLite.
- The website models Minecraft accounts. Discord identity and account migration
  relationships remain local to the bot. Make player creation possible on
  assignment, signup approval, migration approval, and registration. Migration
  does not retire the old Minecraft account from its last known league. The new
  account is created or updated in its assigned league. Returning to an old
  account updates that account's league without inventing a promotion event.
  Migration clears rolling percentage history for the old account and for the
  destination account if it already exists. Published matches, weekly results,
  and the percentages saved on past registrations remain attached to their
  Minecraft accounts.
- `/em` sends `currentPercentage` and `averagePercentage` for each registration
  as part of the movement preview, along with the expected movement. The two
  percentage values preserve the percentage earned that week and the average
  used for movement. `/relegate` sends the saved movements and marks them done.
  Store the pending/done marker on the competition, since the whole league is
  processed together. `/unend` removes the previews. Match imports do not send
  percentages.
- Convex continues sorting website standings by its existing points-and-time
  logic for this phase. `/em` does not send a separate final standing order.
- Configure two publishing guilds, development and production, each pointing to
  its own Convex deployment. Read deployment URLs and writer keys from bot
  environment variables so each developer can choose their development
  deployment. Development commands publish to the development deployment only.

## Proposed implementation

1. Add call logging within the same SQLite transactions as tournament changes
   where possible. Send calls after commit, in saved order. A shared publisher
   records each attempt's success or error and leaves local results intact.
2. Use `@mcrl/backend/api` references and `ConvexHttpClient` in the bot. Remove
   write route wrappers and their unused request validation after the mutations
   perform writer-key checks themselves.
3. Publish competition creation, registration, unregistration, match imports and
   clears, competition end and reopen, weekly movements, player league changes,
   and development commands that alter published data. Keep host selection,
   registration toggles, Discord messages, and role changes local.
   `/advance_week` changes only the local call log.
4. Build match payloads from saved SQLite rows so a corrected import and late
   registration send the same complete match representation. Send `/em` movement
   previews and the final decisions saved by `/relegate`, including each
   registration's percentage data. Remove preview values on `/unend`.
5. Make competition creation non-destructive when the same league and week
   already exist. This does not affect `/import`, which replaces a selected match.
6. Add focused verification for the local call log, typed payloads, mutation
   authorization, and the workflows whose data changes in more than one place.
7. Update the website workflow in `SPEC.md` when implementation starts: `/ns` is
   removed, `/import` creates matches, website writes follow local saves, and
   Convex currently sorts standings from the submitted results.
