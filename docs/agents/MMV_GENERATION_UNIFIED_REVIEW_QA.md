# QA acceptance — unified Reviews, Generation Classifier and existing agents

Scope: Sprint 26 branch `sprint-26-mmv-generation-classifier`, PR #23. Do NOT run on Production until branch reconciled with QA UX and deployed deliberately. Tests must use QA only.

## Architecture: one inbox, not agent-specific UX

The existing `/admin/agents` review table and row drawer are reused. Every reviewable result has:

- Source agent, finding ID/run ID, business-key, model/version, description and fingerprint.
- Source links/excerpts plus raw technical payload.
- Review status: WAITING, APPROVED, REJECTED, POSTPONED.
- Operator actions from shared review contract: APPROVE / REJECT / POSTPONE. MERGE appears only where a canonical target exists.
- Individual review decisions in the same `agent_reviews` history; no separate generation review tables or new pages.

Generation uses a back-end case kind `MMV_GENERATION` to prevent accidental `CREATE_MMV` side effect, but it appears through the **existing MMV Discovery filter and drawer**, without a new UX format. Its finding is `AMBIGUOUS_MMV` plus `payload.reasonCode=GENERATION_CHANGE_REVIEW` and `proposal.action=REVIEW_GENERATION_CHANGE`. Approval records classification, not vehicle/spec mutation.

`MMV_GENERATION`: APPROVE -> decision only (effect NONE); REJECT -> decision only; POSTPONE -> decision only. MERGE invalid. `UNKNOWN` classification cannot be approved.

**Important limitation:** decision persistence currently uses the legacy `agent_reviews` history. It is an approved finding snapshot, NOT a new canonical generation-record table nor a Flight Control event stream. Agent apply/bypass remains blocked until a safe, fingerprint-aware approved-generation consumer is integrated with the Spec Agent.

## Operator tests after QA deployment

1. Open **Revisões**, filter **MMV Discovery**. Confirm the generation finding is a regular table row, not a new page, modal or different table.
2. Open its existing drawer. Verify source URLs, source excerpts, score breakdown design 35% / powertrain 35% / dimensions 30%, classification, MY previous/current, and recommended carry-over.
3. For an `UNKNOWN` test finding (one missing source-backed dimension), **Aprovar must be disabled**, Rejeitar and Adiar remain accessible. Do not invent zero scores.
4. For a fully evidenced `MINOR_CHANGE` test finding, approve it; the row transitions from Aguardando to Aprovado, history shows ACCEPT. Reload; decision stays visible. Verify no new MMV or specs were created.
5. Test Rejeitar and Adiar on separate QA-only findings. Rejeitar -> Rejeitado; Adiar -> Adiado, and an Adiado finding can later be reviewed.
6. Tamper/replay case: old fingerprint or already accepted finding cannot be approved again (stale/duplicate rejected by server). No successful action should occur before the backend confirms.
7. Run a normal MMV discovery without a `--generation-evidence` sidecar; it must produce the same findings as before, without generation findings.
8. Verify the **existing** review flows for Brand Connector, MMV new model/version, FIPE and Model Year still use the same filters and drawer; approvals that are designed to apply canonically still work.

## Real H6 smoke, when source adapter is ready

- Haval H6 PHEV19 MY2026 → MY2027 Flex, official GWM PDFs.
- Strongly hypothesized MINOR_CHANGE only if source-backed design and dimension assessments confirm continuity. Gasoline -> Flex alone never establishes new generation.
- Powertrain/homologation must be revalidated. Compare 44 missing-from-2027-PDF specs without marking all as confirmed.
- Do not treat the 162/168 identical QA records as independent proof of physical carry-over.
- Maintain `UNKNOWN = NOT_AVAILABLE` for specs unchanged.

## Preconditions before QA deployment

- CI for MMV generation core, review projection, agent CLI and web typecheck passes (except historical Price Agent core-test errors, tracked separately).
- Reconcile branch with latest QA UX work, including sprint 23/26 conflicts, before deployment.
- Prepare operator-test findings in QA with explicit source evidence; do not fabricate manufacturer observations.
- Confirm no Production writes and no background job/cron activation.

## Flight Control later

Flight Control will consume existing agent_runs, agent_findings, agent_reviews and decision history. It must not introduce a second operator-review workflow. Future components: dependency edges, retries, run cost telemetry, backlog, source coverage and SLA.
