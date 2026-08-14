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

## Verification

- Run typecheck frequently while working.
- Prefer typecheck and existing tests over adding browser or custom tests for
  small changes.
- Consider broader tests for multi-feature work, complicated behavior, or core
  rewrites.
- Run lint at the end and report any remaining errors.

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
- In Convex mutations and internal mutations, signal failures by throwing a
  `ConvexError`. Returning an error value counts as a successful transaction and
  does not roll back earlier writes.
