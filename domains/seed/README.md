# Seed

Seed coordinates tournament seeds from league-scoped upload through weekly use
and historical publication. It includes role-based uploader and host workflows,
comments, audit logging, and a public seed-history view.

Read [`CONTEXT.md`](CONTEXT.md) before changing domain behavior or terminology.

## Structure

```text
web/       React and Vite application
convex/    Domain schema, authentication, functions, and HTTP interface
```

## Setup

From the repository root:

```sh
bun install
cp domains/seed/.env.example domains/seed/.env.local
```

Select the existing Seed Convex development deployment before starting local
development.

## Development

Run the web application and Convex together:

```sh
bun run --filter @mcrl/seed dev
```

They can also be started separately with `dev:web` and `dev:convex`.

## Environment

Local values belong in `domains/seed/.env.local`:

| Variable            | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `CONVEX_DEPLOYMENT` | Selects the Seed Convex development deployment     |
| `VITE_CONVEX_URL`   | Connects the website to the Seed Convex deployment |

The Seed Convex deployment requires these backend variables:

- `SITE_URL`
- `AUTH_DISCORD_ID`
- `AUTH_DISCORD_SECRET`
- `JWT_PRIVATE_KEY`
- `JWKS`
- `READ_API_KEY_SEEDS`
- `WRITE_API_KEY_SEEDS`

Configure backend variables in Convex, not in the frontend environment.
`CONVEX_SITE_URL` is provided automatically inside Convex functions.

## Published-history interface

Seed exposes published seed history at:

```text
GET /api/seeds/history?weekNumber=<week>&leagueNumber=<league>
```

This is the interface consumed by League. Callers should depend on the HTTP
interface rather than importing Seed's internal implementation.

## Commands

Run these from `domains/seed` or through the `@mcrl/seed` workspace filter:

| Command              | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `bun run typecheck`  | Check web, config, and Convex diagnostics |
| `bun run test`       | Run the test suite once                   |
| `bun run test:watch` | Run tests in watch mode                   |
| `bun run build`      | Build the web application                 |
| `bun run lint`       | Lint the domain                           |
| `bun run format`     | Format the domain with the root policy    |
