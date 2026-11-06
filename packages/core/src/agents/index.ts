export * from './new-product-check-types';
export * from './official-product-sources';
export * from './product-candidate-matcher';
export * from './new-product-check-agent';
export * from './administrative-product-catalog-reader';
export * from './new-product-check-fixture';
export * from './legacy-product-version-parser';
export * from './official-product-candidate-deduplication';

export {
  normalizeTransmissionFamily,
  normalizeEngineDisplacement,
  normalizePropulsionFamily,
  normalizePowertrainComponents,
  powertrainComparisonKey,
} from './product-component-normalization';
export { aggregateProductFindings } from './product-finding-aggregation';

export * from './jeep-product-check-fixture';
export * from './product-check-fixture-benchmark';

export * from './catalog-mmv-identity';
export {
  compatibleEngineDisplacement,
  displacementPrecision,
  drivetrainComparisonKey,
} from './product-component-normalization';

export * from './jeep-captured-mmv-fixture';

export * from './mmv-platform-mapper';
export * from './brand-connector-types';
export * from './brand-connector-validation';
export * from './brand-connector-agent';
export * from './brand-connector-fixture';
export * from './brand-connector-resolver';
export * from './mmv-discovery-contract';
export * from './fipe-mmv-lookup';
export * from './current-mmv-discovery-agent';
export * from './mmv-discovery-identity';
export * from './mmv-body-model-resolver';
export * from './mmv-version-change-classifier';
export * from './mmv-evidence-confidence';
export * from './mmv-apply-contract';

export * from './mmv-market-reconciliation';
export * from './vehicle-brand-normalization';
export * from './official-product-candidate-normalization';

export * from './model-year-contract';
export * from './model-year-agent';
export * from './model-year-apply-contract';
export * from './model-year-platform-mapper';

export * from './price-agent-types';
export * from './raw-commercial-price';
export * from './universal-price-extractor';
export * from './raw-price-matching';
export * from './source-first-price-reconciliation';
export * from './price-source-policy';
export * from './price-target-binding';
export * from './deterministic-price-research';
export * from './price-agent';
export * from './price-model-year-selection';
export * from './engineering-golden-benchmark';
export * from './engineering-failure-intelligence';
export * from './engineering-iteration-gate';
export * from './engineering-evaluation-loop';
export * from './engineering-patch-manifest';
export * from './engineering-brand-replay';
export * from './engineering-brand-accepted-replay';
export * from './engineering-cost-governance-audit';
export * from './engineering-cost-policy';

export * from './watcher-foundation';
export * from './watcher-ingestion-contract';
export * from './watcher-incremental';
export * from './watcher-persistence';
export * from './watcher-intelligence';
export * from './watcher-candidate-discovery';
export * from './watcher-intelligence-ai-gate';
export * from './watcher-intelligence-persistence';

export * from './spec-agent-reconciliation';
export * from './spec-agent-baic-matrix';
export * from './spec-agent-baic-import';
export * from './spec-agent-review-projection';
export * from './spec-agent-events';
export * from './spec-agent-write-plan';
export * from './spec-agent-pilot';
export * from './spec-agent-persistence-plan';
export * from './spec-agent-db-projection';
export * from './spec-agent-catalog-suggestions';
export * from './spec-agent-atomic-commit';
export * from './spec-agent-gwm-technical';
export * from './spec-agent-gwm-equipment';
export * from './spec-agent-ai-review';
export * from './mmv-generation-change-classifier';
export * from './mmv-generation-review';
export * from './mmv-generation-evidence';
export * from './generation-evidence-collector';
export * from './spec-agent-supervised-candidates';
export * from './spec-claim-value-separation';
export * from './spec-vocabulary-hints';
export * from './pbev-source-observations';
export * from './ford-xls-my2027-source-audit';
export * from './ford-xls-2027-source-fusion';
export * from './ford-ranger-xls-matrix';

export * from './ford-xls-my2027-html-evidence';

export * from './ford-xls-source-quality-gate';

export * from './spec-review-value-commit';
