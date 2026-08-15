# Scripts

This directory contains repository maintenance and historical-data tools. It is
not a workspace package.

Run scripts from the repository root so paths such as `scripts/data` resolve
consistently. Private input and generated data belong in the ignored
`scripts/data` directory.

The scripts are typechecked with `scripts/tsconfig.json` as part of the root
`bun run typecheck` command.
