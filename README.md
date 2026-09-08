# MCRL

MCRL contains the League public website and its shared Convex backend for
Minecraft Speedrunning Ranked Leagues. The admin website and tournament bot can
join the workspace when they are implemented.

## Structure

```text
apps/web/       Astro and React public website
backend/convex/ League schema, functions, and HTTP interface
scripts/        Repository maintenance tools
```

Seed Manager is maintained separately. The public website reads published seed
history through `PUBLIC_SEED_API_URL`. See
[the interface notes](docs/seed-history.md).

## Development

Use Bun 1.3.14. Configure a League Convex development deployment in `backend`
and browser environment variables in `apps/web` before starting both processes.

```sh
bun install --frozen-lockfile
cp backend/.env.example backend/.env.local
cp apps/web/.env.example apps/web/.env.local
bun run dev
```

Run `bun run dev:web` or `bun run dev:backend` to start one process.

`READER_API_KEY` and `WRITER_API_KEY` are Convex deployment environment
variables used by the backend HTTP interface.

## Verification

```sh
bun run typecheck
bun run test
bun run build
bun run lint
```

Use the `:web`, `:backend`, and `:scripts` commands in `package.json` to check a
smaller area. `bun run format:check` checks formatting.

The frontend hosting build runs from the repository root with
`bun run build:cloudflare:league` and produces `apps/web/dist`. The backend
deployment workflow lives in `.github/workflows/deploy-league-convex.yml`.

Read [SPEC.md](SPEC.md) before product-facing League changes. [AGENTS.md](AGENTS.md)
contains repository instructions, and [TODO.md](TODO.md) contains the backlog.
