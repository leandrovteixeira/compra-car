# Sprint 10R — Autonomous Commercial Letter Import Recovery

Status: **design + real-letter golden corpus started; no production promotion enabled**

## Sprint 10R.1 — executable Gate A benchmark

The existing corpus is now executable directly against `CommercialDocumentExtraction/1`; no parallel
dataset or domain-shaped expected output was introduced. Matching is deterministic and one-to-one
across document, page, channel, model/version/PY/MY, fact type, normalized value and unit. Evidence
must resolve to connected source blocks on the expected page, and offer composition must preserve the
exact members, scopes and `AND`/`OR` relationship.

The report contains JSON and a human-readable summary. It distinguishes missing, wrong and unexpected
facts and calculates critical-fact recall, overall recall, precision, composition accuracy and
provenance accuracy. `PASS` is strict: critical recall, precision, composition and provenance must all
equal 100%. The Jeep page 6 corpus was completed with the audited BRL 9,000 Pack Tech Trade-In total;
the same corpus remains the source of truth for Jeep, Geely, GWM and BYD.

Unit Extraction prompt version 9 adds only documentary safeguards: establish section/channel before
interpreting facts, keep public/reference and promotional/customer prices distinct, preserve `de X por
Y`, retain AND/OR composition, require evidence and prefer explicit ambiguity over inference. Domain
mapping was not changed.

The local Jeep harness is opt-in and read-only with respect to application infrastructure. It reads the
real PDF from an explicit local path, keeps artifacts in memory, ignores Supabase configuration and
requests a documentary stop after semantic reconciliation. Even on success it cannot reach Domain
Mapping, Product Matching, staging or publication.

### Single real Jeep diagnostic — 2026-08-30

- provider/model: OpenAI / `gpt-5.6-terra`;
- elapsed time: approximately 87 seconds;
- Document Map: completed and published to the in-memory artifact store;
- Unit Plan: failed with `COMMERCIAL_EXTRACTION_UNIT_CONTEXT_LIMIT_EXCEEDED`;
- Unit Extraction, Merge and Semantic Reconciliation: not started;
- Domain Mapping, Product Matching and persistence: not started;
- benchmark score and fact mismatches: unavailable because Gate A input was never produced;
- token usage: unavailable from the failed run's original reporting path;
- cost: unavailable;
- retries/tuning loops: none.

This is a category A boundary failure at Document Map → Unit Plan, not evidence that Unit Extraction
misclassified Jeep facts. The diagnostic harness now captures partial stage/usage information for
future failures, but the real call was deliberately not repeated. The recommended next step is to
inspect the map's page fan-out and context overlaps, propose the smallest planner/map correction, and
perform one new real run only with explicit authorization.

## Sprint 10R.2 — Jeep Unit Plan fan-out diagnosis

Because the 10R.1 map was not persisted, one new Document Map-only call was made and saved locally.
It completed in 102,504 ms with 90,083 input units, 12,787 output units and 102,870 total units. The
safe planner diagnostic identified the first over-limit candidate:

- unit: `TABLE`, document ordinal 1;
- primary page: 10;
- context pages: 4, 5, 11, 12, 13, 14 and 27;
- page 4: eligibility note sharing the retail-channel and family sections;
- page 5: eligibility note sharing the retail-channel and family sections;
- page 11: eligibility note bound to another table in the same broad channel section;
- page 12: exception note bound to another table in that section;
- page 13: eligibility note bound to another table in that section;
- page 14: eligibility note bound to another table in that section;
- page 27: the single-source-page `DOCUMENT_WIDE` rule.

The root cause was not a multi-page global rule. Direct-note selection treated any shared section as
applicability, even when a table binding or a second section made the note narrower. The fix gives
table scope precedence and requires the complete declared section scope for unbound notes. Governing
edges remain directional and apply the same scope check. A multi-page document rule is represented by
its `noteId` plus real source blocks from its canonical `note.pageId` (or the earliest valid source
page); all original sourceBlockIds remain in the Document Map as provenance.

