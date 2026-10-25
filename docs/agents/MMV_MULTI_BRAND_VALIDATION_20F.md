# Sprint 20F — Multi-brand Validation

## Scope

Validation brands:

- Toyota
- Jeep
- Volkswagen
- Audi

## Staging state at start

Toyota and Jeep:
- target enabled
- active Brand Connector exists

Volkswagen and Audi:
- target enabled
- origin MANUAL
- no active Brand Connector yet

Canonical MMV registry:
- catalog_mmvs rows = 0

Production remains untouched.

## Runner

Use:

```bash
pnpm agent:mmv-validation:20f
```

The runner is staged and governance-safe:

1. If a brand has an active connector, run MMV Discovery with OpenAI and persist operational findings.
2. If a brand has no active connector, run Brand Connector discovery and persist a proposal for human review.
3. Never activate a connector automatically.
4. Never ACCEPT a finding automatically.
5. Never apply a canonical MMV automatically.
6. Never mutate Production.

Reports are written to:

```text
.local-reports/agents/mmv-multibrand-validation/
```

Expected first-pass state:

- Toyota -> MMV_RUN_COMPLETED
- Jeep -> MMV_RUN_COMPLETED
- Volkswagen -> CONNECTOR_REVIEW_REQUIRED
- Audi -> CONNECTOR_REVIEW_REQUIRED

After operator review + connector activation for Volkswagen/Audi, rerun the same command. Then all four brands should execute MMV Discovery.

## Acceptance gates

For each brand validate:

- official evidence only;
- no external evidence leakage;
- current models/variants discovered;
- duplicate observations deduplicated;
- same-label/distinct-powertrain identities preserved;
- transmission-only descriptor drift does not create MMV;
- body derivatives surface as review-only when model identity is ambiguous;
- evidence readiness recorded;
- findings persist without canonical mutation.

Canonical Apply remains a separate operator action after ACCEPT.

## Production

No 20F data is copied from Staging to Production.

## First-run corrections (20F.1, 2026-10-02)

Toyota body proposals previously repeated per variant with identical logical fingerprints but different evidence, causing CONTENT_CONFLICT during persistence. Current discovery now groups normalized currentModel/bodyStyle/proposedModel before mapping and unions evidence with the existing URL/title/excerpt/evidenceType deduplication helper. Distinct Hilux bodies remain separate and all body proposals require review.

Volkswagen research emitted a candidate domain without matching domain/subdomain evidence. The prompt now requires evidence of official manufacturer ownership for every domain in the same response; unsupported domains must appear only in warnings. Agent validation remains unchanged.

Audi transport failures previously collapsed into CONNECTOR_RESEARCH_FAILED. The provider now emits typed safe codes: 400/422 BAD_REQUEST, 401/403 AUTH, 408/SDK timeout TIMEOUT, 429 RATE_LIMIT, 5xx SERVER_ERROR, SDK connection CONNECTION, otherwise FAILED, all prefixed CONNECTOR_RESEARCH_. CLI preserves these exact allowlisted codes. Errors retain only code and bounded status, never raw error/cause/headers/body/response text. No retry was added.

These local corrections do not authorize a live rerun, automatic review ACCEPT, connector activation, MMV apply or Production mutation. No database migration is required.

### Local verification

- Requested core discovery/body/platform tests: 3 files, 25 tests passed. Full core suite with `pnpm --filter @compra-car/core exec vitest run --maxWorkers=2`: 43 files, 1037 tests passed.
- `pnpm --filter @compra-car/adapter-openai test`: 3 files, 85 tests passed, including safe transport diagnostics and unsupported candidate-domain rejection through BrandConnectorAgent.
- Agents runner/connector CLI/environment diagnostics: 3 files, 39 tests passed, including all new CLI error codes and existing governance checks.
- Requested core/adapter-openai/agents typechecks and global `pnpm typecheck` passed. `pnpm build` passed. ESLint and Prettier checks on all changed TypeScript files passed; `git diff --check` passed.
- Global `pnpm lint` remains blocked by four existing unused-parameter errors in `scripts/agents/test/mmv-multibrand-validation.test.ts` (unchanged from HEAD). Global `pnpm format:check` reports 382 files outside the changed TypeScript files; repository-wide reformatting is outside this fix.
- Global `pnpm test` stopped in core after two 5-second timeouts in existing commercial domain-mapping tests (1034 passed); a repeat with Turbo concurrency 1 still had one timeout (1036 passed). The full core suite subsequently passed with two Vitest workers and unchanged test timeouts. The remaining global package suites were not completed through the global gate.
- Environment limitation: Node 24.15.0 was available, while the repository requires Node 22.x. PENDENTE: repeat global gates under the supported runtime and resolve the existing lint/format baseline before declaring the entire monorepo gate green.
- Sandbox initially blocked Vitest worker spawning with EPERM; local test execution succeeded with expanded execution permission. All new provider tests use injected transports; no live OpenAI or remote database operation was performed.
