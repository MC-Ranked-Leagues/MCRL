# League

League is the public tournament-history domain for Minecraft Speedrunning Ranked
Leagues. It displays weekly standings, matches, player performance, and
historical competition data written by tournament operations.

## Structure

```text
web/       Astro and React public website
convex/    Domain schema, functions, and HTTP interface
```

## Development

Run the web application and Convex together:

```sh
bun run --filter @mcrl/league dev
```

They can also be started separately:

```sh
bun run --filter @mcrl/league dev:web
bun run --filter @mcrl/league dev:convex
```

## Commands

Run these from `domains/league` or through the `@mcrl/league` workspace filter:

| Command              | Purpose                                |
| -------------------- | -------------------------------------- |
| `bun run typecheck`  | Check web and Convex diagnostics       |
| `bun run test`       | Run the test suite once                |
| `bun run test:watch` | Run tests in watch mode                |
| `bun run build`      | Build the public website               |
| `bun run lint`       | Lint the domain                        |
| `bun run format`     | Format the domain with the root policy |
