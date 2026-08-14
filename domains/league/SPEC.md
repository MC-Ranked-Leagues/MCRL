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
4. Hosts use `/ns` to create a new seed for the league. In the website domain this is stored as a match.
5. Hosts use `/import` to send the match data into the website backend, and update the bots internal state.
6. If results later change because of corrections, cheating rulings, host mistakes, or `/edit`, the bot should call the same api as `/import` again with the corrected full match data.
7. If hosts need to add or remove points outside the imported match results, they use `/adjust`.
8. When all matches are done and results are verified, hosts use `/em` to end the competition for that league and week.
9. After the competition is ended, hosts use `/relegate` to apply the final weekly league movements.
10. If a later correction is needed outside the normal `/relegate` flow, hosts can use `/promote` and `/demote` to manually change a player's league placement. This isn't captured as the weekly relegations/promotions in the leaderboards.
11. After the bot is finished with that week's operational flow, it uses `/dm` to clear its own internal state and prepare for the next week.

`/dm` is a bot-only cleanup concept. It should not require a matching concept in the website backend because that internal bot state is not the website's responsibility.

## Match Import Philosophy

The website should think of match imports as full snapshots, not partial patches.

- `/import` is the authoritative write for match results.
- If one player's placement, time, or points change, the corrected match should be re-imported as the new truth for that match.
- The backend should store the latest accepted version of that match.
- Standings are provided by the bot to make the backend as loose as possible without breaking stuff. For example, if the bot somehow thinks the player with most points should be last, than so be it.

This is important because placements, points, and winners are coupled. A single-player edit can affect the whole match.

## League Movement Philosophy

End-of-week movement is a separate step from importing matches.

- Match imports establish the weekly results.
- Ending the competition confirms that the week is over.
- `/relegate` applies the intended promotion and demotion outcome for that finished competition.
- `/promote` and `/demote` exist as manual correction tools outside the normal batch movement step.

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
