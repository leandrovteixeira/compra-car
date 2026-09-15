# Sprint 20 - Model Year Agent

## Checkpoint consolidado — Sprint 20 / 20.1 / 20.2

**SPRINT 20.2 IMPLEMENTED · REAL WEBMOTORS PARSER GATE VALIDATED · END-TO-END STRUCTURED CLI SMOKE PENDING.**

[Estado final, validações históricas, exclusões e próximo gate](SPRINT_20_CHECKPOINT.md). O smoke completo structured/monitor/persist-findings ainda não foi executado. Seções com estado local/sem commit abaixo registram o histórico anterior a este checkpoint.

## Contract

For a resolved MMV, discover explicitly supported Model Years and reconcile each with
known catalog MYs. Research input/schema contain no Production Year field. Input
projection allowlists official identity and structured attributes; catalog rows and
internal mmvIdentity are never sent to the LLM. Only opaque targetKey is returned.

Exactly two finding types: MODEL_YEAR_MATCHED (informational, proposal=null) and
NEW_MODEL_YEAR (reviewable, proposal={mmvIdentity, modelYear}). Accept only records
review; there is no product creation or activation action. Reconcile positive
observations only. Distinct MYs coexist and deduplicate by MMV+MY. No explicit MY
means metrics only. No conclusion about missing historical MYs.

## Integration

PlatformMmvDiscoveryReader consumes the existing AgentPlatformRepository read port,
backed by adapter-supabase. It paginates runs, selects the latest COMPLETED discovery
by completion time within brand/BR (UUID tie-break), and loads evidence/latest review.
An empty latest run does not fall back to older runs. Only MMV_MATCHED with one still
existing catalog identity and no REJECT/DEFER is eligible. NEW_MODEL/NEW_VERSION,
even ACCEPTed, and AMBIGUOUS_MMV remain excluded and counted as skipped.

AdministrativeProductCatalogReader reuses existing administrative queries. Grouping
uses catalogMmvIdentityId; knownModelYears reads only distinct modelYear. No matcher,
parser, catalog naming, Active/Public or catalog table changes.

The real CLI uses OperationalBrandConnectorResolver and requires ACTIVE. No new brand
branches or fallback. Source entries and terminology are incorporated in resolver hints.
The report stores the effective source snapshot/fingerprint. The current resolver does
not expose connector UUID/version; that identifier is not fabricated. Fixtures provide
synthetic ACTIVE connectors for VW, Toyota and Jeep.

## Structured-first discovery — Sprint 20.2

Targets are grouped by resolved brand/model. Webmotors lookup fetches one model root and bounded year pages for all versions. A root year alone never creates an MMV observation: a version row must map uniquely using trim, powertrain and available constraints. No fuzzy identity or catalog renaming.

Source tiers: STRUCTURED_AUTOMOTIVE_DATA, MANUFACTURER_OFFICIAL, AUTHORIZED_DEALER. Source kinds distinguish WEBMOTORS_FIPE from future FIPE_OFFICIAL, WEBMOTORS_CATALOG and CARROSNAWEB capabilities. Only the implemented Webmotors FIPE source is enabled for structured trust. Official/dealer evidence retains the bounded-context validator and manufacturer authorization rule.

Default MONITOR inspects at most two latest listed years at/above highest known group MY. BASELINE inspects three recent years (provider option bounded to five). Cache lives for one run. Hybrid invokes one manufacturer job per unresolved model group; dealers require --allow-dealer and unresolved targets after the official attempt. Default budget is two model-stage jobs total, three built-in tool calls/job and 120 seconds/job. Budget exhaustion preserves structured findings and records skippedDueToBudget. Source errors are local audit records, never findings.

FIPE codes are optional candidates associated with MMV/MY and source, never canonical writes. Invalid code format is rejected separately while valid MY can survive. The future FIPE Search Agent owns MMV-to-code mapping and monthly value history.

## CLI

~~~powershell
pnpm agent:model-year:dry-run -- --brand VW --provider fixture
pnpm agent:model-year:dry-run -- --brand VW --provider structured --mode monitor --persist-findings
pnpm agent:model-year:dry-run -- --brand VW --provider hybrid --mode monitor --allow-dealer --persist-findings
~~~

Real structured discovery requires Supabase configuration for catalog/discovery/ACTIVE reads, and ordinary public Webmotors HTTP; it needs no OpenAI configuration. Hybrid validates OpenAI only when fallback is needed. Real commands require a separately authorized execution; none were run during implementation.

Reports under .local-reports/agents/model-year contain findings, source kinds/domains, FIPE candidates, per-target search audit, rejected candidates and cost counters. Rejections never enter agent_findings. No raw model output or full fetched HTML is logged. COMPLETED describes completed reconciliation; stage failures and budget skips remain visible.

## Database and validation limits

No Sprint 20.2 migration. Existing migration 20260915163527_sprint_20_model_year.sql is unchanged; earlier Staging application was reported by the operator. Legacy, canonical products and pricing/FIPE tables are unchanged. Historical local reports are not rewritten.

The subsequent [real Webmotors gate](SPRINT_20_2_WEBMOTORS_REAL_GATE.md) captured the Nivus root and 2027 page via the existing transport (HTTP 200). A minimal year-card title fix recovers 2027–2021 and four unique matches; minimal real-derived fixtures now supplement the synthetic fixtures. Other pages remain outside this gate. See [Sprint 20.2 implementation and validation](SPRINT_20_2_STRUCTURED_MY_FIPE_BRIDGE.md).
