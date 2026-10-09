# Sprint 22.5D/E status

Implemented in this branch:
- 22.5D: pure deterministic failure classifier and clustering by category, brand, model, source type and source structure; bounded representative IDs.
- 22.5E foundation: pure iteration decision gate comparing identity-level golden scores, snapshots, CI and safety invariants. Outputs REJECT or REVIEW_REQUIRED; cannot deploy or merge.
- Both components have isolated unit tests, no external calls.

NOT implemented: automatic source edits, sandbox creation, hypothesis synthesis, tool-based autonomous iteration, actual brand golden datasets, live cold/warm benchmark, cache instrumentation, spend guard integration. No automation should be described as running end-to-end yet.

Next: review completed CI for this branch; build explicitly reviewed real Kia/VW source+canonical snapshots and stable evidence signatures; introduce a patch runner only after branch and approval safeguards have been verified.

## 22.5E bounded evaluation coordinator
Implemented `engineering-evaluation-loop.ts` with capped iteration count, bounded rejection plateau, candidate input validation and mandatory human review before any promotion. It accepts externally generated, trusted CI evidence and **does not generate, edit, run or apply a patch**. This is intentional separation of proposal evaluation from executable code mutation. Unreviewed cost claims must remain unverified.

## Next-step implementation checkpoint
- Added `engineering-patch-manifest.ts`: strict admission of candidate branch naming, allowed paths and expected SHA-256 hashes; **validation only**, no git writes.
- Added `engineering-benchmark-cli.ts`: replay explicitly reviewed offline JSON fixtures and detect identity-level regressions. Synthetic fixtures in unit tests are not Kia/VW manufacturer benchmarks.
- Remaining: trusted sandbox execution of patches, automated patch generation, captured manufacturer source snapshots, semantic equivalence review, HTTP/cache measurement, paid cost benchmark and a real cross-brand pilot.
- The PR remains draft and must not merge until final CI passes.

## 22.5E file-only patch executor checkpoint

Added `scripts/agents/engineering-sandbox.ts`: a callable, offline patch writer for **caller-owned disposable workspaces**. It admits only strict manifest paths and engineering candidate branch names, verifies original and replacement SHA-256 hashes, checks resolved file paths against symlinks, then writes changed contents. No shell, Git execution, repository cloning, CI invocation, or network calls occur inside the executor. It is not a standalone autonomous agent and does not merge to production. Because filesystem state can change between verification and writing, the caller must ensure exclusive access to a disposable workspace and must not use this tool against a shared checkout.

## 22.5F real-source benchmark prerequisites

1. Capture unchanged official source snapshots with date, domain allowlist, source URL, semantic fingerprint and evidence scope.
2. Independently review expected Brand Connector evidence for Kia and Volkswagen; do not mark synthetic fixtures as real.
3. Pin both candidate and baseline to the same snapshot, canonical dataset revision and business rules.
4. Run both paths offline and record output identities, evidence applicability, cost and unknown metric flags.
5. Repeat with unchanged sources and with controlled source mutations; do not assume a warm run is cheap before measurements.
6. Gate with full CI plus manual review of any proposed changes.

No live manufacturer snapshot or API benchmark was run in this commit series.

## 22.5F — conservative Brand replay eligibility (2026-10-09)

Added `engineering-brand-replay.ts` and tests for Kia and VW (synthetic input only). Candidate reuse requires the *same reviewed connector fingerprint*, complete source URL census, valid SHA-256 content digests, source/brand/market consistency and a nonempty external review reference. Missing evidence or changed sources prevent reuse. Capture time alone does not invalidate matching digests.

**This is only an eligibility check**, not network retrieval, freshness verification, a durable cache, or proof that API costs are zero. The `independentReview` flag is caller-supplied and must be authenticated by a future trusted benchmark pipeline. Synthetic Kia/VW records test the policy; they are not independently verified official manufacturer records.

Before enabling warm-run short-circuit in Brand Connector: capture actual official source snapshots with independently reviewed evidence, define max age/freshness/revalidation, ensure cache can never bypass required health checks, and compare matching cold/warm snapshots and metrics. Do not skip LLM yet.

## 22.5F snapshot capture capability

Added `scripts/agents/engineering-source-capture.ts`: a transport-injected, allowlisted capture helper with byte hashing, source inventory hash, content-addressed payloads and explicit failures. Unit tests use **injected synthetic HTTP results** only. It is **not wired to a live fetch CLI** and has not retrieved official source bytes. The transport implementation must enforce hostname/IP checks, redirect handling, timeouts, size and rate bounds before any live capture; validating only the final URL after fetching is insufficient to prevent SSRF or unbounded downloads. Capture manifests remain `independentlyReviewed:false` until an external reviewer approves them. No golden benchmark or measured cost savings yet.

## 22.5F safe transport boundary (2026-10-09)

Added `engineering-safe-capture-transport.ts` with host allowlist, HTTPS-only policy, DNS public-address validation, mandatory **address-pinned request adapter** contract, redirect rejection, response content-type gate, timeout, bounded streaming bytes and offline tests. It deliberately does **not** use generic `fetch`, which may re-resolve to an unsafe IP after validation (DNS rebinding). The pinned network request implementation must be separately audited for TLS hostname validation and IP family support before live use.

This is a reusable transport policy, **not yet an executable real capture run**. Official Kia/VW raw HTML remains uncaptured. No CI pass claim until the current workflow finishes.

## 22.5F first real offline observation replay
Source captures from GitHub run 37974122747 were stored as an artifact (4 complete captures, four matching SHA-256 digests). Added `engineering-brand-observed-coverage.ts` and tests to compare labels in the initial official-source inventory with frozen HTML snapshots. A label match is only textual presence; it is **not** proof of canonical model/version/current availability. `engineering-capture-verify.ts` writes an `observed-coverage.json` report when all file hashes verify. It remains `independentlyReviewed:false` and must not be used as a golden benchmark or a production cache admission.

## 22.5F review-gated replay admission
Added `engineering-brand-accepted-replay.ts`: deterministic admission checks for a proposed previously accepted Brand research result. It validates connector fingerprint, matching source set digest, declared accepted finding reference, source-domain provenance and market/brand consistency, then reports reusable/non-reusable. The real Brand Connector execution path **does not use this for short-circuiting**. The caller-supplied review reference/flags are **not authenticated** yet; a trusted Agent Platform adapter must verify ACCEPT, run status and current connector version independently before reuse. Hence no production optimization or API savings claim is authorized. Tests use synthetic accepted research; genuine Kia/VW golden outcomes remain unreviewed.
