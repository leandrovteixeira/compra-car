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
