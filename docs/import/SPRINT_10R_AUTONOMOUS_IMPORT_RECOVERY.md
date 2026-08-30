# Sprint 10R — Autonomous Commercial Letter Import Recovery

Status: **design + real-letter golden corpus started; no production promotion enabled**

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
