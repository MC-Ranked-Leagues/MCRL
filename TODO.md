# TODO

## Repository

- [ ] Resolve the existing League private-script typecheck errors.
- [ ] Resolve the existing League lint errors and generated-file warnings.
- [ ] Add simple workspace CI for frozen install, typecheck, tests, builds, and
      lint.
- [ ] Configure deployment roots and build commands for both domains.
- [ ] Configure a Git remote, push the monorepo, and test both deployed
      applications before archiving the original repositories.

- [ ] Set up seed site url for seed list in leagues

## League

- [x] Verify that `listPlayerMatches` is not broken by the API changes.
- [x] Only allow unregistering players who have not played a match.
- [ ] Allow retrieving match data by player name through the read interface.
- [ ] Enforce that only one competition per league can be active at a time. The
      bot currently enforces this, but the backend should protect the invariant.
- [ ] Test the interface against historical data and edge cases.
- [ ] Track whether `/relegate` was used for a competition and block subsequent
      `/relegate` operations for that competition.

## Seed

- [ ] Add an admin overview showing seed counts and other useful information for
      each league.
- [x] Add logging.
- [x] Add a public page for browsing historical seeds.
  - [x] Browse seeds by week and league.
  - [x] Show current-week seeds after they are marked as used.
