# Contracts

This package contains runtime schemas for cross-domain APIs and the TypeScript
types inferred from those schemas.

Contracts describe public request and response shapes. They do not expose a
domain's implementation, database model, or Convex-specific types.

Each contract is exported through an explicit package subpath instead of a
single package-wide index.
