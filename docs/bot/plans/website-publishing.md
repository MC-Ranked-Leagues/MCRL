# Website publishing

The agreed rules live in [website publication decisions](../decisions.md#website-publication).
The bot saves locally, starts direct website writes, and finishes Discord work
before reporting their outcome. The write mutations are grouped under
`backend/convex/writes/`; the bot imports their generated references through
`@mcrl/backend/api`.

## Remaining work

- Use retained Convex percentage history on the player statistics page. Label
  its current average separately from the average recorded for a completed week.
- Connect the existing internal empty-match, point-adjustment, and league-update
  mutations when their corresponding commands are implemented. Make a mutation
  public with writer-key checks only when a bot command needs it.
- Coordinate deployment of the renamed Convex functions and bot callers, apply
  the SQLite migrations, and refresh the Discord command list to remove
  `/website`. These are release actions, not part of local verification.

Keep the existing scoring and match replacement logic. Manual repair can use a
copy of SQLite; no replay tool, call archive, or automatic retry is planned.
