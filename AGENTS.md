# Repository instructions

- Use Bun for package management and commands where applicable.
- Do not commit without explicit user approval.
- Do not run commands or make changes against production environments.
- Answer questions without treating them as permission to make changes.
- Keep brainstorming concise and collaborative.

## Code quality

- Avoid abstractions and React components used only once.
- Prefer one file per React component unless closely related helpers are clearer
  together.
- Put reusable helpers in the relevant application's `lib` directory.
- Reuse existing UI before adding another implementation of the same pattern.
- Keep implementation details private behind deliberate module interfaces.

## Architecture and imports

- `apps/web` is the public Astro and React application.
- `backend` is the shared Convex workspace for the public website and future
  admin and bot applications.
- Applications import Convex function references and data types through explicit
  `@mcrl/backend` subpath exports. They do not import backend files by filesystem
  path.
- League reads published Seed history through Seed Manager's HTTP interface.
  Its local response schema lives in `apps/web/src/lib/seedHistoryResponse.ts`.
- Give future packages explicit subpath exports. Avoid package-wide barrel files.
- Add shared packages when at least two workspaces use a stable abstraction.
- Use `@/*` for imports rooted at an application's `src` directory.
- Declare internal workspace dependencies with `workspace:*`. Synchronize shared
  third-party dependency versions through the root Bun catalog.
- Keep unit tests beside the files they test. Use separate test directories for
  integration tests, shared fixtures, or cross-module scenarios.
- Root `scripts/` contains repository maintenance tools. It remains covered by
  `scripts/tsconfig.json` and the root lint command.
- Report any repository rule that makes a requested change harder or impossible.

## Convex

- In mutations and internal mutations, throw `ConvexError` for failures. Returning
  a failure value commits earlier writes because Convex treats the transaction as
  successful.

## Verification

- Run typecheck frequently through the smallest affected script in `package.json`.
- Prefer existing tests and typecheck for small changes.
- Run broader existing tests and builds for migration or core changes.
- Run lint at the end and report remaining errors.

## League

- Read `SPEC.md` before product-facing League changes.
- League is the public tournament history and statistics system.
- The public website reads Seed history through `PUBLIC_SEED_API_URL`.
