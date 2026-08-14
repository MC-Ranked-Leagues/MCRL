# Shared

This directory is reserved for code and contracts that are genuinely shared by
multiple domains.

Add something here only when:

- at least two domains use it;
- it represents a stable interface or contract;
- placing it here reduces coupling rather than exposing a domain's internals.

Do not create generic `utils`, `common`, or miscellaneous packages. A likely
future candidate is a validated contract for Seed's published-history HTTP
interface, but it should remain domain-owned until both domains need the same
definition.
