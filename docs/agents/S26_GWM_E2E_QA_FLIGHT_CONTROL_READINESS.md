# Sprint 26 — GWM end-to-end QA and Flight Control readiness

Run date: 2026-11-02. **QA ONLY** (Supabase `shfsjyjxmgwnlexmdkcs`). Do not treat Railway's environment name as Production app scope. No connector activation, MMV/MY approval, public MSRP mutation or production deployment.

## Source-to-price execution lineage

| Phase | Run/job | Output | AI usage |
| --- | --- | --- | --- |
| Brand product-page expansion | run `40fddb2f-de46-4e43-9395-23c91554c4f9` | 17/17 official product pages HTTP-verified, 20 inventory URLs, review-only CONNECTOR_DRIFT | 0 new calls; reuses paid Brand research `f1504949-85c8-461b-a4f8-9716ef76742b` |
| Brand original paid research | run `f1504949-85c8-461b-a4f8-9716ef76742b` | 35,075 input, 1,869 output, 4 web searches | US$0.049258 estimated, **historic cost; do not add to incremental November 2 spend** |
| MMV shadow discovery | run `e1675e15-c24a-4486-b512-c521979a2fce` | 17 researched, 13 variants resolved, 15 findings (2 matched, 2 NEW_MODEL, 6 NEW_VERSION, 5 ambiguous) | 4 calls; 103,610 input, 9,949 output, 12 web searches, US$0.491530 estimated |
| FIPE lookup | job `d349ac09-7100-48c0-863c-664568e783d8` | 10 FIPE requests, 8 mapping candidate observations, 6 valuations; no canonical promotion | zero OpenAI calls; FIPE transport/API cost not priced |
| MY eligibility | job `b6bbd963-55e7-4bfe-bccb-00ade8e1b4ec` | completed without research: 2 FIPE_MAPPING_PENDING, 1 FIPE_MY_PENDING | zero OpenAI calls |
| Price compact shadow audit | run `2a3032e3-3ce5-4867-8334-8fc799e5fda7` | 17 URLs fetched; 13 raw prices; 7 commercial identities matched; 6 unresolved; no verified MY; 0 price findings | 1 Luna; 1,483 input, 963 output, zero web searches, US$0.001452 estimated |

**Incremental OpenAI API estimate for this QA chain:** US$0.492982 (MMV + Price; Brand is replayed without new AI). **If considering the historical Brand research as the cost to bootstrap this brand:** US$0.542240. These are configured-pricing estimates from provider usage, not invoice totals. Reservations for MMV/Price were reconciled to their usage receipts. The older failed Brand reservation remains UNKNOWN and must not be reset without evidence.

## Coverage semantics

- **17 official model product URLs verified** is a live page-discovery claim, not 17 current MSRP/MMVY matches.
- Five other candidate routes failed/redirected; they are not counted as verified commercial pages.
- Price's 13 extracted prices are from fetched targets and may include multiple trims for one canonical model; it is not full price coverage of uncatalogued H7, POER or other new models.
- All seven compact AI matches are **identity-only** (`IDENTITY_MATCHED_MY_UNVERIFIED`); no AI-inferred MY or MSRP is approved.
- MMV review findings may duplicate previous proposals; deduplicate before auto-enqueueing downstream stages.
- FIPE candidates do not count as accepted FIPE mappings. MY remains blocked until explicit canonical mapping / eligibility.

## Flight Control — first read-only QA dashboard

Show per brand and stage: **last run/status**, elapsed time, queue, dependency blocker, catalog coverage vs official source inventory, source failures, review backlog, model/tokens/web searches, actual provider-estimated USD, reservation status, and variance from prior 7 runs. Show separate red flags for unknown reservations and failed builds.

Data sources: `agent_runs`, `agent_jobs`, `agent_findings`, `agent_reviews`, `agent_ai_usage_events`, `agent_spend_budgets`, `agent_spend_reservations`, `agent_my_launch_eligibility`, `brand_connectors`, `watcher_schedule_jobs`, `watcher_articles`, `watcher_article_images`.

Never confuse:
- raw source URL count with HTTP-verified official product pages,
- labels containing price terms with a usable vehicle MSRP,
- commercial identity with confirmed MY,
- a booked budget reserve with actual billed API spend,
- `COMPLETED` with quality/coverage PASS.

## Semi-autonomous QA rollout gates

1. **Brand:** verify current official index, retain 17+ applicable product URLs with no landing/media/cart entries; warnings for inaccessible candidates.
2. **MMV:** review/merge duplicate H7 / versions; ensure approvals don't create ambiguous canonical identities. AI may discover candidates; it may never silently approve them.
3. **FIPE/MY:** implement and validate FIPE mapping reconciliation, then run MY only for eligible MMVs. Do not force MY when FIPE is pending.
4. **Price:** source-first collect official pages including unregistered models, preserve orphan price observations, validate current MSRP vs promotional amounts, and require MY evidence before publishing.
5. **News:** Watcher schedule jobs are completing and 62 articles were present in QA as of audit; `watcher_article_images` has **zero records**, blocking full news-image UX readiness.
6. **Flight Control:** read-only QA dashboard first; then eligible auto-queue/cron with per-agent financial caps, run dedup, dependency engine and manual approval for canonical mutations.
7. **Spec:** proceed with a QA-only agent against approved MMVYs once the review and source lineage gates are observable; no production promotion until pilot accuracy and revision workflows are measured.

This file is a QA acceptance baseline, **not** permission to schedule jobs autonomously or deploy to Production.
