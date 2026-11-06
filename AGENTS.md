# Repository instructions

Minecraft Ranked Leagues in a public event with more than 1000 users.

Use Bun for package management and commands where applicable. Do not commit
without explicit user approval, and never run commands or make changes against
production environments.

Questions should be followed by answers. Don't take a question as permission to
make the change.

Keep brainstorming concise and collaborative. Report any repository rule that
makes a requested change harder or impossible.

## Code quality

This repository is primarily maintained by humans. Keep code simple and easy to
follow; choose direct implementations over extra layers or speculative flexibility.
Avoid abstractions and React components used only once. Keep one React component per file unless closely related helpers are
clearer beside it. Put reusable helpers in its own file, and group them by their functionality. Avoid one file per helper.
Reuse existing UI patterns, and keep implementation details behind
deliberate module interfaces.

Use concise comments to explain non-obvious intent or constraints, including in tests.

## Documentation

Do not update documentation merely because code changed.

Update docs only when:

- Existing documentation becomes incorrect.
- A new or changed rule, constraint, ownership boundary, or intentionally
  surprising behavior needs explanation.
- Human setup, operation, or recovery instructions change.

Before adding text, identify the specific misunderstanding or missing
instruction it resolves. If there is none, leave the docs alone.

Make the smallest edit in the document that owns the topic. Prefer correcting
or replacing existing text over adding sections. Do not repeat the change
across multiple documents. Keep architecture focused on rationale and constraints.
Record agreed decisions for the bot in the relevant `decisions.md`; keep ideas
and open questions in plans. Plans do not need individual status labels.

Do not document code structure, execution sequences, output fields, or
implementation details unless humans need them to operate the system.
When changing docs, briefly explain why in the completion message.

## Architecture and imports

`apps/web` is the public Astro and React application. `backend` is the shared
Convex workspace for the public website and future admin and bot applications.
Applications must import Convex function references and data types through
explicit `@mcrl/backend` subpath exports instead of backend filesystem paths.

League reads published Seed history through Seed Manager's HTTP interface. Its
local response schema lives in `apps/web/src/lib/seedHistoryResponse.ts`.

Give future packages explicit subpath exports and avoid package-wide barrel
files. Add a shared package only when at least two workspaces use a stable
abstraction. Use `@/*` for imports rooted at an application's `src` directory.
Declare internal workspace dependencies with `workspace:*`, and synchronize
shared third-party dependency versions through the root Bun catalog.

Keep unit tests beside the files they test. Use separate test directories for
integration tests, shared fixtures, or cross-module scenarios. Root `scripts/`
contains repository maintenance tools.

## Convex

In mutations and internal mutations, throw `ConvexError` for failures. Returning
a failure value commits earlier writes because Convex treats the transaction as
successful.

## Verification

Run typecheck frequently through the smallest affected script in `package.json`.
Prefer existing tests and typecheck for small changes. Run broader existing tests
and builds for migrations or core changes. Run lint at the end if code changes
were made and report any remaining errors.

## League

Read `SPEC.md` before product-facing League changes. League is the public
tournament history and statistics system. The public website reads published
Seed history through `PUBLIC_SEED_API_URL`.

## Web design

The site is moving page by page to the obsidian design used by the home and
week pages. Pages on it wrap their content in `.obsidian-page`, which sets the
base text and the focus ring. Credits still uses the older shadcn tokens until
it is redesigned. The championship page is kept only as an
archive and stays out of the navbar.

Keep new UI on the shared values so pages don't drift apart:

- Colors come from the `@theme` tokens in `global.css`. Movement uses
  `promoted`, `demoted` and their `-tint` variants. Raw hex is only for data
  colors, such as the run phase colors.
- Panel and control borders are `border-3`. Content width is `max-w-page`.
- Selected items use lava: a fill for segmented controls like the league
  picker, and an underline or edge bar for list items. Hover is
  `bg-obsidian-raised`. Gold marks first place and winners.
- Times, points, percentages and player names use `font-minecraft`. Headings
  already get it from the base styles.
- Page titles are `text-4xl md:text-6xl`, section headings
  `text-3xl md:text-4xl`, and panel headings `text-2xl`. Data numbers are
  `text-lg` bold, with larger sizes only for showcases like the podium.
- Use `PlayerHead` at its default size in lists, `Skeleton` for loading
  placeholders, and `Drawer` for mobile sheets. Load faces and match players
  by UUID, since names can change.
- Format run times and percentages with `lib/format.ts`, and movement with
  `lib/movement.ts`. The UI only says promoted, demoted or stayed, because
  projected moves aren't final.
- External links live in `src/links.ts`, and the site name is `SITE_NAME` in
  `src/consts.ts`.

In code and copy, a match is one league match (`matchNumber`), a Ranked match
is MCSR Ranked API data (`rankedMatchId`), and a run is one player's attempt
in a match. A seed's `order` comes from Seed Manager and keeps its own name.

## Bot

Before changing `apps/bot`, read [bot architecture](docs/bot/architecture.md).
For tournament behavior changes or future features, read the relevant sections
of [decisions](docs/bot/decisions.md) and any related [plan](docs/bot/plans/README.md).
The [bot README](apps/bot/README.md) covers setup and maintenance; the
[command reference](docs/bot/commands.md) is for human readers.

Never leave a bot instance or other long-running process active after agent
work. Agents may start one for bounded verification, but must stop it and clean
up any stale process lock before yielding. Only the I may choose what to leave
running.
