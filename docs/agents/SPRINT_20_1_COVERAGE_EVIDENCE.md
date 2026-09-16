# Sprint 20.1 — historical validation

## Fechamento final — Sprint 20 / 20.1 / 20.2 / 20.2.1

**SPRINT 20 — MODEL YEAR AGENT: COMPLETE / REAL STRUCTURED END-TO-END VALIDATED.**

[Estado final, smoke real, validações e exclusões](SPRINT_20_CHECKPOINT.md). Smoke real COMPLETED, run `97ebfdad-4882-45fd-ae78-638cfa440ba7`, conforme evidência fornecida pelo operador: oito MMVs com MY, oito MODEL_YEAR_MATCHED, quatro NEW_MODEL_YEAR e zero OpenAI. Seções locais/sem commit abaixo são históricas; Spec Intelligence (21) é o próximo passo.

Superseded by [Sprint 20.2](SPRINT_20_2_STRUCTURED_MY_FIPE_BRIDGE.md). The active strategy is structured-first, model-grouped, with manufacturer and explicitly enabled authorized-dealer fallback. Broad publication research was removed after the operator reported 3/8 coverage, 24 stages, 47 rejected observations and about 25 minutes for run 6457c5fe-b6eb-441e-bb83-f02a436805bd.

Retained from 20.1: bounded contiguous evidence contexts, explicit MY semantics, dealer authorization binding, deterministic rejection codes and local JSON/Markdown audit. The two finding types and review-only contract remain unchanged. Historical reports were not rewritten.

Historical gates: 536 directed tests passed; lint/build and relevant typechecks passed. Global typecheck had five TS2554 errors in admin-product-public-prices.test.ts. Global core suite had 1,071 passing tests and two 5-second commercial-domain-mapping timeouts; all 18 tests of that suite passed isolated. Global formatting reported 576 files. These are baseline results, not Sprint 20.2 totals.

Golden contexts in 20.1 were reconstructed from supplied facts, not live captures. Discarded rejection detail from Sprint 20 run 408ee6fd-3049-40f9-bb36-e86cfff01884 cannot be retroactively recovered.
