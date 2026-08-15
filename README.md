# MCRL

MCRL is a monorepo for the Minecraft Speedrunning Ranked
Leagues evevt.

## Domains

| Domain | Responsibility                                                             | Documentation                                          |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| League | Public standings, match history, player statistics, and tournament history | [`domains/league/README.md`](domains/league/README.md) |
| Seed   | Seed upload, assignment, host workflows, and published seed history        | [`domains/seed/README.md`](domains/seed/README.md)     |

The League domain reads published seed history through Seed's HTTP interface.

## Structure

```text
domains/
  league/
    web/
    convex/
  seed/
    web/
    convex/
packages/
  contracts/
  shared/
scripts/        Repository maintenance tools (not a workspace package)
```

## Packages

| Package           | Responsibility                                           |
| ----------------- | -------------------------------------------------------- |
| `@mcrl/contracts` | Runtime API schemas and their inferred TypeScript types  |
| `@mcrl/shared`    | Domain-neutral code genuinely shared by multiple domains |

## Requirements

- Bun 1.3.14
- Access to the appropriate Convex projects for backend development

## Commands

Run these from the repository root:

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `bun run dev:league`   | Start the League web application and Convex process           |
| `bun run dev:seed`     | Start the Seed web application and Convex development process |
| `bun run typecheck`    | Typecheck every workspace and the root scripts                |
| `bun run test`         | Run every workspace test suite once                           |
| `bun run build`        | Build both web applications                                   |
| `bun run lint`         | Lint both workspaces                                          |
| `bun run format`       | Format the repository                                         |
| `bun run format:check` | Check repository formatting                                   |

Each domain can also start just its web or Convex process:

```sh
bun run dev:league:web
bun run dev:league:convex
bun run dev:seed:web
bun run dev:seed:convex
```

Domain-specific commands and environment requirements are documented in each
domain README.

## Repository guidance

- [`AGENTS.md`](AGENTS.md) contains repository and domain-specific working
  instructions.
- [`TODO.md`](TODO.md) is the consolidated backlog.
