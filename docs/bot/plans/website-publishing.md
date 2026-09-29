# Website publishing

The agreed rules live in [website publication decisions](../decisions.md#website-publication).
The bot saves locally, starts direct website writes, and finishes Discord work
before reporting their outcome. The write mutations are grouped under
`backend/convex/writes/`; the bot imports their generated references through
`@mcrl/backend/api`.

## Remaining work

- Connect the existing internal empty-match, point-adjustment, and league-update
  mutations when their corresponding commands are implemented. Make a mutation
  public with writer-key checks only when a bot command needs it.
- Coordinate deployment of the renamed Convex functions and bot callers, apply
  the SQLite migrations, and refresh the Discord command list to remove
  `/website`. These are release actions, not part of local verification.

Keep the existing scoring and match replacement logic. The
[`replay-week.ts` script](../../../apps/bot/scripts/replay-week.ts) can publish a
completed week from a SQLite backup and restore its active player state. It
defaults to development; `--prod` selects `PROD_CONVEX_URL` and
`PROD_CONVEX_WRITER_KEY` from the bot's `.env`. Without `--apply`, it only validates
the backup. The target week must be absent, and failures stop the replay without
retrying or undoing earlier writes. No call archive or automatic retry is planned.
