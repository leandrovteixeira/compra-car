# Sprint 26 — Agent UX & Control Center — Audit 26A

## Objective

Prepare the existing agent ecosystem for ordered operator/admin review and decision making.
This sprint does **not** rebuild orchestration. Sprint 19 Agent Platform remains the shared
run/finding/evidence/review foundation. Sprint 24 Watcher keeps its stronger versioned
intelligence persistence.

The Control Center will unify presentation and decisions without forcing all agents into
one physical storage model.

## QA inventory audited — 2026-10-28

### Agent Platform

- 38 persisted runs
- 462 findings
- 1,246 evidence rows
- 12 human review rows

Current run families observed in QA:

| Family | Runs | Current role |
| --- | ---: | --- |
| BRAND_CONNECTOR | 8 | Official source/brand connector discovery and drift |
| MMV_DISCOVERY | 20 | Commercial identity discovery/reconciliation |
| MODEL_YEAR | 4 | Historical Model Year contract |
| PRODUCT_YEAR | 6 | Newer lifecycle implementation that also reuses MMV evidence |

Important compatibility decision: Sprint 26 UI recognizes both MODEL_YEAR and PRODUCT_YEAR.
Historical data must remain reviewable.

### Brand Connector output

Finding types observed:
- NEW_BRAND_CONNECTOR
- CONNECTOR_DRIFT

Decision payload contains:
- canonical/observed brand identity
- aliases
- allowed domains
- source entries
- search hints
- terminology hints
- warnings/drift

Human review means agreement/disagreement with the finding. Connector activation remains a
separate explicit action.

### MMV Discovery output

Finding types observed:
- MMV_MATCHED (informational)
- NEW_MODEL
- NEW_VERSION
- AMBIGUOUS_MMV

Reviewable findings contain:
- observed commercial identity
- candidate canonical MMV
- technical discriminators
- confidence/evidence readiness
- market/FIPE reconciliation candidates
- proposal to stage MMV identities when applicable

A flat finding row is insufficient. Operator needs the observed identity, current catalog
match, reason, confidence/readiness, and evidence in the first screen.

### Model Year / Product Year output

Historical MODEL_YEAR findings:
- MODEL_YEAR_MATCHED
- NEW_MODEL_YEAR

Newer PRODUCT_YEAR findings:
- NEW_PRODUCT_YEAR
- POSSIBLE_NEW_MMV
- conflict/uncertain/discontinued categories supported by code

Decision rule:
- confirmed existing year = informational
- new supported year = review
- unresolved MMV = route back to MMV decision flow, not a lifecycle approval

The Control Center must present these as one user-facing family: **Ano-modelo**, while
preserving the producer/version in technical details.

### Watcher output

Watcher is intentionally not stored in agent_findings.

Operational storage currently contains:
- watcher_sources / source state
- batches
- articles/feed items/revisions
- scheduler jobs
- AI revision jobs
- versioned intelligence units/candidates/reviews

Watcher intelligence candidates have their own optimistic version/review fences:
- scope
- event_key
- candidate version
- review version
- snapshot
- immutable review snapshot/receipt

This is stronger than Agent Platform's append-only review contract and must not be weakened
by copying the Watcher into agent_findings just for UX convenience.

Current QA state at audit time:
- ingestion batches COMMITTED
- scheduled jobs COMPLETED
- recent AI revision jobs failing with WATCHER_AI_UNCLASSIFIED_FAILURE
- no current watcher_intelligence_candidates yet

Health and review readiness therefore need separate status indicators.

## Existing UX audit

Current /admin/agents provides:
- flat review queue
- run history
- brand configuration
- QA launcher
- background jobs
- per-agent custom detail screens

Main gaps:

1. No Watcher presence.
2. Flat queue mixes domains and does not express operator action.
3. Agent type is more prominent than the business decision.
4. JSON remains too prominent in several detail paths.
5. Operational health, execution controls and review queue are mixed on one page.
6. No summary of pending decisions by domain/agent/severity.
7. No explicit upstream/downstream dependency cue.
8. Historical MODEL_YEAR records were absent from the type catalog in the current branch.
9. Informational observations and decision-required findings need stronger visual separation.
10. No unified concept of "review item" across Agent Platform and Watcher.

## Sprint 26 presentation contract

The common abstraction is a **Review Item**, not a common database row.

A Review Item must expose:

- source family: BRAND / MMV / MODEL_YEAR / WATCHER
- producer type/version
- stable source reference
- business category
- title
- concise operator summary
- brand/model/version scope where known
- confidence/readiness
- review state
- evidence count and strongest evidence preview
- proposed effect
- dependency/blocker
- created/observed time
- action permissions
- technical payload link/details

Storage-specific optimistic concurrency remains behind the adapter.

## Proposed Control Center information architecture

### 1. Visão geral

Four agent-family health cards:
- Brand Connector
- MMV
- Ano-modelo
- Watcher

Each card:
- last successful run
- current health
- pending decisions
- informational findings since last review
- recent failures
- current job/run status

Global top metrics:
- Aguardando decisão
- Bloqueados por dependência
- Falhas operacionais
- Runs nas últimas 24h

### 2. Fila de revisão

Primary operator workspace.

Default grouping by decision domain:
- Identidade de marca/fontes
- Modelos e versões
- Ano-modelo
- Mercado / notícias

Filters:
- status
- agent family
- brand
- decision domain
- confidence/readiness
- date

Rows/cards should answer before opening detail:
- What changed?
- Why does it need me?
- What is the current catalog/state?
- What happens if I accept/reject/defer?

### 3. Detalhe de decisão

Shared shell with agent-specific body.

Header:
- business category
- subject
- source family
- status
- confidence
- blocker/dependency

Body:
- Observed
- Current state
- Proposed effect
- Evidence
- Warnings/uncertainties
- Decision history

Footer:
- Accept / Reject / Defer
- note
- explicit statement of whether decision itself mutates canonical data

Technical JSON is collapsed under an advanced section.

### 4. Execuções & Saúde

Run/job history is moved away from review.
Includes Agent Platform runs, agent_jobs and Watcher operational/scheduler health.

### 5. Controles

Admin-only operational controls:
- monitor sources
- force MMV
- future per-agent enable/disable/cadence/budget controls
- watcher source/schedule control

### 6. Marcas

Keep existing brand/connector administration, linked from Control Center.

## Ingestion rule

Do not introduce a new universal findings table in 26A.

Create presentation adapters:

- AgentPlatformReviewSource -> agent_findings/evidence/reviews
- WatcherReviewSource -> watcher_intelligence_candidates/reviews

Both return the shared Review Item view model.

This allows Spec, Commercial Policy and Media Outlet agents to target the shared review
contract from day one while retaining domain-specific storage if needed.

## Implementation order

26A — audit + compatibility + presentation contract
26B — Control Center overview and unified Review Inbox
26C — agent-specific decision detail refinement
26D — operational health/runs/controls split
26E — real QA ingestion tests for Brand/MMV/Model Year/Watcher
26F — decision/action validation and operator/admin permission hardening

## First QA gates

- historical MODEL_YEAR findings visible
- PRODUCT_YEAR displayed to user as Ano-modelo, with producer shown only in technical context
- Watcher health visible even when no intelligence candidate exists
- Watcher candidate can enter unified inbox without copying into agent_findings
- accept/reject/defer maintains source-specific concurrency semantics
- no review action silently mutates canonical data unless the specific action explicitly says it does
- production remains untouched
