# Watcher Sprint 24B — QA migration application (2026-10-26)

## Applied to QA only

- Supabase project: `shfsjyjxmgwnlexmdkcs` (Compra Car Staging).
- Source Git branch: `sprint-24-watcher-local`, source checkpoint `22080a0e9c31953c177fe0d70e5907bfaaaefe49`.
- Source file: `supabase/migrations/20261026191808_sprint_24b4a_watcher_intelligence.sql`.
- Source file SHA-256: `41b202c9287ea7eb3654fbe499c70645a53c0111a19523bf8aaeb5156a677011` (verified against GitHub retrieval).
- Administrative Supabase migration API recorded the applied SQL as **`20261027001054_sprint_24b4a_watcher_intelligence`**. This is the actual QA migration history entry; it intentionally differs from the original file version. **Do not apply the source migration a second time to QA.**
- No production access or changes. No source RSS re-collection, model calls or commercial catalog writes.

## Postflight actually observed

- Four intelligence tables: `watcher_intelligence_receipts`, `watcher_intelligence_units`, `watcher_intelligence_candidates`, `watcher_intelligence_reviews`.
- Three new RPCs: `watcher_commit_intelligence`, `watcher_review_intelligence`, `watcher_intelligence_query`.
- All four new tables have row-level security enabled; `anon` and `authenticated` cannot SELECT; `service_role` can SELECT.
- Three RPCs are security invoker (`prosecdef=false`), executable by `service_role`, not by `anon` or `authenticated`.
- Existing Watcher articles = 20 and article revisions = 20 after migration.

## Remaining gates

- Verify column grants, indexes/FKs and audit immutability in deeper postflight.
- No actual intelligence extraction/replay has been run; runtime writer is not automatically enabled by schema application.
- Pilot requires reviewed QA executor, source scope and fencing/lease handling, budget disabled AI gate, and reconciliation of persisted receipt/results.
- Production stays untouched. Maintain explicit mapping between source version `20261026191808` and applied QA administrative version `20261027001054` in release planning; do not use automated migration repair or broad db push as a workaround.
