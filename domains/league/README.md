# League

League is the public tournament-history domain for Minecraft Speedrunning Ranked
Leagues. It displays weekly standings, matches, player performance, and
historical competition data written by tournament operations.

## Structure

```text
web/       Astro and React public website
convex/    Domain schema, functions, and HTTP interface
scripts/   Maintenance and historical-data scripts
tests/     Domain tests
```

## Development

Run the web application:

```sh
bun run --filter @mcrl/league dev:web
```

Run Convex in another terminal:

```sh
bun run --filter @mcrl/league dev:backend
```

## Commands

Run these from `domains/league` or through the `@mcrl/league` workspace filter:

| Command              | Purpose                                |
| -------------------- | -------------------------------------- |
| `bun run typecheck`  | Check Astro and TypeScript diagnostics |
| `bun run test`       | Run the test suite once                |
| `bun run test:watch` | Run tests in watch mode                |
| `bun run build`      | Build the public website               |
| `bun run lint`       | Lint the domain                        |
| `bun run format`     | Format the domain with the root policy |
