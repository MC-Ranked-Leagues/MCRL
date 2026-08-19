# Repository instructions

- Use Bun for package management and commands where applicable.
- Do not commit without explicit user approval.
- Do not run commands or make changes against production environments.
- When asked a question, answer it without treating the question as permission
  to make changes. For example, "Did you commit?" does not mean to commit.
- When brainstorming, keep ideas short and meaningful, ask questions, and
  encourage collaboration.

## Code quality

- Do not create abstractions or components that are only used once.
- Prefer one file per React component unless closely related helper components
  are clearer together.
- Put reusable helper functions in the relevant domain's `lib` directory.
- Before adding UI, look for existing components and similar hard-coded UI that
  should be reused or extracted.
- Keep domain internals private. Cross-domain communication should use a clear
  interface such as an HTTP endpoint or a deliberately shared contract.

## Architecture and imports

- `domains/league` and `domains/seed` are private workspace applications. Do
  not expose or import their Convex or web implementations as package APIs.
- A domain must never import another domain's Convex files, generated types, or
  other implementation files. Cross-domain communication uses public APIs and
  schemas from `@mcrl/contracts`.
- `@mcrl/contracts` contains runtime API schemas and types inferred from those
  schemas. Never expose Convex-specific `Doc`, `Id`, generated data models, or
  other backend implementation types through a contract.
- Give packages explicit subpath exports. Do not add a package-wide barrel
  `index.ts`.
- Add code to `@mcrl/shared` only when at least two workspaces use a stable,
  domain-neutral abstraction. Do not create generic dumping-ground modules.
- Use `@/*` for imports rooted at the current domain's `web/src` directory and
  `@/convex/*` only when that web app imports its own domain's Convex files.
  Use relative imports for nearby implementation code.
- Use workspace package imports across package boundaries. Do not use aliases
  or filesystem-relative paths to bypass package exports.
- Declare internal workspace dependencies with `workspace:*` and synchronized
  third-party dependency versions through the root Bun catalog.
- Keep unit tests beside the files they test. Use separate test directories only
  for integration tests, shared fixtures, or genuinely cross-module scenarios.
- Root `scripts/` contains repository maintenance tools. It is not a package and
  must remain covered by `scripts/tsconfig.json` and the root lint command.
- If any of these rules make a change or a fix impossible/harder to make, report
  to the user

## Convex

- In Convex mutations and internal mutations, signal failures by throwing a
  `ConvexError`. Returning a failure value commits earlier writes because Convex
  treats the transaction as successful. Queries may return result objects when
  appropriate.

## Verification

- Run typecheck frequently while working.
- Prefer typecheck and existing tests over adding browser or custom tests for
  small changes.
- Consider broader tests for multi-feature work, complicated behavior, or core
  rewrites.
- Run lint at the end and report any remaining errors.
- Checks must run for the smallest effected area, meaning if the seed domain
  changes, typecheck and lint only that domain using the provided scripts.

## League domain

- Read `domains/league/SPEC.md` before product-facing League changes.
- League is the public tournament history and statistics domain.
- Its web application reads published seed history through Seed's HTTP
  interface configured by `PUBLIC_SEED_API_URL`.

## Seed domain

- Read `domains/seed/CONTEXT.md` before changing Seed domain behavior or
  terminology.
- For new Seed logging actions, ask whether the action should be logged.
- Before changing Seed Convex code, read
  `domains/seed/convex/_generated/ai/guidelines.md`.
