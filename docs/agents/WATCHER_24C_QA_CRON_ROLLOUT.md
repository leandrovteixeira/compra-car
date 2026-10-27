# Sprint 24C — QA Watcher recurring ingestion rollout gate (2026-10-27)

## Observed state
- The only RSS feed proven ingested in QA is Motor1 Brasil: `https://motor1.uol.com.br/rss/news/all/`, source `motor1-br-pilot`, baseline 20 items.
- The existing `watcher:qa:pilot` runner is **one-shot**: `assertFirstBatch` rejects source with existing batches and `attempt.json` is exclusively locked. It is not suitable as a cron target.
- Railway project `Compra Car QA` (`ebeddc5e-bb68-4fce-96b3-a43bb9e4d387`), environment ID `5a264f14-4d5b-465d-a327-32607dcb698e` (Railway labels it 'production', but it is the separate QA project). Existing `agent-worker` uses branch `sprint-22-5-qa-integrated`; its `cronSchedule` is null. Do not reassign worker branch or cron and disrupt other agents.
- InsideEVs Brasil publicly lists RSS feeds at `https://insideevs.uol.com.br/rss/`; validate exact news/category endpoint through preflight before registering.
- Quatro Rodas and Autoesporte are candidates for source evaluation, NOT approved ingestion registrations.

## Prerequisites before enabling a periodic QA worker
1. Implement **incremental**, not first-batch-only, ingestion: read existing source checkpoint, history and current observation; use leases, ETag/Last-Modified and bounded paging; dedupe against stored revision fingerprints; persist in QA only through existing watcher RPCs; release lease on failures.
2. Add tests: empty feed, 304, repeated observation/revision, changed article, stale lease, partial parse, pagination beyond bounds, retry idempotence, overlapping cron runs and fail-closed QA target.
3. Verify RSS host allowlists, exact per-source feed URL and source registration. Begin with Motor1 only; activate additional feeds individually after feed/parser QA validation.
4. Deploy isolated Watcher QA worker, separate from `agent-worker`, targeting QA project and pinned branch/commit. Suggested initial cron: hourly for RSS **collection only**; no paid API, no catalog writes or automatic approval. Verify one run and next repeat using QA readback.
5. Add optional bounded LLM extraction in a separate queue after ingestion, once idempotent per revision and API budget policy are reviewed. All model/launch predictions remain proposed until validation. 
6. Keep images separate: current SAX parser discards image/media attributes; no article photos are persisted.
7. Do not touch the production project or upload staging data to production.

## Current stop condition
**No cron has been activated.** The current one-shot job would fail on the second attempt, and the live QA `agent-worker` serves a different branch and has no cron. Preserve the two active QA services while building and testing an incremental runner.
