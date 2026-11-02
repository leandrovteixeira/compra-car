# Sprint 26 — FIPE → MY QA orchestration acceptance

Scope: QA Supabase project `shfsjyjxmgwnlexmdkcs` only. No change to Production policies or schedules.

## Operational state machine

1. Operator validates a canonical `catalog_mmvs` identity, which may be on sale or awaiting launch.
2. Commercial launch accepted (via `qa_sync_mmv_launch_review`) wakes `qa_dispatch_fipe_my(brand,mmvId,false)`; explicit bootstrap dispatcher may also be invoked for existing canonical MMVs.
3. Dispatcher examines `agent_my_launch_eligibility`. Already canonical MY or FIPE mapping/MY candidates awaiting review are blocked from paid MY. Missing mapping and no recent FIPE check can enqueue one targeted `FIPE_DISCOVERY` job.
4. FIPE Agent scopes work by job brand/MMV, caps API requests, persists evidence, FIPE model mapping candidates and valuations. Every completed FIPE job now has its own `agent_runs` record (requests/candidates/valuations, 0 OpenAI calls).
5. `qa_stage_fipe_review_findings(brand)` exposes pending FIPE mappings and FIPE-derived model years through `agent_findings` once per candidate. Both flow into the existing Review data schema with source URLs and candidate IDs.
6. Review `ACCEPT` for `FIPE_MAPPING_CANDIDATE` invokes existing `s26_decide_fipe_candidate` with dependency validation and canonical conflict checks, then stages FIPE MY candidates from the confirmed code. Review `ACCEPT` for `FIPE_MODEL_YEAR_CANDIDATE` requires the matching confirmed FIPE code, then persists `catalog_mmv_model_years`. Historical FIPE MYs enter with status `UNKNOWN`, not a claim of current MY or on-sale availability.
7. FIPE has been tried, returned no actionable FIPE candidates, and `eligibility='ELIGIBLE'`: only then may paid MY research be queued. Both job input `allowMyFallback=true` and worker environment `QA_SEMIAUTONOMOUS_MY_ENABLED=1` are required for automatic dispatch. Default: OFF.
8. Existing `PRODUCT_YEAR` agent still confirms its own eligibility before opening the AI session, and submits findings for operator decision. A legacy direct MMV → MY scheduler function now explicitly refuses to queue paid research. Human-review paths remain unchanged for normal Product Year findings.

## QA verification 02 November 2026

- Published **8** historical GWM FIPE review findings in one `FIPE_REVIEW_STAGING` run: **5 code mapping** + **3 model years**. A second staging attempt produced **0 duplicates**.
- Accepted FIPE mapping and FIPE MY2027 in **separate rolled-back SQL transactions**. The mapping procedure populated `catalog_mmv_fipe_mappings.status='CONFIRMED'`; the MY procedure populated the correct `catalog_mmv_model_years` row as `UNKNOWN`. Both transactions rolled back, so no approvals were applied to real GWM records.
- Scoped `qa_dispatch_fipe_my('GWM',Tank300MMV,false)` returned without paid MY because mapping candidates were pending. A brand-wide GWM dispatch also enqueued **0** jobs with the current review blockers.
- Targeted GWM FIPE run: `agent_jobs.id=6a5fe098-fca2-41d8-92e5-e755f456d967`, `agent_runs.id=74faafb0-5de0-44ad-96ea-035eb0984bba`, COMPLETED, **1 MMV target**, **10 API requests**, **2 candidates observed**, **6 valuations**, **0 OpenAI calls**, no duplicated review findings.
- No QA background MY schedule or automated approval has been enabled.

## Operational readiness / remaining UX integration

Backend writes are ready, but to call QA *semi-autonomous* operational:
- Confirm the frontend Review query recognizes `FIPE_DISCOVERY`, `FIPE_MAPPING_CANDIDATE`, `FIPE_MODEL_YEAR_CANDIDATE`, and `LAUNCH_EVIDENCE`. These are now in shared core enums. Review approvals must use service-role-controlled user actions, not arbitrary client SQL.
- Expose dependency states `READY` / `BLOCKED`, input provenance, and current operator decision beside FIPE findings. Some pending candidates correctly cannot be accepted until prerequisites are satisfied.
- Connect the latest approved Watcher/MMV candidate and corresponding confirmed commercial launch to this scoped dispatcher in the operator UI.
- Once approved, a single operator action can apply a FIPE code or FIPE MY while the dispatcher prevents duplicate research.
- Spec Agent and downstream facts into catalog product technical sheets are **next scope**, not implemented by this FIPE/MY slice.
- Price Agent low-cost matching runs independently; user-visible MSRP promotion remains human review and confirmed MY dependent.
- The **global/QA monthly budget**, repeated job metrics, and News image coverage must be visible in Flight Control before enabling recurring cron.

For engineering: do not conflate FIPE valuations with public manufacturer MSRP; FIPE is model identity, MY, and used-market valuation evidence only.
