# MSRL Website Spec

## Purpose

The MSRL website is the public companion to the Minecraft Speedrunning Ranked Leagues tournament.

Its job is to:

- show weekly league standings
- show match history and player performance
- preserve historical tournament data
- reflect the state produced by the tournament hosts and their Discord bot

Its job is not to:

- act as the primary tournament control panel
- decide tournament rules on its own
- calculate tournament policy outside the workflow defined by the hosts and bot

The website is a read-focused product for players, spectators, and organizers who want to inspect the state of a week after the bot has written it.

## Tournament Model

MSRL is a recurring weekly tournament split into multiple skill-based leagues.

- The tournament currently operates with tiered leagues, and that structure may grow or shrink over time.
- A league usually contains around 20 to 50 players, but the system should tolerate smaller or larger groups.
- Each week, all players in a league join a single room and compete for the fastest speedrun time.
- Each league plays several matches during the week.
- Weekly total points determine promotions, relegations, or no movement.

The exact live rule set, match counts, time limits, and movement rules are documented publicly and may evolve separately from this file:

- `https://mscl.pages.dev/rules/organization/`
- `https://mscl.pages.dev/rules/points/`
- `https://mscl.pages.dev/rules/relegations/`

This spec should describe how the product is meant to be used, not duplicate rule math that is expected to change.

## Core Product Expectations

The website should model the tournament in a way that feels natural to the hosts' workflow.

- A week is made up of separate competitions, one per league.
- A competition has a roster of registered players, a set of matches, standings, and an end state.
- A player's weekly standing is the sum of match points plus any manual host adjustments.
- Once a competition is finalized, its results should be treated as historical data, not live editable state.

The public site should let people:

- browse leagues
- browse weeks
- inspect standings for a specific week and league
- inspect the matches that were played in that competition
- inspect player performance and history

Hosts should primarily interact with the tournament through the Discord bot, not through a separate admin UI on the website.

## Bot-Centered Workflow

The intended operational flow is:

1. Hosts use `/nm` in a league Discord channel to create a new competition for that league and week.
2. Registration is opened in the bot a few hours before the event starts.
3. When the event starts, registration is closed in the bot so players cannot join or leave in a way that would skew standings or points.
4. Hosts use `/import` to save a new match or replace an existing match with its full results.
5. Late `/admin_reg` and `/admin_unreg` operations recalculate earlier imported matches in the bot and publish corrected full snapshots.
6. When all matches are done and results are verified, hosts use `/em` to end the competition and publish percentage and movement previews.
7. Hosts can use `/unend` to reopen an ended competition and remove its previews before finalization.
8. Hosts use `/relegate` to apply the saved weekly movements and mark them final.
9. Hosts use `/advance_week` to clear the bot's local competition state for the past week.

`/advance_week` does not erase the website's published history. Website updates are attempted after local saves without blocking Discord work. Failures may leave website data incomplete; the owner can copy SQLite before advancing for manual repair. Calls are not stored or automatically retried.

## Match Import Philosophy

The website should think of match imports as full snapshots, not partial patches.

- `/import` is the authoritative write for match results.
- If one player's placement, time, or points change, the corrected match should be re-imported as the new truth for that match.
- The backend should store the latest accepted version of that match.
- The bot provides each result's placement and points. For now, Convex orders weekly standings by those points, average time, and player name.

This is important because placements, points, and winners are coupled. A single-player edit can affect the whole match.

## League Movement Philosophy

End-of-week movement is a separate step from importing matches.

- Match imports establish the weekly results.
- Ending the competition confirms that the week is over.
- `/relegate` applies the intended promotion and demotion outcome for that finished competition.
- Manual corrections outside weekly finalization may be added later.

The website should preserve both ideas:

- what happened in the finished competition
- where the player belongs going into the next week

## System Responsibilities

The website backend is responsible for:

- accepting tournament data from the bot
- validating that incoming writes are structurally valid to some extend
- storing enough history to render weeks, matches, standings, and player views
- preventing accidental corruption of already finalized competitions
- exposing stable read models for the public site

The bot is responsible for:

- controlling registration windows
- coordinating the host workflow
- gathering source match data
- recalculating corrected match data when edits happen
- deciding when a competition should start or end
- deciding when league movements should be applied
- calculating points and movement percentages before publishing them

The website should not assume it can reconstruct every host intent from raw results alone. Some tournament actions are explicit host decisions and should arrive from the bot as explicit writes.

## Product Boundaries

This project should continue to behave like a tournament data layer and public viewer, not a second rules engine.

- The frontend is for viewing, not hosting.
- The backend stores and protects the tournament state that the bot submits.
- Tournament rules may evolve without requiring this spec to be rewritten every time a formula or percentage changes.

When this file needs updates, prefer documenting:

- workflow changes
- ownership boundaries
- lifecycle guarantees
- operator expectations

Avoid filling it with:

- unstable route-by-route payload minutiae
- implementation details that are obvious from code
- rule constants that are better maintained in public rules pages
