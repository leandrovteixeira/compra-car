# ADR-021 - Watcher operational persistence

Date: 2026-10-25. Status: implemented locally, pending review before remote activation.

## Context

Watcher ingestion is deterministic and currently in memory. Durable incremental collection
requires shared concurrency control, exact retry receipts and evidence history, without
coupling Core to Supabase or activating any existing agent.

## Decision

Keep a pure WatcherRepository port in Core and a server-only injected Supabase RPC adapter
under the dedicated `@compra-car/adapter-supabase/watcher` subpath. Do not export the adapter
through the middleware-consumed general barrel, because Watcher validators use Node crypto.

Use the seven requested operational tables plus immutable article revisions, batch receipts
and batch observation journal. Canonical article URL identifies a shared article; source-scoped
GUID/URL identifies feed items. Revisions remain attached to each origin. Capture source and
candidate version snapshots with the observations/evidence they explain.

Use PostgreSQL transactions, row locks, fencing tokens/config/state versions and bounded
leases. Serialize duplicate batch IDs with transaction advisory locks and acquire shared URL
locks in deterministic order. A batch receipt is stable across token changes and lost responses.
Only successful complete batches advance HTTP checkpoints. No local semaphore is relied on
for database concurrency. Preserve immutable evidence and A-B-A content transitions.

RLS denies browser roles; service-only SECURITY INVOKER functions use minimum table/column
grants. No canonical catalog tables are changed. Hints are only PREPARED, require versioned
explicit Brazil evidence, and are never dispatched in this increment.

## Consequences

Recovery can rebuild current/history state from paginated reads. Additional audit tables
increase storage and require a later retention policy. Trusted backend actor attribution is
not an authentication workflow. Integration tests use disposable local PostgreSQL with
Supabase-like roles, not a remote project or real PostgREST deployment. Remote validation,
review workflow, scheduling and Brand Connector handoff remain separate increments.

See [implementation and tests](../../agents/WATCHER_PERSISTENCE_24A_3A.md).

## 24A.3b-Fix - QA operational boundary

All future Watcher operational commands must enter through the mandatory QA executor from
@compra-car/adapter-supabase/watcher-qa. Require explicit qa identity, exact allowlisted
Supabase/ref/direct SQL endpoint, consistent aliases and dedicated credentials; no dotenv
or production fallback. Validate before client creation/callback and every RPC. Keep candidate
review/hints disabled in the collection capability. Low-level adapter injection remains for
disposable tests.

Deployment uses a two-file SHA-256 manifest and an offline-only plan command. Read-only
pre/postflight uses the same guard plus an explicitly injected reviewed connector; no remote
connection or application is performed by the plan CLI. Do not use unrestricted db push.
Feed request URL is stored settings.requestUrl, separate from canonical source.feedUrl.
SQL postflight is catalog-only, Watcher-scoped, and does not assume an empty database.

See [QA safety and first preflight procedure](../../agents/WATCHER_QA_SAFETY_24A_3B_FIX.md).
