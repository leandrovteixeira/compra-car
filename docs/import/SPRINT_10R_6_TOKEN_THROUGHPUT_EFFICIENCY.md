# Sprint 10R.6 — Token & Throughput Efficiency

## Scope and safety

This sprint is deterministic and stops before another real provider run. It does not change timeout,
concurrency defaults, validators, canonicalizers, Golden cases, persistence schemas or commercial
semantics. No Supabase/Staging operation or migration is part of the implementation.

The efficiency path is opt-in on the segmented runtime. The active Unit Extraction prompt remains
v11. A compact v12 candidate is measurable but is not activated until a real-run authorization and
accuracy comparison exist.

## 10R.5 baseline and token forensics

The observed Jeep baseline is 25 provider calls, approximately 2,330,000 total tokens and roughly
USD 7. The completed-artifact usage visible in the failure report was only a lower bound; the larger
baseline comes from provider-side usage supplied for this sprint.

Ranked duplication sources:

1. The same uploaded PDF is referenced by every response request. Although it is uploaded once, its
   document tokens are billed/reprocessed per call. Approximately 24 repeated document-context calls
   dominate the 2.33M-token baseline.
2. The full extraction schema is repeated for every unit: 17,827 characters in the deterministic
   measurement.
3. Unit Extraction v11 is repeated for every unit: 10,775 characters for the representative table
   context.
4. Unit overlap repeats only selected governing notes, header refs and context pages. This is real
   duplication but materially smaller than the repeated PDF/schema/prompt.
5. The prompt does not contain the full Document Map or page text. It contains selected IDs/kinds.
   Source blocks therefore do not duplicate page excerpts in the prompt, but attaching the PDF makes
   unrelated document content available again to each request.

Provider-call observations contain stage, unit, pages, request ordinal, prompt version, instruction,
schema and compact-context character counts, estimated input tokens, reported usage, elapsed time and
optional retry count. Aggregation reports calls/tokens by stage and unit, repeated context and largest
requests. It never records API keys, PDF bytes or commercial excerpts.

## CommercialTableIR/1

`CommercialTableIR/1` is an in-memory, non-persisted boundary. It retains document ordinal, page,
channel, section/table IDs, headers, row product/version and raw PY/MY, keyed cells, merged spans,
option labels, visible AND/OR operators, dealer-participation position, governing note references and
source-block provenance.

The structural builder selects only the requested unit's tables, governing notes, identity hints and
source refs. Populated rows/cells are validated fail-closed against the retained provenance and row
definitions. The compact provider request can explicitly omit the source PDF only when a populated IR
is supplied; absence of an IR fails rather than falling back to unrelated/truncated context.

## Deterministic unit coalescing

Table units are combined only when consecutive and compatible by document, exact section set and
channel hints. A group remains bounded to four tables, eight primary pages, four context pages and 60
approximate rows. Notes, evidence refs and overlaps are unioned deterministically; unrelated channel
or section units remain separate. Final unit IDs and ordering do not depend on execution order.

For the conservative Jeep projection, 24 table-oriented calls become eight bounded extraction groups.
The target of four to six was not forced because crossing a commercial boundary merely to lower call
count would be unsafe.

## Prompt v12 candidate

The active prompt is still v11. The v12 candidate retains channel isolation, allowlist, provenance,
merged-cell geometry, blank/hyphen behavior, PY/MY atomicity, prices, AND/OR composition, dealer
participation, evidence hierarchy, coverage and confidence rules. Its representative footprint is
5,485 characters versus 10,775 for v11, a 49.1% reduction.

## Resumability

Successful unit results are now validated and published before the orchestrator raises a partial
failure. `SegmentedImportPartialFailure` serializes completed unit IDs, pending unit IDs, the causal
failed unit and failure code. A controlled rerun loads completed artifacts and calls only pending
units. Deterministic tests prove the completed unit is not repeated and reconciliation/semantic output
matches a clean uninterrupted run.

## Calibration budget guard

The opt-in calibration defaults are 300,000 estimated tokens, 10 provider calls and USD 1 estimated
cost. Cost enforcement requires an explicit token-price estimate. The guard reserves budget before a
request and produces `BUDGET_EXCEEDED` / `COMMERCIAL_CALIBRATION_BUDGET_EXCEEDED` without making the
request. Completed artifacts remain resumable. Production behavior is unchanged unless the efficiency
configuration is explicitly enabled.

## Deterministic efficiency benchmark

No saved complete Jeep Map/Unit Plan artifact was available because the real failure report serialized
only stage names and diagnostics. The benchmark therefore uses the observed 10R.5 provider baseline,
the actual schema/prompt character counts and a conservative four-table IR payload.

| Metric | 10R.5 baseline | 10R.6 candidate |
| --- | ---: | ---: |
| Provider calls | 25 | 10 (Map + IR + 8 extraction groups) |
| Total tokens | ~2,330,000 actual | 253,657 projected |
| Repeated context | PDF referenced 24 extra times | 40,796 estimated prompt/schema tokens |
| Max extraction payload | ~90k+ document-dominated | 6,618 estimated tokens |
| Average extraction payload | ~93k total average | 6,618 estimated tokens |
| Unit prompt | 10,775 chars (v11) | 5,485 chars (v12 candidate) |
| Compact IR | none | 3,160 chars representative |

The projection reserves 100,713 tokens for Document Map, 100,000 for one IR materialization call and
52,944 for eight compact extraction calls. Status: **PASS** (`calls <= 10`, `tokens <= 300k`). This is
an engineering projection, not a claim of real-provider accuracy or cost; a paid Jeep run remains
forbidden until separately authorized.
