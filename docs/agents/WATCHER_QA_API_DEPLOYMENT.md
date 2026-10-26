# Watcher QA API deployment procedure

Target: **shfsjyjxmgwnlexmdkcs only**. Local preparation is implemented; no migration
application or collection is authorized by the plan or this document.

## Configuration and commands

The loader reads only `C:/Dev/.secrets/compra-car/staging.env` and requires the exact
QA `SUPABASE_URL`, Staging/QA labels and nonblank `SUPABASE_SERVER_KEY`. This server key
is used by the existing supabase-js RPC adapter; `WATCHER_QA_SERVER_KEY` is no longer
required. Any supplied legacy key alias must agree. Inherited conflicts are rejected.
`SUPABASE_POSTGRES_PASSWORD` may remain in that shared file but is not imported or used.
No direct/pooler SQL URL, database driver or notebook IPv6 route is needed.

Administrative reads additionally require `SUPABASE_ACCESS_TOKEN` in the approved file.
This is a Management API token, distinct from the REST server key, preferably scoped
only to QA with `database_read` and `database_migrations_read`. No token values are
printed or written by these commands; do not pass credentials on the command line.

From the monorepo root:

```powershell
pnpm watcher:qa:plan       # Offline descriptors only; no token/network required.
pnpm watcher:qa:preflight  # Remote reads only; separate Management token required.
```

The preflight uses only:

- POST `https://api.supabase.com/v1/projects/shfsjyjxmgwnlexmdkcs/database/query/read-only`
  with the single catalog SELECT from `scripts/watcher/qa-preflight-api.sql`, all
  catalog references qualified. The endpoint runs as `supabase_read_only_user`.
- GET `https://api.supabase.com/v1/projects/shfsjyjxmgwnlexmdkcs/database/migrations`.

No generic query endpoint or write fallback. TLS is verified by Node HTTPS defaults;
TLS disablement is rejected, redirects fail, requests time out and are not retried.
Missing fields, unknown response shapes, non-read-only sessions, wrong role/database,
missing prerequisites or incomplete history fail closed. Reports emit validated
metadata/counters only, never arbitrary response bodies or raw errors.

Existing Watcher objects/functions/policies or grants block initial deployment. RLS
disabled on an existing Watcher table is explicitly counted. Applied source versions
or API-generated versions with matching names block reapplication. Event triggers or
browser default ACLs also produce NO_GO for separate review. Do not bypass these gates.

## Application plan - prepare only, requires later authorization

1. Run the plan and successful read-only preflight immediately before review. Resolve
   all NO_GO conditions, permission/visibility issues and history conflicts first.
2. Obtain explicit authorization for only these two API calls, in this order:

| Order | Source migration | Approved SHA-256 |
| --- | --- | --- |
| 1 | `20261025220424_sprint_24a3a_watcher_storage.sql` | `0d43e3f5473b08e7b0cb4b2eca30567069c108ecc7946433354997dd80d31e23` |
| 2 | `20261025220427_sprint_24a3a_watcher_transactions.sql` | `41b2a300a53291b44bfd62dda293a6c31ec2e3b9475361c35e0cf2d3ee9a0f06` |

3. Use a separately authorized project-scoped administrative credential with
   `database_migrations_write`. Never reuse the REST key as the Management bearer.
4. For each step, revalidate exact QA identity, token provenance, manifest/order and
   SHA-256 of the actual query bytes immediately before sending. Use POST to the fixed
   `/v1/projects/shfsjyjxmgwnlexmdkcs/database/migrations` endpoint. The request body is
   `{query: <verified file contents>, name: <full source filename without .sql>}`.
   Preserve the SQL verbatim, including its transactions. Do not use unrestricted db push,
   generic query writes, history upserts or automatic retries. This repository currently
   exposes no command or transport method that performs this application.
5. Stop on any failure/timeout. Before retrying, read history and object metadata to
   reconcile an unknown commit outcome. Do not send step 2 until step 1 is confirmed.
   The two API requests are not atomic together.
6. Record the actual API-generated migration versions alongside source names/hashes;
   the API does not accept the original source version as a request field. Do not
   presume source versions appear verbatim in history or fabricate history entries.
7. After a future authorized application, execute a separately reviewed Management
   API postflight covering all checks in `qa-postflight.sql` and HTTP RPC validation
   before activation. The legacy multi-result SQL file is a catalog specification,
   not an enabled direct connector or assumed API result parser. No postflight
   automation or collection is enabled by this change.

## Local validation and remote status

Consolidation update, reported by the project owner on 2026-10-26: the integrated
administrative QA connection confirmed PostgreSQL 17.6, no Watcher tables and neither
approved migration registered. This is externally supplied baseline evidence, not a
new execution of this repository's preflight CLI. Function/grant/event-trigger review
and the separately authorized application remain outside this consolidation.

Consolidation rerun: 76 targeted tests pass (22 loader/deployment and 54 runtime
security/Management/RPC adapter tests). Both raw migration hashes match the approved
manifest and HEAD exactly. Global typecheck and build pass. Current broader gates still fail:
Web lint, eight Core tests (1231 passing) and formatting in 782 files. Core and lockfiles
are unchanged; no unrelated fixes were included. Known Staging secrets were checked
against all candidate files without printing values; no matches were found.

Tests use injected HTTP transports and never contact Supabase. They cover project/key
conflicts, credential drift, missing Management authentication, read-only capability,
redirects/failures, response validation, catalog/history conflicts and pinned artifacts.
At implementation validation, the staging file had a REST server key but no Management
access token, so the local CLI's remote API preflight and administrative permissions
remain **PENDING**. The integrated connection reported above is a separate path.
Do not infer a deployment GO from the supplied baseline, local test or offline plan.

The historical direct PostgreSQL preflight failed at notebook DNS resolution. This API
design removes that dependency; it does not claim that remote validation has occurred.

Validation on 2026-10-26:

- PASS: 56 targeted loader, manifest/deployment, runtime guard and Management adapter tests.
- PASS: real approved-file offline API plan, global typecheck and global build.
- PASS: scoped ESLint/Prettier and `git diff --check`.
- Expected block: real preflight CLI reports `WATCHER_QA_MANAGEMENT_TOKEN_REQUIRED`
  before any HTTP request. No remote query or write was executed.
- Global baseline gates remain failing: lint in Web, six Core tests (1233 passing),
  and formatting in 783 files. No unrelated cleanup was included.
- The two approved migration SHA-256 values and manifest are unchanged. No dependency,
  lockfile, Legacy, production, OpenAI, collection or deployment changes.

See [ADR-022](../architecture/decisions/ADR-022-WATCHER-SUPABASE-API-OPERATIONS.md).