No context is silently truncated and the limit remains four. Shared notes and inherited headers remain
reachable, while a synthetic unit with five genuinely required shared-context pages still fails with
the structured limit diagnostic. Against the saved real map, planning now succeeds with 37 units. The
page 10 TABLE keeps page 27 as its only context page; the unrelated pages 4, 5 and 11–14 are removed
through explicit structural scope, not ordering or truncation.

### Second real Jeep attempt

Exactly one new full attempt was made. It stopped after 58,955 ms at a new first blocker: the provider's
Document Map response contained an unknown block reference at
`/documents/0/issuerHints/0/sourceBlockIds/0`, and ID canonicalization rejected it. The failure is
classified as Document Map/canonicalization. No artifact was published, so Unit Plan, Unit Extraction,
Merge, Semantic Reconciliation and the golden benchmark did not run. Usage/cost for this failed call
was not exposed by the pre-publication failure path. There was no retry, prompt/provider tuning,
staging, Supabase, Domain Mapping or commercial write.

## Sprint 10R.4 — Atomic vehicle year extraction

Unit Extraction now exposes an opt-in, read-only year diagnostic at raw structured output,
reconstructed, immediately pre-canonical and canonical-validation boundaries. The observation is
bounded to unit pages/table/section IDs, brand/model/version, year-field presence and values,
`rawYearText`, evidence pages and confidence flags. It does not retain full PDF content or secrets and
does not mutate or repair the artifact.

The pre-fix v9 capture proved provider origin. Its page-10 `table-0004` unit emitted four Renegade rows
(Altitude T270, Longitude T270 MHEV, Sahara T270 MHEV and Willys T270 4X4) with documentary
`MY26/27`, absent productionYear and modelYear 2027. Raw, reconstructed and pre-canonical observations
were identical; canonical validation then rejected four `incompleteYearPair` violations. Thus neither
transport reconstruction nor canonicalization removed the production year. The earlier six-row 10R.3
response was not retained, and stochastic map/unit numbering means its exact identities and page cannot
be recovered safely.

The Unit Extraction instruction is version 10. Production/model year is an atomic pair: explicit
`26/27` maps to 2026/2027, `26/26` maps to 2026/2026, and an isolated `MY27` or `PY26` preserves only
`rawYearText` with review. An explicit table/section header may govern rows, with provenance, but the
missing side must never be inferred from automotive convention. The canonicalizer and validator are
unchanged and remain fail-closed.

### Post-fix real attempt

Exactly one post-fix Jeep attempt was executed. Document Map and canonicalization passed, Unit Plan
passed, and 17 table units completed canonical validation. Across those units there were zero partial
year pairs: unambiguous `26/27`/`MY26/27` became 2026/2027, while one-sided `MY26` remained only in
`rawYearText` with `requiresReview=true`. The first new blocker was
`UNIT_EXTRACTION_ORCHESTRATION_TIMEOUT`; Merge, Semantic Reconciliation and the intermediate artifact
were not reached, so the Jeep golden benchmark did not run.

The attempt took 570,448 ms. Completed pre-extraction artifacts reported 90,156 input units, 11,245
output units and 101,401 total units. Failed/in-flight Unit Extraction usage was not published, so these
numbers are a lower bound; cost is unavailable. There was no retry, timeout increase, Domain Mapping,
matching, staging, Supabase or commercial write.

The checkpoint environment runs Node `v24.18.0` while the monorepo declares Node `22.x`; pnpm emits a
known `Unsupported engine` warning. This is a local runtime-version warning, not a validated functional
failure.

## Sprint 10R.3 — Document Map metadata referential closure

The four metadata collections are now audited at raw structured output, reconstructed,
pre-canonicalization and canonicalized boundaries. The safe observation records only definition
counts, document/hint indexes, paths, truncated SHA-256 ID fingerprints and whether each referenced
content-block definition exists. It does not retain raw IDs, metadata values, excerpts or document
content, and it never mutates the provider artifact.

