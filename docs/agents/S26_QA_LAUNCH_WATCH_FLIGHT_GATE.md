# S26 — QA Launch Watch bridge / Flight Control admission

**Scope:** Supabase QA `shfsjyjxmgwnlexmdkcs`, branch `sprint-26-agent-ux-control-center`. No Production application mutations, public pricing changes or autonomous approval.

## Workflow contracts

1. Watcher ingests official/unofficial launch news. Only an **operator-validated identity** is allowed to become a canonical `catalog_mmvs` record. Watcher article presence alone is not sufficient.
2. On operator approval of a canonical **not-yet-on-sale** MMV, the QA service layer can call service-role-only `qa_enroll_mmv_launch_watch(mmv_id, operator_id, watcher_candidate_id|null)`. `watcher_candidate_id` requires status `EXPECTED_BR`; manual approvals use null. Nothing is auto-enrolled from `ACTIVE` catalog status.
3. `qa_enqueue_due_mmv_launch_checks(max=12)` selects enabled, due, operator-enrolled pending targets only, requires an active official Brand Connector and no existing queued/running job for the same launch-watch ID. It creates **MMV_DISCOVERY** jobs with provider `launch-watch-deterministic`, bypassing the paid brand-wide MMV path.
4. The QA worker reads the exact canonical MMV, selects only dedicated official model/trim sources, checks price/CTA evidence, records `LAUNCH_WATCH` run summary, and when justified stages `LAUNCH_EVIDENCE` in Reviews. No AI, no inferred MY or public MSRP, no automatic approval, no Spec or FIPE dispatch.
5. After an operator submits an `ACCEPT` review for **that** launch finding, the QA service layer must invoke `qa_sync_mmv_launch_review(watch_id)`. It marks `ON_SALE_CONFIRMED` and disables further launch checks. A `REJECT` schedules a retry, and a `DEFER` retains evidence-pending.
6. A confirmed content change from `SOURCE_MONITOR` now wakes only enabled pending launch watches via `enqueue_ai_jobs_for_source_changes`, **not** a brand-wide paid MMV research job. This is a QA-only database migration.
7. The legacy MMV discovery path is unchanged and remains available for an explicit bootstrapping campaign. Price compact continues independently as a daily-intended operation but is not scheduled/activated by this rollout.

## Pilot results, 2 November 2026 (QA)

- **MMV targeted audit:** GWM Tank 300, 1 official page, commercial evidence observed, 0 AI calls, USD 0, no canonical mutation. `agent_runs.id=01f584f6-e379-4e86-8116-913f16244447`. Audit mode created no review finding.
- **Eligibility admission:** within a rolled-back SQL transaction, explicit operator enrollment generated one target-specific `MMV_DISCOVERY` job with provider `launch-watch-deterministic`. After rollback, 0 enrolled watches and 0 temporary jobs remain.
- **Price compact QA regression:** GWM `agent_runs.id=6b36c22a-cf80-46e2-b66c-a2ade3ea1db0`. 17 sources, 13 extracted commercial offers, 7 identity matches, 1 Luna API call, estimated USD 0.001415, 0 public pricing findings; provider usage and budget reservation reconciled.
- **Permissions:** new queue/enrollment/review RPCs deny `anon` and `authenticated` EXECUTE; allowed to service_role only.

## Remaining admission gates before semi-autonomous mode

- Watcher candidates and Watcher-to-canonical operator approval flow must start populating the queue: currently **0** `watcher_candidates` and **0** enrolled launch watches in QA.
- Connect the Reviews UI's **accepted launch finding** action to `qa_sync_mmv_launch_review`, and present the launch state in Flight Control.
- On `ON_SALE_CONFIRMED`, schedule **Spec**, **FIPE→MY** only when eligible; Spec Agent and dependency wiring are not complete.
- Price Agent must eventually retain canonical-unmatched official prices and resolve MY/trim evidence before public promotion. Launch Watch never updates prices.
- Watcher News images: 62 articles but 0 persisted `watcher_article_images` records at last QA audit.
- Deduplicate outstanding MMV review findings and reconcile older unknown Brand reservations.
- Only after review throughput, accuracy, budgets and dependency gates are validated should a QA scheduler invoke the due-job function; **no unattended recurring schedule was turned on** by these changes.

These controls are deliberately fail-closed: no operator-approved eligible target => no billable MMV run.
