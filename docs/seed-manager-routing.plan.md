# Seed Manager Routing Plan

## Router

- Use React Router in declarative mode.
- Keep the application as a Vite SPA.
- `/` is the public Discord login page.
- `/pending` is the pending-access page.
- `/app/*` is the authenticated application shell.

The application shell redirects unauthenticated users to `/` and pending users to `/pending`. Convex authorization remains the source of truth for every query and mutation.

## Application Routes

- `/app` — uploader-focused seed upload surface with the current user's five newest accessible uploads from the current week.
- `/app/account` — current identity, roles, and league access.
- `/app/settings` — redirects to `/app/account`.
- `/app/league/:leagueId` — active seeds visible in one league.
- `/app/league/:leagueId/seed/:seedId` — active seed details, comments, and permitted actions.

Canonical redirects:

- `/app/league` redirects to `/app`.
- `/app/league/:leagueId/seed` redirects to `/app/league/:leagueId`.

Uploader and host access share the same league routes. Controls are capability-driven:

- Uploaders can upload to and view their uploader leagues.
- Hosts can view their host leagues and mark active seeds used.
- Admins can view every league and change an active unused seed's league.
- Seed details always reserve space for the delete icon. It is enabled only for admins, the original uploader, or a host of the seed's league while testing is running and the seed is active and unused.
- On `/app`, original uploaders can edit seed type and values in place for active, unused current-week seeds while testing is open and they retain upload access to the league. The edit preserves the seed's identity, assignment, order, upload time, status, and comments.
- Normal deletion permanently deletes the seed and comments, compacts league order, updates counters, and records an audit event.
- Used and expired seeds are corrected or deleted only through the unlocked admin seed archive.

League pages show assigned, non-expired seeds. Used seeds remain on the active-week board, while expired seeds are available through admin history.

## Admin Routes

- `/app/admin` — current week, testing state, pause/resume, experimental seed types, and week advancement.
- `/app/admin/users` — redirects to `/app/admin/users/active`.
- `/app/admin/users/active` and `:userId` — active user roles and league access.
- `/app/admin/users/pending` and `:userId` — pending-user activation.
- `/app/admin/seeds` — league/week archive with session-unlocked modifications.
- `/app/admin/seeds/:seedId` — admin seed detail placeholder.
- `/app/admin/leagues` — league management and active counters.
- `/app/admin/logs` — searchable administrative audit history.

The admin seed archive can edit seed values, type, and used state; reorder seeds; add used seeds to past weeks; and hard-delete current or historical seeds with their comments. Its session unlock is a client safety mechanism; every mutation remains server-authorized and material changes are logged.

## Weekly Operations

Tournament state lives in the singleton settings row:

- `currentWeekNumber` identifies the active week.
- `seedTestingPaused` blocks normal uploads and deletions.
- Advancing the week pauses testing, increments the week, expires active seeds, resets league counters, and clears weekly uploader/host league assignments.

Expired seeds remain stored and read-only in normal routes. Administrators can explicitly unlock the archive to correct historical data.