The failed 10R.2 raw response was not retained, so its exact orphan fingerprint cannot be recovered.
However, deterministic inspection and regression tests establish that transport reconstruction keeps
both metadata sourceBlockIds and contentBlock definitions unchanged. A synthetic orphan has the same
fingerprint and remains absent at raw, reconstructed and pre-canonical states before the canonicalizer
rejects it. Therefore the historical orphan originated in the provider response; projection,
reconstruction and canonicalization did not drop its definition.

The Document Map instruction is version 5. It adds one bounded referential-closure self-check covering
metadata source blocks and every page, section, table, note, entity-hint and context-edge reference.
IDs remain model-local until server canonicalization. The canonicalizer was not changed into a repairer:
unknown references still fail, no hint or ID is filtered, no first-page block is substituted, and no
placeholder definition is fabricated.

### Real diagnostics and next blocker

The single Map-only diagnostic sample passed all four boundaries with zero metadata orphans. Each of
the four collections had one valid reference; raw/reconstructed/pre-canonical states contained 66
content blocks and stable fingerprints. It took 83,659 ms and used 90,083 input units, 13,000 output
units and 103,083 total units.

Exactly one full post-fix attempt was then executed. Its Document Map had 36 content blocks and zero
metadata orphans at all four states. Document Map canonicalization passed and Unit Plan completed.
Unit Extraction stopped at `unit-0002-table`: canonical validation reported six `incompleteYearPair`
violations, one for each emitted vehicle identity. Merge, Semantic Reconciliation and the golden
benchmark did not run.

The full attempt took 119,533 ms. Completed artifacts reported 90,156 input units, 11,738 output units
and 101,894 total units; this is a lower bound because the failed Unit Extraction request was not
published and its usage is unavailable. Cost is unavailable. There was no retry, Unit Extraction
tuning, Domain Mapping, matching, staging, Supabase or commercial write. The next task should diagnose
the incomplete production/model-year pairs without changing the metadata closure boundary.

## Goal

Resume the existing Sprint 10 segmented architecture instead of replacing it. The target is autonomous interpretation of heterogeneous commercial letters while making silent semantic corruption impossible.

The acceptance corpus is four real letters: BYD Jun/2026, Geely Feb/2026, GWM Mar/2026 and Jeep Jun/2026. The executable documentary expectations live in `packages/core/test/fixtures/commercial-letter-golden-dataset.ts`.

## Audit result

Keep the existing upload, private Storage, batch/document lifecycle, jobs, immutable provenance, canonical IDs, validators, reconciliation, matching and draft-only persistence.

Keep `CommercialDocumentExtraction/1`: it already separates documentary facts from final domain mapping and already supports CHANNEL scope, alternatives/cumulative composition, restrictions, eligibility and provenance.

Do not return to a one-shot prompt. Do not create a second Evidence Ledger or parallel Import Engine.

The recovery must prove each boundary independently:

```text
PDF
  -> Document Map
  -> Unit Plan
  -> Unit Extraction
  -> Merge / Semantic Reconciliation
  -> CommercialDocumentExtraction/1     [GATE A]
  -> Domain Mapping                     [GATE B]
  -> Product Matching                   [GATE C]
  -> pricing_import_rows as REVIEW      [GATE D]
  -> explicit human approval only       [existing publication gates]
```

## Gate A — documentary truth

Before domain mapping, the intermediate artifact must satisfy the golden corpus.

Hard requirements:

- critical fact precision = 100%;
- critical fact recall = 100% for the initial four-letter corpus;
- every critical fact has document, page and evidence;
- channel is preserved when documentary context distinguishes it;
- public/reference price and promotional/customer price are different facts;
- `de X por Y` must preserve both X and Y;
- AND/OR must survive as composition, never be flattened;
- unknown or ambiguous meaning must remain review-required, never guessed.

