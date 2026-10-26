# Watcher persistence foundation - Sprint 24A.3a

Status: implemented locally; remote activation pending review. Branch: sprint-24-watcher-local.
No migration was applied to QA or production. No worker, scheduler, feed collection, model call,
UI or Brand Connector dispatch was enabled. Existing 24A.1/24A.2 work is preserved.

## Files and boundaries

Created:

- `supabase/migrations/20261025220424_sprint_24a3a_watcher_storage.sql`: schema/security.
- `supabase/migrations/20261025220427_sprint_24a3a_watcher_transactions.sql`: RPCs/locking.
- `packages/core/src/agents/watcher-persistence.ts`: pure repository port and validators.
- `packages/core/test/watcher-persistence.test.ts`: pure persistence contract coverage.
- `packages/adapter-supabase/src/watcher-supabase-adapter.ts`: injected RPC adapter.
- `packages/adapter-supabase/test/watcher-supabase-adapter.test.ts`: adapter unit tests.
- `supabase/tests/watcher/001_security_constraints.sql`: transactional SQL assertions.
- `scripts/watcher/test-postgres.mjs`: disposable local PostgreSQL integration runner.
- This report and `docs/architecture/decisions/ADR-021-WATCHER-OPERATIONAL-PERSISTENCE.md`.

Changed for this increment: root package.json (watcher:test:postgres), Core agents index (port
export), adapter package.json (dedicated ./watcher export), AI_CONTEXT.md, CHANGELOG.md and
ROADMAP_MASTER.md. The adapter root index had its trailing whitespace normalized only.
Other dirty/untracked files belong to the preceding increments; no commit was created.

Core has no Supabase import. Consumers use `@compra-car/adapter-supabase/watcher` in server
code and inject a client. No environment/client construction happens automatically. The
Watcher adapter deliberately does not enter the general adapter barrel: that barrel is
used by Next middleware, whereas agent validators require Node crypto.

## Schema

| Table | Identity and responsibility |
| --- | --- |
| watcher_sources | source id, unique canonical feed URL, original request configuration, config version |
| watcher_source_state | one row/source, conditional HTTP validators, checkpoint, failure count, version and lease |
| watcher_articles | unique canonical URL, identity rule version and observation range |
| watcher_feed_items | unique source/item key, opaque GUID, article and current revision pointer |
| watcher_candidates | unique normalized identity fingerprint, version, project/model and Brazil status |
| watcher_candidate_evidence | candidate version/snapshot, source revision, assertion and confirming actor |
| watcher_hints | immutable PREPARED payload, unique candidate/version/evidence; never dispatched |
| watcher_article_revisions | immutable normalized bounded metadata, unique feed item/content fingerprint |
| watcher_batches | immutable idempotency receipt, source snapshot, input hash, diagnostics and checkpoint outcome |
| watcher_batch_items | immutable observation journal associating batch, feed item and revision |

The three audit tables are necessary to retain article updates, content reversions and
transaction receipts without overwriting origins. Revision content remains source-specific;
a shared canonical article does not arbitrarily replace one publisher's metadata with another.
GUID identity is source-scoped and falls back to canonical URL, using 24A.1 contracts.
No full article bodies, XML documents or third-party images are stored.

RLS is enabled on all ten tables; anon/authenticated have neither policies nor grants.
Service role receives SELECT/INSERT and explicit mutable-column UPDATE only, with no
DELETE/TRUNCATE. Audit rows have immutable triggers, including for owner updates. Deferred
composite foreign keys prevent mismatched current revisions. Bounds, enums, fingerprints,
JSON shape, source configuration and uniqueness have SQL constraints/validators and indexes.
There are no foreign keys or writes to canonical product/price/specification tables.
RPCs use SECURITY INVOKER, empty search_path and service-only execution privileges.

## Transactions and recovery

- `watcher_register_source`: compare-and-swap configuration version; active lease blocks
  changes. A configuration change clears HTTP validators/checkpoints and fences old tokens.
- `watcher_claim_source`: locks state, grants a UUID token for 1-300 seconds; another live
  collector gets no lease. Expired leases can be replaced; state and config versions fence
  an old collector. `watcher_release_source` requires the matching live token.
