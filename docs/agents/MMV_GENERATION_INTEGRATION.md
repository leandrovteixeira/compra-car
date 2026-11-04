# MMV Generation Classifier — integration contract (Sprint 26 extension)

## Scope and invariants

The **MMV Discovery** now supports evidence-backed generation change proposals **after** an unambiguous canonical/legacy MMV match. This is deliberately separate from `mmv-version-change-classifier`, which detects commercial variants and powertrains, and from the MY Agent, which identifies model years.

Classification signals are Design (35%), Powertrain (35%), and Dimensions (30%), each with observed severity 0..3 or null when not established by sources. A score of zero requires positive documented continuity evidence; lack of data is never zero.

- `NEW_GENERATION`: design and dimensions both >=2. A change of propulsion alone is insufficient.
- `FACELIFT`: design >=2 without concurrent strong dimensional change.
- `MINOR_CHANGE`: other demonstrated nonzero changes (including isolated Flex update).
- `UNCHANGED`: three explicitly assessed zero scores.
- `UNKNOWN`: missing one or more source-backed assessments. This refers to *generation classification* and **does not alter the existing spec rule `UNKNOWN = NOT_AVAILABLE`**.

All transitions are `requiresReview:true`; outputs do not change MMV identity, generations, MYs, prices, specs or aliases. The Spec Agent may later use an **approved** classification to prioritize investigation of inherited specifications, without confirming individual specs by implication.

## Integration points

1. An optional `MmvGenerationAssessmentProvider` is invoked by `NewProductCheckAgent` only after product/MMV reconciliation, with `matchedCandidates` and market scope.
2. `projectMmvGenerationReviewProposals` checks that every assessment binds to **one existing MMV and the candidate's current model year**. Duplicated transitions and foreign/secondary evidence hosts are rejected.
3. `mapMmvRunToPlatform` projects assessments into `AMBIGUOUS_MMV` findings with `proposal.action = REVIEW_GENERATION_CHANGE`, source evidence rows, and `payload.reasonCode = GENERATION_CHANGE_REVIEW`. These have no direct-apply path.
4. Existing NewProductCheckAgent results and normal MMV runs remain unchanged when no assessment provider is configured.

## Manual evidence sidecar (QA investigation)

Until the Brand Connector and historical document parsers expose *structured, independently verified* generational signals, the runtime CLI accepts an explicit JSON sidecar:

```bash
pnpm --filter @compra-car/agents exec tsx run-new-product-check.ts \
  --brand GWM --provider openai \
  --generation-evidence docs/agents/my-verified-generation-assessments.json \
  --persist-findings
```

The sidecar must be an array of `MmvGenerationAssessment` objects (maximum 50). The existing MMV research run must match their `currentMmvId` and `currentModelYear` uniquely. Each source must have an HTTPS URL under the **official brand domain** already validated by Discovery. Source excerpts and model year are mandatory. The CLI does not invent missing data, assign nonzero scores from headlines, or grant direct approval.

**Template (placeholders; NOT verified H6 evidence):**

```json
[
  {
    "previousMmvId": "CANONICAL_PREDECESSOR_ID",
    "currentMmvId": "CANONICAL_MATCHED_ID",
    "previousModelYear": 2026,
    "currentModelYear": 2027,
    "signals": [
      {"dimension": "design", "severity": null, "reason": "Not assessed", "evidence": []},
      {"dimension": "powertrain", "severity": 1, "reason": "Verified powertrain change",
       "evidence": [{"sourceUrl": "https://official-brand.example/models/source.pdf", "sourceKind": "MANUFACTURER", "excerpt": "Verified excerpt", "modelYear": 2027}]},
      {"dimension": "dimensions", "severity": null, "reason": "Not assessed", "evidence": []}
    ]
  }
]
```

This yields `UNKNOWN` until dimensions and design have independently checked historical evidence. The user hypothesis that H6 PHEV19 Flex MY2027 is a minor change is promising, but **not automatically confirmed** solely from the 162/168 equal QA values; copied records are not independent proof.

## Next operational increments

- Manufacturer predecessor/current MY technical-sheet discovery, optical design comparison review, source provenance storage, and sidecar-free assessment provider.
- Operator-approved generation transition persistence and visible generation context in the Reviews and Flight Control UX.
- Once approved, feed risk-scope hints into Spec Agent inheritance planning; never turn lack of evidence into an automatic new-generation or absent-feature decision.

## Validation

The dedicated CI runs 16 MMV generation/core integration tests and 3 CLI tests plus agents typecheck. The broad Core typecheck still has unrelated historical Price Agent test errors; this CI step is currently non-blocking and that limitation must be resolved before merging.

No QA or Production database writes, application deployments, scheduled jobs or autonomous carry-over are included.
