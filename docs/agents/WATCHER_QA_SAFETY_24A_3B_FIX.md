# Watcher QA Safety and Readiness - Sprint 24A.3b-Fix

Implemented locally on sprint-24-watcher-local. No Supabase connection, remote migration,
external feed collection, OpenAI call, deployment, commit or push. 24A.3b-2 is not started.

## Inventory

Created:

- packages/adapter-supabase/src/watcher-qa-safety.ts: mandatory pure QA target guard and guarded operational executor.
- packages/adapter-supabase/test/watcher-qa-safety.test.ts: missing/conflicting/production configurations, credential drift and pre-dispatch rejection.
- scripts/agents/watcher-qa-deployment.ts: verified offline plan and injected read-only pre/postflight boundary.
- scripts/agents/watcher-qa-plan-cli.ts: offline-only command, no connection implementation.
- scripts/agents/test/watcher-qa-deployment.test.ts: manifest integrity and connection-boundary tests.
- scripts/watcher/qa-migrations.json: exact two-file ordered migration allowlist with SHA-256 hashes.
- scripts/watcher/qa-preflight.sql: catalog-only first preflight, BEGIN READ ONLY.
- scripts/watcher/qa-postflight.sql: catalog-only scoped postflight, BEGIN READ ONLY.
- This report.

Changed: adapter package exports (./watcher-qa); root package scripts (watcher:qa:plan);
Watcher feed ingestion and its tests; transport regression tests; transactions migration
(explicit function signatures); disposable PostgreSQL harness; ADR-021, AI_CONTEXT, CHANGELOG
and roadmap. Other dirty files from 24A.1/2/3a remain preserved.

## Mandatory QA boundary

Only project shfsjyjxmgwnlexmdkcs and https://shfsjyjxmgwnlexmdkcs.supabase.co are accepted.
Required explicit process configuration:

- APP_ENV=qa
- WATCHER_ENVIRONMENT=qa
- WATCHER_QA_PROJECT_REF=shfsjyjxmgwnlexmdkcs
- SUPABASE_URL=https://shfsjyjxmgwnlexmdkcs.supabase.co
- WATCHER_QA_SQL_URL: dedicated credential-bearing direct PostgreSQL URI, database postgres,
  user postgres, host db.shfsjyjxmgwnlexmdkcs.supabase.co, default/5432 port, sslmode=verify-full.
- WATCHER_QA_SERVER_KEY: dedicated server credential, required for the operational executor;
  not required merely to compute a migration plan or execute a SQL read-only procedure.

Credentials must come from the approved secret store into the process; never print them,
put them in a committed env file or pass them as CLI arguments. No dotenv or agent-env file
is loaded. Generic server keys cannot substitute the dedicated Watcher key. Explicit aliases
must agree; conflicting public/server URLs, refs, environment labels and SQL URLs are rejected.
PGHOST/PGHOSTADDR/PGPORT/PGDATABASE/PGUSER/PGPASSWORD/PGSERVICE/PGSERVICEFILE/PGOPTIONS/PGSSLMODE
and TLS verification disablement are rejected. Poolers and alternate/custom hosts are deliberately
not accepted in this increment. Missing or unverifiable configuration never selects another target.

createWatcherQaExecutor validates before constructing the injected client, before its run
callback and before every RPC, including an adapter retained by the callback. Credential and
SQL configuration drift aborts. The collection capability allows only source/state/article/
revision/batch operations. Candidate/evidence/hint RPCs and candidate query modes are blocked.
No worker, CLI feed collector or scheduler is enabled. Future operational commands must use
this executor rather than constructing the low-level adapter directly.

The low-level WatcherSupabaseAdapter remains injectable for disposable integration tests.
The guard does not sandbox arbitrary SQL tools or malicious code that deliberately bypasses
these entry points; procedural use and credential isolation remain mandatory.

## Request URL versus identity

source.feedUrl remains the canonical identity. ingestWatcherFeed now accepts stored settings
and validates them with validateWatcherRegistration; HTTP uses settings.requestUrl, preserving
path, query and trailing slash. Parser relative URLs use that same request document base.
Conflicting explicit requestUrl/settings are rejected before dispatch. Stored parser host and
relative-URL policy override competing caller options. Legacy deterministic callers can still
supply their original source URL, with identity equivalence checked before dispatch.

The transport still refuses redirects and never uses article canonicalization as its outgoing
request URL. Offline regressions cover a slash-required endpoint, redirect rejection and
restoration from canonical stored source plus exact request settings.

## Migration and SQL review artifacts

The transactions migration replaces the prefix-wide ACL loop with an explicit list of ten
function signatures (RPCs plus helpers introduced by that migration). Storage already names
its seven helper signatures explicitly. Transactions, RLS and minimal grants are preserved.
A disposable fixture with a preexisting watcher-prefixed function proves its ACL is untouched.

