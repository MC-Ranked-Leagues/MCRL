# MCRL website spec

## Purpose

The website is the public companion to the Minecraft Speedrunning Ranked Leagues
tournament. Players, spectators, and organizers use it to inspect weekly
standings, match results, player performance, and historical tournament data.

Hosts control tournaments through the Discord bot. The website reflects their
decisions; it is not a tournament control panel or a separate rules engine.

## Tournament model

MCRL is a recurring weekly tournament split into skill-based leagues.

- The number of leagues may grow or shrink over time.
- A league usually contains around 20 to 50 players, but the system should tolerate smaller or larger groups.
- Each week, all players in a league join a single room and compete for the fastest speedrun time.
- Each league plays several matches during the week.
- Weekly performance determines promotions, relegations, or no movement.

The public rules describe [league organization](apps/web/src/content/docs/rules/organization.md),
[points](apps/web/src/content/docs/rules/format.md), and
[movement](apps/web/src/content/docs/rules/relegations.md). Their formulas and
constants may evolve separately from this spec.

## Competition expectations

- A week is made up of separate competitions, one per league.
- A competition has a roster of registered players, a set of matches, standings, and an end state.
- A player's weekly standing is the sum of match points plus any manual host adjustments.
- Once a competition is finalized, its results should be treated as historical data, not live editable state.

## Host workflow

The intended operational flow is:

1. Hosts use `/nm` in a league Discord channel to create a new competition for that league and week.
2. Hosts open registration before the event, at the time announced to players.
3. When the event starts, hosts close registration so players cannot join or leave in a way that would skew standings or points. The first successful import also closes registration.
4. Hosts use `/import` to save a new match or replace an existing match with its full results.
5. Late `/admin_reg` and `/admin_unreg` operations recalculate earlier imported matches in the bot and publish corrected full snapshots.
6. When all matches are done and results are verified, hosts use `/em` to end the competition and publish percentage and movement previews.
7. Hosts can use `/unend` to reopen an ended competition and remove its previews before finalization.
8. Hosts use `/relegate` to finalize weekly movements.
9. Hosts use `/advance_week` to clear the bot's local competition state for the past week.

`/advance_week` does not erase the website's published history. Website updates are attempted after local saves without blocking Discord work. Failures may leave website data incomplete; the owner can copy SQLite before advancing for manual repair. Calls are not stored or automatically retried.

Website failures must not prevent week advancement. The
[command reference](docs/bot/commands.md) covers arguments, restrictions, and
recovery instructions.

## Match replacement

Match imports are full snapshots. A corrected import replaces the previous
results for that match, even if only one player's time, placement, or points
changed. Placements, points, and winners are coupled, so an isolated player edit
can affect the whole match.

The bot provides placements and points. Convex currently orders weekly standings
by points, average time, and player name.

## Finished results and league membership

Ending a competition and applying movement are separate host decisions. Ending
confirms that play is over and publishes a preview; relegation finalizes movement.

Preserve both the results of the finished competition and the player's league
membership going into the next week. Later membership or percentage-history
changes must not change the recorded outcome of a finalized competition.

## Responsibilities

The bot controls registration, gathers source results, recalculates corrections,
and calculates points and movement percentages. Hosts explicitly decide when to
end competitions and apply movement.

The website backend validates submitted writes, stores published history, and
protects finalized competitions. It must not reconstruct host decisions from raw
results alone; those decisions arrive as explicit writes from the bot.