A failure at Gate A must stop before domain mapping.

## Gate B — domain representability

Domain mapping is deterministic. It must never reinterpret the PDF.

Known gaps discovered by the real-letter audit:

1. `promotional_price` is currently classified as `UNSUPPORTED_PROMOTIONAL_PRICE`.
2. percentage `discount` currently maps toward invoice discount, but the mapper requires a monetary value for invoice/retail/trade-in fixed policies; a source percentage therefore cannot safely publish as-is.
3. channel/eligibility can be preserved as restrictions, but the final pricing domain does not yet have a first-class commercial channel/segment/region model.
4. grace period is currently unsupported as a financing parameter in final mapping.
5. financing publication still requires deterministic calculation against an approved financial parameter set.

Therefore Gate B must distinguish:

- **representable**: can become current canonical Policy/Offer without semantic loss;
- **reviewable-unmapped**: documentary fact is correct but current domain cannot express it;
- **blocked**: contradictory or incomplete documentary semantics.

`reviewable-unmapped` is success for extraction and must not be counted as AI failure.

## The Jeep Compass invariant

Page 6 is the primary semantic regression case.

Required interpretation:

- channel: VD-CPF / category 36;
- reference/public price: BRL 174,990;
- customer/promotional price: BRL 147,990;
- discount: up to 15.5%;
- trade-in: BRL 3,000;
- Pack Tech trade-in total: BRL 9,000;
- financing: 0% / 60% down / 24 months;
- normal Trade-In and financing are alternatives, not cumulative.

Any pipeline that emits 174,990 as the VD customer price fails Gate A even if all JSON schemas validate.

## Cross-brand stress roles

- **Jeep**: channel boundaries, `de/por`, direct-sales segments, alternatives.
- **GWM**: nested AND/OR combinations, model-year columns, shared benefits.
- **Geely**: option groups, shared benefits, financing variants and grace period.
- **BYD**: dense summary tables, retail versus direct-sales separation, many models and channel-specific prices.

## Prompt contract

The provider must be instructed to extract documentary facts, not final Policies/Offers.

Priority rules:

1. map section/channel before interpreting values;
2. preserve source labels and evidence;
3. classify each monetary value by documentary role;
4. never collapse multiple prices;
5. never infer channel from product or brand knowledge;
6. preserve alternatives/cumulative relations;
7. prefer ambiguity/review over semantic guessing;
8. do not use external knowledge to complete the letter;
9. never manufacture database/domain authority.

## Autonomous does not mean auto-publish

The desired autonomous path is:

`upload -> extract -> reconcile -> map -> match -> create review rows`

Publication remains explicitly gated by the existing pricing lifecycle. Autonomous import is successful when the system can prepare correct, auditable draft/review rows without manual transcription.

## Minimal implementation sequence

1. Turn the golden corpus into a benchmark against `CommercialDocumentExtraction/1`.
2. Run the segmented pipeline only through Gate A for the four real PDFs.
3. Fix extraction/prompt/planning only when a golden fact is missing or wrong.
4. Once Gate A is green, evaluate Domain Mapping against the same facts.
5. Add only the smallest domain evolution required by facts that are repeatedly correct but currently unmappable.
6. Re-run all four letters after every domain change.
7. Only then reconnect persistence/promotion gates.

## Non-goals

- no new upload infrastructure;
- no duplicate evidence database;
- no second job system;
- no direct PDF-to-database shortcut;
- no hardcoded manufacturer parser;
- no automatic publication;
- no relaxing canonical validators merely to make a provider response pass.

## Definition of done

Sprint 10R is not done because the provider returned valid JSON. It is done when all four letters pass the golden documentary benchmark, domain mapping produces either correct canonical output or explicit unmapped/review issues, and no commercial fact is silently changed, dropped or assigned to the wrong channel/offer.
