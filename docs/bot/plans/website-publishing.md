# Website publishing

The [architecture](../architecture.md) establishes that publication failures must
not block competition operations. A successful bot operation does not imply
successful publication.

Decide the publication interface, retry policy, and reconciliation behavior when
implementing the integration, including how hosts can identify unpublished work.
