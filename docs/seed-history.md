# Seed Manager integration

League reads published seeds over HTTP using `PUBLIC_SEED_API_URL`:

```text
GET /api/seeds/history?weekNumber=<week>&leagueNumber=<league>
```

The successful response is an array with a positive integer `order`, string
`overworld`, `nether`, `end`, and `rng` values, and a nullable seed `type`.
Seed values remain strings to preserve precision. Current-week history includes
used seeds; completed-week history includes expired seeds in seed order.

Seed Manager owns this interface and its publication rules. It lives in
`MC-Ranked-Leagues/Seed-Manager`. The consumer schema in
`apps/web/src/lib/seedHistoryResponse.ts` is a local copy of the former
`@mcrl/contracts/seed-history` schema at MCRL commit `29cd375`.

Coordinate changes with Seed Manager's producer schema at
`convex/lib/seedHistoryResponse.ts`. Existing field types, supported enum values,
and publication semantics must stay compatible with deployed callers. Breaking
changes require a versioned route and a coordinated consumer migration.

Repository separation does not change the existing endpoint URL. Keep the
configured Seed deployment address during cutover. League handles a failed
history request separately from its standings and match displays.
