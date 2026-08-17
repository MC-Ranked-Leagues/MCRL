# Seed Manager Overview

## What This App Is

Seed Manager is a private web app for uploading, organizing, discussing, and publishing Minecraft speedrun seeds for league-based events. It is a Bun, Vite, React, React Router, and TypeScript SPA backed by Convex.

Seeds enter the application through a league-scoped uploader workflow. An upload immediately creates an active seed for the current tournament week; there is no review, voting, or Good/Bad rating stage. Each seed stores overworld, nether, end, and RNG values as strings, and the normalized overworld value is globally unique.

## Authentication and Roles

Discord is the only authentication provider. A signed-in user remains `pending` until an administrator activates the account.

- `admin` — full application, history, seed, user, league, and tournament access.
- `uploader` — uploads, views, comments on, and corrects seeds in assigned uploader leagues.
- `host` — views and comments on assigned host leagues and marks their active seeds used.

Roles can be combined. Server-side Convex checks are authoritative even when the frontend hides or disables an action.

## Seed Lifecycle

An uploaded seed is assigned to a league and the current week with `isExpired: false` and `isUsed: false`.

- **Active** — assigned to the current operating week and not expired.
- **Used** — played in the event. Marking used publishes it immediately in current-week public history and records who marked it and when.
- **Expired** — retained after week advancement and hidden from normal league routes.
- **Deleted** — permanently removed with its comments; an immutable audit event remains.

Uploaders are expected to upload usable seeds. The original uploader can correct the type and four seed values in place while the seed is active, unused, assigned to the current week, still in an accessible upload league, and seed testing is open. Deleting and re-uploading remains available for eligible seeds when replacing the record is preferable.

## Core Rules

- `overworld` is globally unique while a seed record exists.
- Seed values are stored as strings to avoid precision loss.
- Normal uploads require a league and the current week.
- Uploaders can upload only to uploader leagues; hosts can upload only to host leagues; admins can upload globally.
- Non-admin uploads are blocked while seed testing is paused.
- Active seed order is sequential within a league and week.
- Admins may move active unused seeds between leagues.
- Admins and hosts for the league may mark an active seed used.
- Only admins can reverse used state, through the unlocked admin archive.
- Used and expired seeds are read-only in normal workflows.
- Original uploaders can edit the type and seed values of their active, unused current-week seeds while testing is open and they retain access to the upload league.
- Comments are discussion history attached to a seed.

## Deletion

Normal seed deletion is available to:

- an administrator;
- the user who originally uploaded the seed; or
- a host assigned to the seed's league.

Normal deletion is blocked while seed testing is paused and for used or expired seeds. It permanently deletes the seed and all attached comments, compacts remaining seed numbers, updates active league counters, and writes a `seed.deleted` audit event. Because the seed record no longer exists, its overworld value can be uploaded again.

The admin seed archive is the explicit exception. After enabling modifications for the browser-tab session, an admin may delete current, used, expired, or historical assigned seeds.

## Seed Intake

The current upload surfaces accept one seed at a time and require:

- destination league;
- overworld seed;
- nether seed;
- end seed;
- RNG seed; and
- seed type.

Values are trimmed and validated as whole-number strings. Duplicate overworld values are rejected. The seed receives the next position in its league and current week, the league counter is incremented, and the upload is logged.

The `/app` upload surface also lists the current user's five newest accessible uploads from the current week. Eligible seeds can be edited in place without changing their ID, uploader, league, week, order, upload time, status, or comments. Successful edits preserve global overworld uniqueness and write a `seed.updated` audit event.

Supported seed types are buried treasure, village, desert temple, jungle pyramid, ruined portal, and shipwreck. Jungle pyramid uploads can be controlled by the experimental tournament setting.

## Used Seeds and Public History

Hosts can mark active seeds used for their host leagues, and admins can do so globally. The confirmation warns that marking used publishes the seed immediately and that only admins can reverse the action.

The unauthenticated history endpoint returns used seeds for the current week. For completed weeks, it returns the expired league/week seed history in seed order.

## Weekly Rollover

The singleton settings row stores `currentWeekNumber` and `seedTestingPaused`. Advancing the week:

1. pauses seed testing;
2. increments the current week;
3. expires active seeds;
4. resets active and used league counters; and
5. clears weekly uploader and host league assignments.

Administrators resume testing after access for the new week is ready.

## Admin Oversight

Administrators manage weekly operations, users, leagues, seed history, and audit logs. The seed archive browses one league/week combination at a time and is read-only until modifications are enabled for the current browser tab.

Once enabled, admins can:

- edit the four seed values, type, and used state;
- reorder adjacent seeds;
- add an expired used seed to a past week; and
- hard-delete a seed and its comments.

All archive mutations are server-authorized and logged. Enabling the client-side safety toggle is not itself logged.

## Data Model

### `users`

- Discord identity and profile fields
- `status`: `pending`, `active`, `deleted`, or `banned`
- `roles`: any combination of `admin`, `host`, and `uploader`
- `uploaderLeagues`: leagues available through uploader access
- `hostLeagueId`: leagues available through host access

### `leagues`

- `leagueNumber`
- `leagueName`
- `seedCount`: active non-expired seeds
- `usedSeedCount`: active non-expired seeds marked used

### `settings`

- singleton `key`
- `currentWeekNumber`
- `seedTestingPaused`
- optional experimental seed-type flags

### `seeds`

- optional sequential `seedNumber`
- `leagueId` and `assignedWeekNumber`
- `overworld`, `nether`, `end`, and `rng`
- seed `type` and optional denormalized buried-treasure flag
- `addedBy`
- `isUsed`, optional `usedAt`, and optional `usedBy`
- `isExpired`
- optional administrative league-change attribution
- denormalized `commentCount`

Ratings and vote attribution are not stored on seed records.

### `comments`

- `seedId`
- `author`
- `body`
- `createdAt`

### `logs`

Audit events retain actor and target snapshots so deletion does not erase accountability. Historical `seed.marked_bad` events remain readable as legacy records, but the application no longer creates them.

## V1 Boundaries

- One active tournament context rather than multiple seasons.
- Discord-only authentication.
- One-at-a-time uploads rather than bulk JSONL/CSV intake.
- Hard-coded league seed-type distribution targets.