Order and hashes are authoritative in scripts/watcher/qa-migrations.json:

1. 20261025220424_sprint_24a3a_watcher_storage.sql
   0d43e3f5473b08e7b0cb4b2eca30567069c108ecc7946433354997dd80d31e23
2. 20261025220427_sprint_24a3a_watcher_transactions.sql
   41b2a300a53291b44bfd62dda293a6c31ec2e3b9475361c35e0cf2d3ee9a0f06

Both SQL files use LF, as required by .gitattributes, so hashes survive Git checkout.
The storage SQL behavior is unchanged; its byte hash changed through LF normalization.
Any content/order/path/project/hash mismatch rejects the plan.
Only these files may be considered for a later reviewed application; no unrestricted db push.
DDL remains once-only and each file is transactional; reconcile migration history before retry.

Postflight inspects exactly ten Watcher tables. It checks RLS, browser table and column ACLs,
service role privileges and exact mutable UPDATE columns, constraints, nine unique constraints,
14 FKs with exact source/target columns, valid operational indexes, immutable triggers, 17
function signatures/return types/security/search paths and eight RPC named-argument lists.
It inventories constraint and index definitions for human review. No fixtures, temporary grants,
DDL or DML are executed. Unrelated public tables/FKs do not enter the checks. Every passed
column must be true; missing rows, SQL errors or false/null results block activation.

SQL metadata checks cannot prove Data API exposure, schema-cache freshness, gateway limits or
real HTTP JWT behavior. A later approved PostgREST smoke test remains required.

## Exact first remote preflight procedure - NOT EXECUTED

1. Obtain explicit approval for 24A.3b-2. Use a new process with the explicit QA configuration
   above, no inherited conflicting environment/SQL aliases, no production credential fallback.
2. From repository root run pnpm watcher:qa:plan. This command is local only: it verifies the
   target and both migration byte hashes, and emits only safe identifiers, paths and hashes.
   It rejects extra CLI arguments. It cannot apply migrations or connect to Supabase.
3. Review the emitted project ref, exact URL, order and hashes against the approved manifest.
   Confirm the connection metadata/credential belongs to this QA project using the approved
   secret/project inventory; an opaque server key alone is not proof of project identity.
4. In the approved next increment, provide a reviewed connector to
   runWatcherQaReadOnlyProcedure(root, () => process.env, 'preflight', connector).
   No production connector or generic default is bundled here. This boundary repeats target
   and manifest validation, rechecks configuration just before connection and supplies only
   the exact direct QA SQL URI, readOnly=true and rejectUnauthorized=true. Connector errors
   are sanitized; it must enforce read-only transactions, TLS certificate/hostname validation
   and bounded connection/query timeouts, without logging the connection string.
5. Execute only qa-preflight.sql. Record database version, read-only transaction state,
   service_role BYPASSRLS/schema usage, role metadata, existing Watcher object signatures,
   event triggers and default privileges. current_database() is not project attestation.
6. If supabase_migrations.schema_migrations exists, read only the version rows for
   20261025220424 and 20261025220427. Existing versions/objects require reconciliation;
   do not mark them applied or overwrite them during preflight. If inventory/configuration
   differs from reviewed assumptions, stop without writing.
7. Stop and review the preflight. Do not combine this first read-only check with migration
   application or feed collection. The postflight artifact is reserved for a later, separately
   approved application and must pass along with actual PostgREST validation.

## Validation and remaining limits

306 targeted TypeScript tests pass: 135 Core, 49 adapter and 122 scripts. All 262 previous
Watcher tests are preserved. The local PostgreSQL suite has 23 passing scenario groups,
including scope-safe ACLs/postflight and all prior races, replay, rollback, crash recovery,
content reversions and checkpoint tests. Postflight is also exercised twice against unrelated
public tables/FKs to verify it assumes no empty schema.

Typecheck/build pass; scoped adapter/scripts/runner lint and scoped formatting pass. Global
test retains the six Core baseline failures (1233 passes). Full adapter/scripts suites retain
six preexisting failures each. Global lint retains 51 Web warnings; global format retains
191 preexisting files. Comparison logs are ignored under .local-reports/watcher-24a3b-fix/.
No preexisting global failure is claimed resolved.

Remote PostgreSQL/PostgREST/roles/TLS/credential association remain unverified. The integration
engine is PostgreSQL 16.13; local config declares 17. Node local is 24.18.0, repository expects
22.x. No new dependency was introduced. Dedicated direct QA SQL connectivity may need IPv6;
fail closed rather than substituting an unreviewed pooler. Retention and actor authorization
remain outside this increment. No hints are enabled by the collection executor.

Zero remote writes and zero remote Supabase connections. No QA/production data, canonical
schema, Legacy or other agents changed. No deploy, commit, push, real collection or OpenAI.
