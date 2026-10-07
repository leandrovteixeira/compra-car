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
