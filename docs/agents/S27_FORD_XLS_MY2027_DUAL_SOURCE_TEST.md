# S27 — Ranger XLS 3.0 V6 Diesel 4WD AT MY2027: supervised dual-source test

Scope: QA only, product 1236, approved canonical MMV, read-only and review-before-apply. Flight Control is out of scope.

## Evidence

**Source A — Ford MY-specific official version page**
https://www.ford.com.br/picapes/ranger/compare-as-versoes/xls-3-0-diesel-4wd-at/

- Operator must confirm the heading says XLS 3.0 V6 Diesel 4WD AT **2027**.
- Verify powertrain 3.0 V6 diesel, 250 cv, 600 Nm, AT10.
- Inspect equipment on that version's page: 8-inch instrument panel, 10-inch multimedia, and whether any equipment is optional.
- Do not infer equipment availability from generic site-wide text or the Limited version.

**Source B — Ford technical equipment matrix (XLS/Black/XLT/Limited)**
https://www.ford.com.br/content/dam/Ford/website-assets/latam/br/nameplate/2025/nova-geracao-ranger/pdf/fbr-ranger-ficha-tecnica.pdf

- Inspect the specific XLS 3.0 4WD AT column, not the XL, XLT, Black, Limited or optional-package columns.
- Preserve original row, page, source hash, matrix cell, legend, units and measured value.
- The PDF date 9/2026 is not proof of model year 2027.
- Do not assign the 12.4-inch panel from a Limited/optional package to the XLS.
- Do not treat blank/missing cells as standard absence without reading the legend.

## Supported review outcomes

1. **CORROBORATED**: same spec/availability/value from both verified sources → review proposal, not auto-apply.
2. **PDF_ONLY**: XLS matrix observation without MY2027 HTML corroboration → review the MY applicability.
3. **HTML_ONLY**: MY2027 page statement not in XLS matrix → review the PDF coverage.
4. **CONFLICT**: differing availability/measurements → ABSTAIN, no value chosen.
5. **SOURCE_UNVERIFIED**: no explicit MY/variant heading or absent evidence SHA → ABSTAIN.

Core modules: `ford-xls-my2027-source-audit.ts` and `ford-xls-2027-source-fusion.ts`; tests included. An automated HTML live audit route is prepared in `ford-xls-2027-source-audit-job.ts`. PDF matrix cell extraction and evidence persistence for each version still require integration; neither the source audit nor fusion contract writes product specs.

## Operator QA procedure

1. Open official HTML version page and verify XLS + 3.0 V6 + diesel + 4WD + AT + 2027 in version heading. Save a visible screenshot/evidence if the page varies dynamically.
2. Open the official family PDF; inspect the XLS-specific column and equipment legend.
3. Record four items with visible citations: 3.0 V6 diesel, torque 600 Nm, cluster 8-inch, multimedia 10-inch.
4. Check a negative control: 12.4-inch Limited panel must NOT appear as XLS standard.
5. Check optional/standard distinction; if different sources disagree, classify CONFLICT.
6. Verify in QA product 1236 remains private, MY2027, with no unexpected product_specs values.
7. Run source audit and inspect run summary; a failed live fetch or missing MY heading must yield an explicit error/ABSTAIN and halt value application.
8. Accept only review items with exact source URL, hash, page/section and trim; no automatic approval.

## Acceptance

- No cross-trim leakage, no inferred MY, no accidental PBEV 2026 carryover.
- Each output is supported by an immutable original source and explicit applicability.
- Disagreements block application.
- Every canonical write requires later human approval; today's stage is review-only.

## QA execution record — 2026-11-06

- Agent worker deployment: bb842c3f-12a9-4557-975b-a45199be4742, SUCCESS, integration branch.
- Source audit job/run: e73b34fb-8ca6-401c-bb3c-ab115a14e375, COMPLETED.
- Result: VERIFIED_FOR_REVIEW / OFFICIAL_VERSION_HEADING_AND_EVIDENCE.
- Official HTML source SHA-256: 4a3da998973eb2236e977909a0c9ca8b90bcee0ba438eb708d6a1ae41452ff02.
- Checked: powertrain, power, torque, transmission. No AI calls and no catalog/product_specs mutations.
- The dual-source reconciliation pure module and tests are integrated, but **the XLS PDF matrix-cell extraction and combined review finding persistence have NOT yet executed**. Do not represent this HTML audit as completed per-spec XLS population.

## Specific human test checklist

- HTML: confirm exact MY2027 XLS variant and values 250 cv, 600 Nm, AT10. Save URL and screenshot of heading.
- PDF: select correct XLS 3.0 V6 AT column, not the broad XLS family or Limited/optional package. Check factory/optional legend carefully.
- Compare two positive examples (powertrain and 8-inch cluster) and one negative example (12.4-inch Limited panel).
- Check the 10-inch central multimedia display separately from the instrument panel.
- In QA product 1236, ensure the spec values remain blank until a reviewed product-specific proposal exists.
- If PDF does not prove MY2027, classify as PDF_ONLY pending MY-specific corroboration, not as confirmed MY2027 equipment.
