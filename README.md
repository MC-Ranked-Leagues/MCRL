# MCRL

MCRL contains the League public website and its Convex backend for Minecraft
Speedrunning Ranked Leagues. Tournament bot and admin applications can join this
workspace when they are implemented.

## Structure

```text
domains/league/
  web/          Astro and React public website
  convex/       League schema, functions, and HTTP interface
scripts/        Repository maintenance tools
```

Seed Manager is maintained separately. League reads its published seed history
through `PUBLIC_SEED_API_URL`. See [the interface notes](docs/seed-history.md).

## Development

Use Bun 1.3.14 and configure a League Convex **development** deployment before
starting the backend.

```sh
bun install --frozen-lockfile
bun run dev:league
```

`bun run dev:league:web` and `bun run dev:league:convex` start each process
separately. See [the League README](domains/league/README.md) and `.env.example`
inside that directory for setup details.

## Verification

```sh
bun run typecheck:league
bun run test:league
bun run build:league
bun run lint:league
```

Root configuration or script changes also require `bun run typecheck:scripts`
and `bun run lint`. Use `bun run format:check` to check formatting.

The frontend hosting build runs from the repository root with
`bun run build:cloudflare:league`. League's backend deployment workflow remains
in `.github/workflows/deploy-league-convex.yml`.

[AGENTS.md](AGENTS.md) contains working instructions, and [TODO.md](TODO.md)
contains the backlog.
