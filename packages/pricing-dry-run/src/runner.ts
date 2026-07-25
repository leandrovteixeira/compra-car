import { canonicalJson, logicalHash } from './canonical.js';
import {
  classifyAccumulatorSuggestions,
  classifyPolicies,
  classifyPublicPrices,
} from './classification.js';
import { decimal } from './money.js';
import { reconcileOffers } from './reconciliation.js';
import type {
  BaselineDifference,
  CanonicalRow,
  DryRunOptions,
  DryRunResult,
  IssueCode,
  SourceInventoryRow,
  SourceSnapshot,
  ViewCoverageRow,
} from './types.js';

const REFERENCE_BASELINE: Record<string, number> = {
  products: 292,
  productPriceOffers: 746,
  distinctOfferProducts: 287,
  positivePublicPrices: 745,
  zeroPublicPrices: 1,
  offerMonths: 11,
  priceOfferImports: 10,
  priceOfferImportRows: 173,
  priceOffersStaging: 746,
};

function stableRows(rows: unknown[]): unknown[] {
  return [...rows].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function dateRange(values: Array<string | null>): [string | null, string | null] {
  const dates = values.filter((value): value is string => value !== null).sort();
  return [dates[0] ?? null, dates.at(-1) ?? null];
}

function inventory(snapshot: SourceSnapshot): SourceInventoryRow[] {
  const sourceRows: Array<{
    sourceTable: string;
    rows: unknown[];
    products: string[];
    dates: Array<string | null>;
  }> = [
    {
      sourceTable: 'public.product_price_offers',
      rows: snapshot.offers,
      products: snapshot.offers.map((row) => row.productId),
      dates: snapshot.offers.map((row) => row.offerMonth),
    },
    {
      sourceTable: 'public.price_offer_imports',
      rows: snapshot.imports,
      products: [],
      dates: snapshot.imports.flatMap((row) => [row.validFrom, row.validTo]),
    },
    {
      sourceTable: 'public.price_offer_import_rows',
      rows: snapshot.importRows,
      products: snapshot.importRows.flatMap((row) =>
        row.productId === null ? [] : [row.productId],
      ),
      dates: [],
    },
    {
      sourceTable: 'public.price_offers_staging',
      rows: snapshot.stagingRows,
      products: [],
      dates: snapshot.stagingRows.map((row) => String(row.offer_month_code ?? '') || null),
    },
    {
      sourceTable: 'public.products',
      rows: snapshot.products,
      products: snapshot.products.map((row) => row.id),
      dates: [],
    },
    {
      sourceTable: 'public.product_specs',
      rows: snapshot.productSpecs,
      products: snapshot.productSpecs.map((row) => String(row.product_id)),
      dates: [],
    },
    {
      sourceTable: 'public.specs',
      rows: snapshot.specs,
      products: [],
      dates: [],
    },
    {
      sourceTable: 'public.vw_product_value_current',
      rows: snapshot.legacyViewProductIds,
      products: snapshot.legacyViewProductIds,
      dates: [],
    },
    {
      sourceTable: 'public.vw_product_value_current_v2',
      rows: snapshot.v2ViewProductIds,
      products: snapshot.v2ViewProductIds,
      dates: [],
    },
  ];

  return sourceRows.map((source) => {
    const [minBusinessDate, maxBusinessDate] = dateRange(source.dates);
    return {
      sourceTable: source.sourceTable,
      sourceCount: source.rows.length,
      distinctProducts: new Set(source.products).size,
      minBusinessDate,
      maxBusinessDate,
      logicalHash: logicalHash(stableRows(source.rows)),
    };
  });
}

function actualBaseline(snapshot: SourceSnapshot): Record<string, number> {
  return {
    products: snapshot.products.length,
    productPriceOffers: snapshot.offers.length,
    distinctOfferProducts: new Set(snapshot.offers.map((offer) => offer.productId)).size,
    positivePublicPrices: snapshot.offers.filter((offer) =>
      decimal(offer.publicPrice)?.greaterThan(0),
    ).length,
    zeroPublicPrices: snapshot.offers.filter((offer) => decimal(offer.publicPrice)?.isZero())
      .length,
    offerMonths: new Set(snapshot.offers.map((offer) => offer.offerMonth).filter(Boolean)).size,
    priceOfferImports: snapshot.imports.length,
    priceOfferImportRows: snapshot.importRows.length,
    priceOffersStaging: snapshot.stagingRows.length,
  };
}

function compareBaseline(actual: Record<string, number>): BaselineDifference[] {
  return Object.entries(REFERENCE_BASELINE)
    .map(([metric, expected]) => ({
      metric,
      expected,
      actual: actual[metric] ?? 0,
      difference: (actual[metric] ?? 0) - expected,
    }))
    .filter((item) => item.difference !== 0);
}

function issueCounts(issueLists: IssueCode[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const issue of issueLists.flat()) counts[issue] = (counts[issue] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function classificationCounts(values: Array<{ classification: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values)
    counts[value.classification] = (counts[value.classification] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function buildViewCoverage(
  snapshot: SourceSnapshot,
  candidates: DryRunResult['publicPriceCandidates'],
  evaluationDate: string | null,
): ViewCoverageRow[] {
  const activeSpecIds = new Set(
    snapshot.specs.filter((spec) => spec.is_active === true).map((spec) => String(spec.id)),
  );
  const productsWithActiveSpecs = new Set(
    snapshot.productSpecs
      .filter((productSpec) => activeSpecIds.has(String(productSpec.equipment_id)))
      .map((productSpec) => String(productSpec.product_id)),
  );
  const legacyProducts = new Set(snapshot.legacyViewProductIds);
  const candidateProducts = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.proposedValue !== null &&
          candidate.classification !== 'needs_review' &&
          candidate.startsOn !== null &&
          (evaluationDate === null || candidate.startsOn <= evaluationDate),
      )
      .map((candidate) => candidate.productId),
  );

  return [...snapshot.products]
    .sort((left, right) => left.id.localeCompare(right.id, 'en', { numeric: true }))
    .map((product) => {
      const hasActiveSpecs = productsWithActiveSpecs.has(product.id);
      const hasLegacyCurrentPrice = legacyProducts.has(product.id);
      const hasNewCurrentPriceCandidate = candidateProducts.has(product.id);
      const eligibleForV2 = product.isActive && hasActiveSpecs && hasNewCurrentPriceCandidate;
      let absenceReason: ViewCoverageRow['absenceReason'] = '';
      if (!eligibleForV2) {
        if (!product.isActive) absenceReason = 'INACTIVE_PRODUCT';
        else if (!hasActiveSpecs) absenceReason = 'NO_ACTIVE_SPECS';
        else if (!hasLegacyCurrentPrice) absenceReason = 'NO_LEGACY_CURRENT_PRICE';
        else if (!hasNewCurrentPriceCandidate) absenceReason = 'NO_NEW_CURRENT_PRICE_CANDIDATE';
        else absenceReason = 'OTHER';
      }
      return {
        productId: product.id,
        activeProduct: product.isActive,
        hasActiveSpecs,
        hasLegacyCurrentPrice,
        hasNewCurrentPriceCandidate,
        eligibleForV2,
        absenceReason,
      };
    });
}

function needsReviewRows(
  prices: DryRunResult['publicPriceCandidates'],
  policies: DryRunResult['policyCandidates'],
  accumulators: DryRunResult['accumulatorCandidates'],
  reconciliation: DryRunResult['reconciliation'],
): CanonicalRow[] {
  return [
    ...prices
      .filter((item) => item.classification === 'needs_review')
      .map((item) => ({
        source_table: 'public.product_price_offers',
        source_id: item.sourceIds.join('|'),
        entity_type: 'public_price',
        classification: item.classification,
        issue_codes: item.issueCodes.join('|'),
        evidence: `legacy_value=${item.legacyValue ?? ''}`,
        fingerprint: item.logicalFingerprint,
      })),
    ...policies
      .filter((item) => item.classification === 'needs_review')
      .map((item) => ({
        source_table: 'public.product_price_offers',
        source_id: item.sourceId,
        entity_type: 'commercial_policy',
        classification: item.classification,
        issue_codes: item.issueCodes.join('|'),
        evidence: item.evidence,
        fingerprint: item.fingerprint,
      })),
    ...accumulators.map((item) => ({
      source_table: 'public.product_price_offers',
      source_id: item.sourceId,
      entity_type: 'accumulator_suggestion',
      classification: 'needs_review',
      issue_codes: item.issueCodes.join('|'),
      evidence: item.evidenceText,
      fingerprint: item.fingerprint,
    })),
    ...reconciliation
      .filter((item) => item.issueCodes.length > 0)
      .map((item) => ({
        source_table: 'public.product_price_offers',
        source_id: item.sourceId,
        entity_type: 'reconciliation',
        classification: 'needs_review',
        issue_codes: item.issueCodes.join('|'),
        evidence: item.explanation,
        fingerprint: logicalHash({ sourceId: item.sourceId, status: item.status }),
      })),
  ].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

export function runDryRun(snapshot: SourceSnapshot, options: DryRunOptions): DryRunResult {
  const knownProducts = new Set(snapshot.products.map((product) => product.id));
  const { candidates: publicPriceCandidates, conflicts: publicPriceConflicts } =
    classifyPublicPrices(snapshot.offers, knownProducts);
  const policyCandidates = classifyPolicies(
    snapshot.offers,
    options.insurancePercentage,
    knownProducts,
  );
  const accumulatorCandidates = classifyAccumulatorSuggestions(snapshot.offers, policyCandidates);
  const reconciliation = reconcileOffers(snapshot.offers, publicPriceCandidates, policyCandidates);
  const baselineActual = actualBaseline(snapshot);
  const baselineDifferences = compareBaseline(baselineActual);
  const evaluationDate =
    options.cutoffDate ??
    publicPriceCandidates
      .map((candidate) => candidate.startsOn)
      .filter((value): value is string => value !== null)
      .sort()
      .at(-1) ??
    null;
  const viewCoverage = buildViewCoverage(snapshot, publicPriceCandidates, evaluationDate);
  const needsReview = needsReviewRows(
    publicPriceCandidates,
    policyCandidates,
    accumulatorCandidates,
    reconciliation,
  );
  const sourceInventory = inventory(snapshot);
  const allIssueLists = [
    ...publicPriceCandidates.map((item) => item.issueCodes),
    ...policyCandidates.map((item) => item.issueCodes),
    ...accumulatorCandidates.map((item) => item.issueCodes),
    ...reconciliation.map((item) => item.issueCodes),
  ];
  const hasBaselineChange = baselineDifferences.length > 0;
  const hasReview = needsReview.length > 0;
  const overallStatus = hasBaselineChange
    ? hasReview
      ? 'SOURCE_CHANGED_AND_NEEDS_REVIEW'
      : 'SOURCE_CHANGED'
    : hasReview
      ? 'NEEDS_REVIEW'
      : 'READY_FOR_HUMAN_REVIEW';

  const summaryWithoutHash: Record<string, unknown> = {
    executedAt: options.executedAt,
    algorithmVersion: options.algorithmVersion,
    cutoffDate: options.cutoffDate,
    evaluationDate,
    database: snapshot.databaseIdentity,
    sourceCounts: baselineActual,
    sourceLogicalHashes: Object.fromEntries(
      sourceInventory.map((source) => [source.sourceTable, source.logicalHash]),
    ),
    classificationCounts: {
      publicPrices: classificationCounts(publicPriceCandidates),
      policies: classificationCounts(policyCandidates),
    },
    issueCounts: issueCounts(allIssueLists),
    candidatesByType: Object.fromEntries(
      Object.entries(
        policyCandidates.reduce<Record<string, number>>((counts, candidate) => {
          const type = candidate.proposedPolicyType ?? 'unsupported_source';
          counts[type] = (counts[type] ?? 0) + 1;
          return counts;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right)),
    ),
    candidateCounts: {
      publicPrices: publicPriceCandidates.length,
      publicPriceConflicts: publicPriceConflicts.length,
      policies: policyCandidates.length,
      accumulators: accumulatorCandidates.length,
      needsReview: needsReview.length,
    },
    viewCoverage: {
      activeProducts: snapshot.products.filter((product) => product.isActive).length,
      productsWithActiveSpecs: viewCoverage.filter((row) => row.hasActiveSpecs).length,
      legacyViewRows: snapshot.legacyViewProductIds.length,
      currentV2Rows: snapshot.v2ViewProductIds.length,
      expectedV2RowsAfterBackfill: viewCoverage.filter((row) => row.eligibleForV2).length,
    },
    sprint9ObjectCounts: snapshot.sprint9ObjectCounts,
    baselineDifferences,
    overallStatus,
    failOnSourceChange: options.failOnSourceChange,
    comparisonHashExcludesExecutedAt: options.excludeExecutedAtFromHash,
  };
  const hashInput = options.excludeExecutedAtFromHash
    ? Object.fromEntries(Object.entries(summaryWithoutHash).filter(([key]) => key !== 'executedAt'))
    : summaryWithoutHash;
  const summary = {
    ...summaryWithoutHash,
    comparisonHash: logicalHash(hashInput),
  };

  return {
    summary,
    sourceInventory,
    publicPriceCandidates,
    publicPriceConflicts,
    policyCandidates,
    accumulatorCandidates,
    needsReview,
    reconciliation,
    viewCoverage,
    baselineDifferences,
  };
}
