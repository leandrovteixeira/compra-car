# ADR-022 - Watcher QA through Supabase APIs

Date: 2026-10-26. Status: accepted architectural direction; implemented locally, remote validation pending.

## Context and decision

Direct PostgreSQL DNS/connectivity from a notebook must not be a runtime or operational
requirement. Supersedes the direct SQL endpoint requirement in ADR-021 and the historical
24A.3b QA report. Existing Watcher SQL functions, transactions, adapter contracts and
the two approved migration files/manifest remain unchanged.

- Runtime uses `WatcherSupabaseAdapter`, supabase-js and HTTPS RPC with `SUPABASE_URL`
  and `SUPABASE_SERVER_KEY`, like other agents. The approved Staging file is the only
  loader input. Its exact project URL must match `shfsjyjxmgwnlexmdkcs`; only then are
  staging labels normalized to qa. Guard checks run before client creation and each RPC.
- No `WATCHER_QA_SQL_URL` or database password is required or constructed. Old PostgreSQL
  passwords in the shared file are not imported. SQL URL aliases, PG settings, conflicting
  identities/keys and TLS disablement fail closed; no SQL transport fallback exists.
- Administrative reads use an isolated adapter under `packages/adapter-supabase` with
  fixed HTTPS Management API endpoints, redirects disabled, bounded timeout, sanitized
  failures and no automatic retry. It has only read-only query and migration-history
  capabilities. It cannot apply migrations or call the generic writable query endpoint.
- Management authentication uses a separate `SUPABASE_ACCESS_TOKEN` from the approved
  file. Never substitute the runtime server key or inherit a token from another context.
  Prefer a project-scoped token with `database_read` and `database_migrations_read`.
- The local plan pins paths, order and exact approved SHA-256 hashes in addition to the
  unchanged manifest. It emits only deployment descriptors, never credentials or SQL.
  Actual application requires separate authorization and an administrative writer not
  enabled by this increment.

## API deployment plan

See [operator procedure](../../agents/WATCHER_QA_API_DEPLOYMENT.md). Management API migration
application uses POST `/v1/projects/{ref}/database/migrations` with query/name and generates
the history version. The approved source versions remain in the requested names; the
returned/generated versions must be reconciled, not assumed equal to source filenames.
Do not insert, patch or upsert history to hide a discrepancy. Per-file transactions remain
unchanged; the two requests are not one atomic deployment. Never retry an uncertain write.

## Consequences and limitations

No new dependencies or parallel database infrastructure. The read-only endpoint is Beta;
availability, response shape or insufficient catalog visibility can block preflight. Missing
or malformed metadata always fails closed. Preflight blocks existing Watcher relations,
functions, policies, browser grants, matching migration history, active event triggers and
browser default ACLs requiring review. Such a conservative NO_GO needs explicit reconciliation,
not a relaxed guard. A successful preflight means ready for a separate deployment review,
not authorization to write or start collection.

The API plan does not prove runtime credential ownership, gateway exposure, schema-cache
freshness, SQL permissions of the eventual applying identity, or operational RPC behavior.
Postflight and explicitly reviewed HTTP RPC validation remain activation gates. Existing
local PostgreSQL test harnesses remain test-only; no operational SQL connector is introduced.

## Sources

- [Management authentication](https://supabase.com/docs/reference/api/introduction)
- [Read-only query](https://supabase.com/docs/reference/api/v1-read-only-query)
- [Migration history](https://supabase.com/docs/reference/api/v1-list-migration-history)
- [Apply migration](https://supabase.com/docs/reference/api/v1-apply-a-migration)
