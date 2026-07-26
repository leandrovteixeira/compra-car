import { canonicalJson, logicalHash } from './canonical.js';
import { allocateDealerRebates } from './dealer-rebate.js';
import {
  analyzeFinancing,
  reconcileDealerRebates,
  summarizeMissingFinancingFields,
} from './analysis.js';
import {
  classifyAccumulatorSuggestions,
  classifyPolicies,
  classifyPublicPrices,
  linkOfferAggregate,
} from './classification.js';
import { decimal, money } from './money.js';
import { LEGACY_CDI_PARAMETER_SET } from './financial-parameters.js';
import { isRebateEligiblePolicy } from './policy-rules.js';
import { reconcileOffers } from './reconciliation.js';
import { buildValidationSamples } from './samples.js';
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
  rebates: DryRunResult['dealerRebateReconciliation'],
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
    ...accumulators
      .filter((item) => item.issueCodes.length > 0)
      .map((item) => ({
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
    ...rebates
      .filter((item) => item.issueCodes.length > 0)
      .map((item) => ({
        source_table: 'public.product_price_offers',
        source_id: item.sourceId,
        entity_type: 'dealer_rebate_reconciliation',
        classification: 'needs_review',
        issue_codes: item.issueCodes.join('|'),
        evidence: item.explanation,
        fingerprint: logicalHash({
          sourceId: item.sourceId,
          structuredTotal: item.structuredTotal,
          legacyTotal: item.legacyTotal,
        }),
      })),
  ].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

export interface IssueEvent {
  issueCode: IssueCode;
  sourceId: string;
  entityType: 'commercial_offer' | 'commercial_policy' | 'public_price' | 'reconciliation';
  entityId: string;
}

export function summarizeIssueEvents(events: IssueEvent[]): {
  impact: CanonicalRow[];
  sourceGroups: CanonicalRow[];
  totals: { issueOccurrences: number; uniqueEntities: number; uniqueOffers: number };
} {
  const impact = [...new Set(events.map((event) => event.issueCode))].sort().map((issueCode) => {
    const matches = events.filter((event) => event.issueCode === issueCode);
    return {
      issue_code: issueCode,
      issue_occurrence_count: matches.length,
      affected_offer_count: new Set(matches.map((event) => event.sourceId)).size,
      affected_policy_count: new Set(
        matches
          .filter((event) => event.entityType === 'commercial_policy')
          .map((event) => event.entityId),
      ).size,
      affected_price_count: new Set(
        matches
          .filter((event) => event.entityType === 'public_price')
          .map((event) => event.entityId),
      ).size,
      unique_source_count: new Set(matches.map((event) => event.sourceId)).size,
      blocking_entity_count: new Set(
        matches.map((event) => `${event.entityType}:${event.entityId}`),
      ).size,
    };
  });
  const sourceGroups = [...new Set(events.map((event) => event.sourceId))]
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
    .map((sourceId) => {
      const matches = events.filter((event) => event.sourceId === sourceId);
      const codes = [...new Set(matches.map((event) => event.issueCode))].sort();
      return {
        source_id: sourceId,
        issue_codes: codes.join('|'),
        issue_code_count: codes.length,
        issue_occurrence_count: matches.length,
        affected_entity_count: new Set(
          matches.map((event) => `${event.entityType}:${event.entityId}`),
        ).size,
        has_multiple_issue_codes: codes.length > 1,
      };
    });
  return {
    impact,
    sourceGroups,
    totals: {
      issueOccurrences: events.length,
      uniqueEntities: new Set(events.map((event) => `${event.entityType}:${event.entityId}`)).size,
      uniqueOffers: new Set(events.map((event) => event.sourceId)).size,
    },
  };
}

function issueImpactRows(
  offers: DryRunResult['commercialOfferCandidates'],
  prices: DryRunResult['publicPriceCandidates'],
  policies: DryRunResult['policyCandidates'],
  reconciliation: DryRunResult['reconciliation'],
  rebates: DryRunResult['dealerRebateReconciliation'],
): {
  impact: CanonicalRow[];
  sourceGroups: CanonicalRow[];
  totals: { issueOccurrences: number; uniqueEntities: number; uniqueOffers: number };
} {
  const events: IssueEvent[] = [];
  for (const price of prices)
    for (const sourceId of price.sourceIds)
      for (const issueCode of price.issueCodes)
        events.push({
          issueCode,
          sourceId,
          entityType: 'public_price',
          entityId: price.logicalFingerprint,
        });
  for (const policy of policies)
    for (const issueCode of policy.issueCodes)
      events.push({
        issueCode,
        sourceId: policy.sourceId,
        entityType: 'commercial_policy',
        entityId: policy.candidatePolicyId,
      });
  for (const row of reconciliation)
    for (const issueCode of row.issueCodes)
      events.push({
        issueCode,
        sourceId: row.sourceId,
        entityType: 'reconciliation',
        entityId: `customer-benefit:${row.sourceId}`,
      });
  for (const row of rebates)
    for (const issueCode of row.issueCodes)
      events.push({
        issueCode,
        sourceId: row.sourceId,
        entityType: 'reconciliation',
        entityId: `dealer-rebate:${row.sourceId}`,
      });
  for (const offer of offers)
    for (const issueCode of offer.blockingIssueCodes)
      if (
        !events.some(
          (event) => event.sourceId === offer.legacySourceId && event.issueCode === issueCode,
        )
      )
        events.push({
          issueCode,
          sourceId: offer.legacySourceId,
          entityType: 'commercial_offer',
          entityId: offer.candidateOfferId,
        });

  return summarizeIssueEvents(events);
}

export function runDryRun(snapshot: SourceSnapshot, options: DryRunOptions): DryRunResult {
  const financialParameterSets = options.financialParameterSets ?? [LEGACY_CDI_PARAMETER_SET];
  const knownProducts = new Set(snapshot.products.map((product) => product.id));
  const { candidates: publicPriceCandidates, conflicts: publicPriceConflicts } =
    classifyPublicPrices(snapshot.offers, knownProducts);
  const classifiedPolicies = classifyPolicies(
    snapshot.offers,
    options.insurancePercentage,
    knownProducts,
    financialParameterSets,
  );
  const rebateAllocation = allocateDealerRebates(snapshot.offers, classifiedPolicies);
  const policyCandidates = rebateAllocation.policies;
  const dealerRebateAllocations = rebateAllocation.rows;
  const commercialOfferCandidates = linkOfferAggregate(
    snapshot.offers,
    publicPriceCandidates,
    policyCandidates,
  );
  for (const candidate of commercialOfferCandidates) {
    if (
      dealerRebateAllocations.some(
        (row) =>
          row.legacyOfferId === candidate.legacySourceId &&
          row.issueCodes.includes('UNALLOCATED_LEGACY_DEALER_REBATE'),
      )
    ) {
      candidate.blockingIssueCodes = [
        ...new Set([...candidate.blockingIssueCodes, 'UNALLOCATED_LEGACY_DEALER_REBATE' as const]),
      ].sort();
    }
  }
  const accumulatorCandidates = classifyAccumulatorSuggestions(snapshot.offers, policyCandidates);
  const reconciliation = reconcileOffers(snapshot.offers, publicPriceCandidates, policyCandidates);
  const dealerRebateReconciliation = reconcileDealerRebates(
    snapshot.offers,
    dealerRebateAllocations,
  );
  for (const allocation of dealerRebateAllocations) {
    allocation.reconciliationDifference =
      dealerRebateReconciliation.find((row) => row.sourceId === allocation.legacyOfferId)
        ?.absoluteDifference ?? null;
  }
  const financingAnalysis = analyzeFinancing(snapshot.offers, policyCandidates);
  const financingMissingSummary = summarizeMissingFinancingFields(financingAnalysis);
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
    dealerRebateReconciliation,
  );
  const issueMetrics = issueImpactRows(
    commercialOfferCandidates,
    publicPriceCandidates,
    policyCandidates,
    reconciliation,
    dealerRebateReconciliation,
  );
  const informationalIssues: CanonicalRow[] = reconciliation
    .filter((row) => row.informationalIssueCodes.length > 0)
    .map((row) => ({
      commercial_offer_candidate_id: row.commercialOfferCandidateId,
      legacy_source_id: row.sourceId,
      issue_codes: row.informationalIssueCodes.join('|'),
      legacy_total_customer_benefit: row.legacyTotalCustomerBenefit,
      legacy_reference_rate_monthly: '0.0145',
      new_annual_cdi_rate: financialParameterSets[0]?.annualReferenceRate ?? null,
      new_monthly_cdi_rate: financialParameterSets[0]?.monthlyReferenceRate ?? null,
      new_monthly_spread_rate: financialParameterSets[0]?.monthlySpreadRate ?? null,
      new_monthly_reference_rate: financialParameterSets[0]?.monthlyCombinedReferenceRate ?? null,
      new_calculation_method: 'discounted_promotional_cash_flow_difference',
      new_best_policy_benefit: row.maximumAlternativePolicyValue,
      absolute_difference: row.absoluteDifference,
      relative_difference: row.percentageDifference,
      reason: 'methodology_changed',
    }));
  const offerPolicySummary = commercialOfferCandidates.map((candidate) => {
    const offer = snapshot.offers.find((item) => item.id === candidate.legacySourceId);
    const sourcePolicies = policyCandidates.filter(
      (item) => item.sourceId === candidate.legacySourceId,
    );
    const byType = (type: string) =>
      sourcePolicies.find((item) => item.proposedPolicyType === type)?.proposedMonetaryValue ??
      null;
    const reconciliationRow = reconciliation.find(
      (item) => item.sourceId === candidate.legacySourceId,
    );
    return {
      offerCandidateId: candidate.candidateOfferId,
      legacySourceId: candidate.legacySourceId,
      price:
        publicPriceCandidates.find(
          (price) => price.candidatePriceId === candidate.publicPriceCandidateId,
        )?.proposedValue ?? null,
      retailBonus: byType('retail_bonus'),
      tradeInBonus: byType('trade_in_bonus'),
      subsidizedFinancing: byType('subsidized_financing'),
      freeIpva: byType('free_ipva'),
      freeInsurance: byType('free_insurance'),
      other: byType('other'),
      policyCount: sourcePolicies.length,
      relationType: sourcePolicies.length >= 2 ? ('OR' as const) : null,
      bestCustomerBenefit: reconciliationRow?.maximumAlternativePolicyValue ?? null,
      legacyTotalCustomerBenefit: offer?.totalCustomerBenefit ?? null,
      difference: reconciliationRow?.absoluteDifference ?? null,
      reviewStatus:
        candidate.blockingIssueCodes.length > 0 ||
        sourcePolicies.some((policy) => policy.classification === 'needs_review')
          ? 'needs_review'
          : 'draft',
    };
  });
  const samples = buildValidationSamples({
    offers: snapshot.offers,
    prices: publicPriceCandidates,
    policies: policyCandidates,
    accumulators: accumulatorCandidates,
    rebates: dealerRebateReconciliation,
    financing: financingAnalysis,
    reconciliation,
  });
  const sourceInventory = inventory(snapshot);
  const allIssueLists = [
    ...publicPriceCandidates.map((item) => item.issueCodes),
    ...policyCandidates.map((item) => item.issueCodes),
    ...accumulatorCandidates.map((item) => item.issueCodes),
    ...reconciliation.map((item) => item.issueCodes),
    ...dealerRebateReconciliation.map((item) => item.issueCodes),
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
    informationalIssueCounts: issueCounts(
      reconciliation.map((item) => item.informationalIssueCodes),
    ),
    dealerRebateAllocation: {
      methodCounts: dealerRebateAllocations.reduce<Record<string, number>>(
        (counts, row) => {
          counts[row.allocationMethod] = (counts[row.allocationMethod] ?? 0) + 1;
          return counts;
        },
        {
          explicit_legacy_component: 0,
          proportional_legacy_total: 0,
          unallocated_legacy_total: 0,
        },
      ),
      offersByEligiblePolicyCount: Object.fromEntries(
        [1, 2, 3].map((count) => [
          String(count),
          snapshot.offers.filter(
            (offer) =>
              decimal(offer.totalDealerRebate)?.greaterThan(0) === true &&
              [offer.retailRebate, offer.tradeInRebate, offer.rateRebate].every(
                (value) => decimal(value)?.greaterThan(0) !== true,
              ) &&
              policyCandidates.filter(
                (policy) =>
                  policy.sourceId === offer.id &&
                  isRebateEligiblePolicy(policy.proposedPolicyType) &&
                  policy.classification !== 'needs_review' &&
                  decimal(policy.proposedMonetaryValue)?.greaterThan(0) === true,
              ).length === count,
          ).length,
        ]),
      ),
      unallocatableOffers: new Set(
        dealerRebateAllocations
          .filter((row) => row.allocationMethod === 'unallocated_legacy_total')
          .map((row) => row.legacyOfferId),
      ).size,
      unallocatedTotal: money(
        dealerRebateAllocations
          .filter((row) => row.allocationMethod === 'unallocated_legacy_total')
          .reduce((sum, row) => sum.plus(decimal(row.legacyTotalDealerRebate) ?? 0), decimal('0')!),
      ),
      legacyTotal: money(
        snapshot.offers.reduce(
          (sum, offer) => sum.plus(decimal(offer.totalDealerRebate) ?? 0),
          decimal('0')!,
        ),
      ),
      migratedTotal: money(
        dealerRebateAllocations.reduce(
          (sum, row) => sum.plus(decimal(row.dealerRebateAmount) ?? 0),
          decimal('0')!,
        ),
      ),
      aggregateDifference: money(
        snapshot.offers
          .reduce((sum, offer) => sum.plus(decimal(offer.totalDealerRebate) ?? 0), decimal('0')!)
          .minus(
            dealerRebateAllocations.reduce(
              (sum, row) => sum.plus(decimal(row.dealerRebateAmount) ?? 0),
              decimal('0')!,
            ),
          )
          .abs(),
      ),
    },
    financialParameterSet: financialParameterSets[0] ?? null,
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
      commercialOffers: commercialOfferCandidates.length,
      offersWithPrice: commercialOfferCandidates.filter(
        (item) => item.publicPriceCandidateId !== null,
      ).length,
      offersWithoutPrice: commercialOfferCandidates.filter(
        (item) => item.publicPriceCandidateId === null,
      ).length,
      offersWithPolicies: commercialOfferCandidates.filter((item) => item.policyCount > 0).length,
      offersWithoutPolicies: commercialOfferCandidates.filter((item) => item.policyCount === 0)
        .length,
      publicPrices: publicPriceCandidates.length,
      deduplicatedPrices: snapshot.offers.length - publicPriceCandidates.length,
      publicPriceConflicts: publicPriceConflicts.length,
      policies: policyCandidates.length,
      accumulators: accumulatorCandidates.length,
      needsReview: needsReview.length,
      informationalIssues: informationalIssues.length,
      blockingIssues: needsReview.length,
      validationSamples: samples.rows.length,
    },
    needsReviewMetrics: {
      needs_review_issue_occurrences: issueMetrics.totals.issueOccurrences,
      needs_review_unique_entities: issueMetrics.totals.uniqueEntities,
      needs_review_unique_offers: issueMetrics.totals.uniqueOffers,
      blocking_entity_count: issueMetrics.totals.uniqueEntities,
    },
    issueImpact: Object.fromEntries(
      issueMetrics.impact.map((row) => [String(row.issue_code), row]),
    ),
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
    commercialOfferCandidates,
    sourceInventory,
    publicPriceCandidates,
    publicPriceConflicts,
    policyCandidates,
    accumulatorCandidates,
    needsReview,
    reconciliation,
    dealerRebateReconciliation,
    dealerRebateAllocations,
    financingAnalysis,
    financingMissingSummary,
    offerPolicySummary,
    informationalIssues,
    issueImpact: issueMetrics.impact,
    sourceIssueGroups: issueMetrics.sourceGroups,
    validationSamples: samples.rows,
    validationSampleSummary: samples.summary,
    viewCoverage,
    baselineDifferences,
  };
}
