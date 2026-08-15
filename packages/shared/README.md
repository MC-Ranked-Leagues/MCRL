# Shared

This package is reserved for domain-neutral code genuinely shared by multiple
workspaces.

Add something here only when:

- at least two workspaces use it;
- it represents a stable, domain-neutral abstraction;
- placing it here reduces coupling rather than exposing a domain's internals.

Do not create generic `utils`, `common`, or miscellaneous modules. Code that
belongs to one domain stays in that domain even when another domain consumes
its public API.
