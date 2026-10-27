# Watcher QA scheduler → central agent queue: integration gate

2026-10-27. **Do not turn on `WATCHER_SCHEDULER_ENQUEUE_ENABLED` yet.**

## Verified live QA state
- Railway QA project: `ebeddc5e-bb68-4fce-96b3-a43bb9e4d387`.
- Scheduler: `watcher-scheduler`, ID `2435a693-9892-44aa-8ee6-c162514a82a4`, schedule `0 11,23 * * *` UTC, enqueuing disabled. Current CLI deliberately fails closed when enabled.
- Existing `agent-worker`: service `0090397d-6b8b-464b-bf7b-9dff89967526`, source `sprint-22-5-qa-integrated`, start command `tsx agent-job-worker.ts`.
- QA Supabase: `shfsjyjxmgwnlexmdkcs`. Production is prohibited.
- `public.agent_jobs_job_type_check` **rejects `WATCHER_INGESTION`**. Allowed types: MMV_DISCOVERY, BRAND_CONNECTOR, SOURCE_MONITOR, PRODUCT_YEAR, PRICE_INTELLIGENCE.
- `claim_next_agent_job()` claims **any** QUEUED job and marks RUNNING; it has no capability matching. Current worker routes unknown jobs to FAILED.
- Manual 24A Watcher pilot is single-use (assertFirstBatch, attempt.json) and therefore unsuitable for cron.
- Current 24C saved AI pilots are local files and cannot be the runtime persistence used by a stateless Railway cron.

## Required minimal safe rollout
1. Create a repeatable, checkpoint-aware Watcher ingestion handler. Validate two sequential runs on existing Motor1 BR QA state, with 2nd run avoiding duplicate revision/AI requests.
2. Add durable, per-revision AI extraction journal, budget reservation, and launch evidence history. Do not rely on files on Railway.
3. Deploy a backward-compatible worker handler for WATCHER_INGESTION. If old worker is running simultaneously, ensure it cannot claim jobs it cannot handle. Prefer deploying job-type-aware claims atomically, or temporarily quiescing the old worker with verified no jobs in RUNNING state, before creating a new job type.
4. Update `agent_jobs_job_type_check` and enqueue RPC through reviewed QA-only migration; enforce at-most-one pending/running job per source+time window and least-privilege grants.
5. Add a QA-only scheduler command that uses idempotent enqueue RPC and logs a structured receipt. No keys or sensitive payloads in logs.
6. Deploy and exercise one manual schedule tick; read back 1 queued/claimed/completed job, source item count and incremental checkpoints. Exercise a second tick with zero duplication. Confirm no downstream canonical writes.
7. Only then set `WATCHER_SCHEDULER_ENQUEUE_ENABLED=true` in QA. Cron already set for 08:00 and 20:00 America/Sao_Paulo (11:00, 23:00 UTC).
8. Watch cost and failure counters; keep source discovery agent for Sprint 26.

## Invariants
- No changes to production project/database.
- Do not switch existing worker to Sprint 24 branch before compatible migrations and jobs are verified.
- Do not let unknown job types enter a queue consumed by old worker.
- Do not treat `cron deployed` as `Watcher ingestion operational`.