- `watcher_persist_batch`: serializes the client batch UUID with an advisory transaction
  lock, validates token/config/state, locks the source and state, and locks shared article
  URLs in sorted order. Inserts journal/revisions/current pointers and updates checkpoint
  in one transaction. Lease expiry is checked again before completion. Commit releases lease.
- A receipt hashes the normalized logical payload, not the transient lease token. Concurrent
  replay and a retry after a lost response return the same receipt without overwriting a
  later checkpoint. Reusing a UUID for different content fails.
- Partial/rejected/truncated batches may retain valid observations, but do not advance the
  checkpoint. A database exception or backend death rolls back every change. The abandoned
  lease expires; a retry can reclaim it and commit the same logical batch safely.
- A-B-A content returns to the existing A revision; batch observation and current_observed_at
  retain the new transition. publishedAt is never the exclusive ingestion cursor.
- `watcher_stage_candidate` versions candidates. `watcher_attach_evidence` records the exact
  candidate snapshot/version and source revision. `watcher_prepare_hint` requires the current
  version, EXPECTED_BR status, explicit BR confirmation/actor and a still-current revision
  locked during preparation. Prepared hints are idempotent, immutable, and do not call another agent.
- `watcher_query` provides bounded pages (max 100) of sources/state/articles/revisions,
  source items/history, receipts/candidates/evidence. Source snapshots and current pointers
  allow an operational caller to rehydrate 24A.2 state after restart; no worker is implemented.

## Verification

Run from repository root:

```sh
pnpm watcher:test:postgres
pnpm --filter @compra-car/core exec vitest run test/watcher*.test.ts
pnpm --filter @compra-car/adapter-supabase exec vitest run test/watcher-supabase-adapter.test.ts
pnpm --filter @compra-car/agents exec vitest run test/watcher-feed*.test.ts
```

The PostgreSQL runner pins a verified local Docker endpoint, rejects remote endpoints,
starts postgres:16.13-alpine with network disabled and no ports/mounts, applies only these
two migrations, exercises the actual adapter against SQL functions, and removes its own
container in finally. No existing database is used. SQL fixtures create local Supabase-like
roles; this is not a deployed Supabase/PostgREST stack. Adapter SDK response shape is tested
separately through an injected offline fetch.

Results: 262 targeted TypeScript tests passed (135 Core, 20 adapter, 107 feed scripts),
preserving all 226 tests from 24A.1/24A.2. All 21 PostgreSQL scenario groups passed, including
RLS/grants/indexes/constraints, independent-session races, expiry during commit, terminated
backend rollback, concurrent replay, source snapshots and recovery, updates/reversals,
cross-source origins, injected persistence errors and checkpoint freeze. SQL also covers
NULL validation bypasses and UTF-16 text limits consistent with Core.

Global gates and baseline comparison are recorded under ignored
`.local-reports/watcher-24a3a/`. Full adapter tests reproduced exactly six existing failures
also reproduced from HEAD in an isolated snapshot (commercial catalog x3, legacy adapter x2,
public prices x1). Full scripts retain the same six known failures. Core has six known
functional baseline failures; the first concurrent run also hit a 5-second timeout in old
commercial domain mapping. All 18 tests in that file passed on the isolated recheck. The final global rerun had exactly
the six baseline failures and 1233 passes, with no timeout or new failure. Global lint retains 51 existing Web warnings; scoped
Core/adapter/runner lint passes. Format check reports 191 existing files versus 192 baseline,
with no newly failing file. Typecheck passes. Build initially exposed a new barrel/Node crypto
coupling; the dedicated Watcher subpath fixes it. The final global build passed; results are recorded in the local logs.

## Residual risks and review boundary

- QA/Supabase/PostgREST compatibility and migration application remain PENDING. Review the
  two migrations explicitly; never apply the entire accumulated branch migration history blindly.
- service_role is a privileged trusted backend capability. Confirming actor UUID is attributed
  by that caller; real actor authentication, review authorization and operational wiring are
  outside 24A.3a. No browser can prepare hints.
- No production-scale benchmark, retention/archival policy or remote recovery drill was run.
  Audit history grows with changes; operational retention requires a separately reviewed design.
- Local Node is 24.18.0 while the repository requests 22.x; repeat gates on the supported
  runtime before activation. Existing global failures remain unresolved outside this scope.
- No deployment, scheduler, migrations remote, feed requests, OpenAI calls, Legacy modifications,
  commits or push. Zero remote writes. Sprint 24A.3b has not started.
