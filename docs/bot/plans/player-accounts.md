# Player accounts proposal

A Ranked Leagues player pairs one Discord account with one active Minecraft
account, identified by UUID. Playing a separate challenge account requires a
separate Discord account. This keeps challenge performance separate and gives
each Discord player one league assignment.

## Registration and performance

Persist the Discord ID and active Minecraft UUID together. Minecraft username
changes do not change identity. Retain the latest three participating-week
placements for that pairing to calculate its rolling average.

`/reg` looks up the Discord-linked Ranked account. If its UUID differs from the
saved account, direct the player to `/migrate_account` instead of silently switching
accounts. `/admin_reg` must not pair with an arbitrary Minecraft account under this proposal.

Competition registrations retain the Minecraft UUID used at registration.
Historical results, including website statistics, remain attached to that UUID.

## Account migration

A player who loses access to their Minecraft account can keep their Discord
account and league through `/migrate_account`:

1. The player links their existing Discord account to their new Minecraft account
   on MCSR Ranked.
2. The command resolves the newly linked account through the Ranked Discord
   lookup and shows the old and new accounts for confirmation.
3. A host must approve the migration. Reject a destination Minecraft account
   already associated with another player. Block migration while the player is
   registered in an active competition until a host resolves that registration.
4. On approval, replace the active Minecraft link, preserve the player's current
   league, and clear the retained placements used for the rolling average. The
   new pairing starts without performance history, not with zero placements.

Migration preserves league membership; it does not automatically register the
new account in an active competition. Previous registrations and published
results stay attached to the old Minecraft UUID and are not transferred or
rewritten.

Host approval prevents account switching from becoming a self-service way to
erase poor results while retaining league placement. This recovery path avoids
requiring a new Discord account after losing a Minecraft account, while keeping
normal and challenge accounts separate.
