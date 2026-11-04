# Sprint 30 — Watcher Source Connector + Multi-Source Intelligence

Status: design/kickoff only. No ingestion, database migration, provider request, QA activation, deployment or production mutation authorized/performed.

## Goal
Extend the existing Watcher 24A/24B pipeline to multiple independently registered publishers and correlate articles into versioned automotive events with provenance and operator-safe findings. Feed the Sprint 29 Launching Map without duplicating launches.

## Invariants
1. Reuse Watcher feed transport/parser, approved-host validation, source-specific lease/checkpoint, append-only revisions, receipt-first persistence, fencing and QA guard. Do not clone the ingestion pipeline.
2. Each source has its own immutable sourceId, endpoint, allowed hosts, configVersion, health state, cursor, cadence, and capability/license settings. Never share checkpoints or licenses.
3. An article remains identifiable by canonical URL/source item; event identity is a separate correlation layer. Preserve article-to-event many-to-many for genuine multi-event articles.
4. Do not merge events based solely on brand or model. Require event type, product identity, temporal alignment and evidence. Track merge/split corrections as versioned operations.
5. Source count is not independent corroboration: syndicated copies and primary-source rewrites are grouped into provenance families. Assign authority by claim, not only by publisher.
6. Contradictions and rumors remain explicit rather than being collapsed into a false single fact. Keep claim status (reported, corroborated, confirmed, contradicted, superseded), attribution and dates.
7. Findings route into the EXISTING operator review queue with existing Approve/Merge/Reject/Defer actions. Do not add a new review UX.
8. AI is optional and budget-gated after deterministic URL/identity/structured-key matching; audit tokens/cost, inputs hashes, model, version, confidence and reason codes. Never ingest article bodies or images beyond source permissions.
9. Feed data is untrusted: validate/sanitize content, prevent SSRF, deny redirects outside allowlist, enforce HTTPS, DNS/public IP resolution, content type, max size, timeout, rate limits, robots/terms and legal usage.
10. No write to commercial catalog or Launching Map without separate operator-approved handoff; avoid promotion to production.

## Phased delivery
### 30A Source registry and connector
- Registry: sourceId, displayName, domain, feed URL, type RSS/Atom, enabled, frequency, allowedHosts, publisher family, supported locales/regions, categories, TOS/licensing notes, optional cap.
- Source onboarding wizard/validation (feed can be previewed without persist), approve/disable/pause actions in existing Agent/Flight Control administrative UX.
- Independent telemetry: status, last attempt/success, lag, items received/accepted/rejected, bytes, HTTP status, errors, backoff, duplicate ratio.
- Source-scoped queue, retries with exponential backoff and circuit breaker; no blind replay after uncertain DB commit.
### 30B Event intelligence
- Normalized article -> mentions/claims -> candidate event -> canonical event with immutable evidence edges.
- Deterministic candidate retrieval; semantic similarity only for ambiguous pairs; provisional clustering and split/merge audit trail.
- Event types: launch, refresh/minor-change, new generation, price, spec change, market arrival, production, discontinuation, other.
- Claims: model/MY/market, announced vs on-sale date, price/currency/trim, powertrain, specs; claim-level citations, confidence and disagreement.
- Event lifecycle: candidate, corroborated, confirmed, conflicting, dismissed, superseded.
### 30C Integration
- Existing findings/review contract: same action semantics and version locking; include related sources/events/evidence in detail panel only.
- Emit launch candidate to Sprint 29 Launching Map with source provenance and confidence; no automatic canonical model mutation.
- Reuse media-enrichment pilot approvals; track image licensing separately from textual source reliability.
### 30D QA pilot
- Baseline one approved source + two separately authorized sources, deterministic fixtures before live fetch, bounded per-source collection, read-only first.
- Minimum cases: same release in 3 articles -> one event; copied wire story -> one independent origin; two model years -> separate events; rumor vs official confirmation -> evolving claim status; conflicts -> explicit operator review; publisher corrected headline -> new article revision and event revision.
- Failure tests: malformed feeds, 403/429, network timeout, invalid endpoint/redirect/SSRF, syndication, duplicate/out-of-order arrival, checkpoint version races, response lost after commit, operator merge/split, license disallow.
- Gate: zero cross-source state corruption, no duplicated approved findings, correct provenance, zero unapproved image/body reuse, bounded cost and deterministic idempotent replay.

## Dependency
Base is sprint-27-spec-agent because sprint-28 and sprint-29 branches were not visible at kickoff; reconcile at integration time without overwriting concurrent work. Flight Control and Launching Map event contracts must be confirmed before integration. No runtime implementation claimed.

## Suggested pilot selection
Motor1 Brasil is existing approved QA RSS baseline. Select two distinct publisher groups with working public RSS/Atom and verified permissions; do not assume a source's feed or scraping is permitted. Prefer Brazil market coverage and separate editorial ownership.

## Metrics / budgets (targets, not measured)
- Source availability >= 95% of scheduled checks (excluding documented maintenance).
- 100% ingested articles attributed to source/config revision.
- 0 duplicate operator finding per verified event.
- 0 unauthorized image or full article reuse.
- AI classification cost upper bound US$2 per pilot source/run; hard budget enforcement, pause on exhaustion.
- Full telemetry per source/run, including HTTP-only zero-AI runs.
