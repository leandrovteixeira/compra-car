import { canonicalJson } from './canonical.js';
import type {
  AccumulatorCandidate,
  DealerRebateReconciliationRow,
  FinancingAnalysisRow,
  LegacyOffer,
  PolicyCandidate,
  PublicPriceCandidate,
  ReconciliationRow,
  ValidationSampleRow,
} from './types.js';

function compareSource(left: { sourceId: string }, right: { sourceId: string }): number {
  return left.sourceId.localeCompare(right.sourceId, 'en', { numeric: true });
}

export function buildValidationSamples(input: {
  offers: LegacyOffer[];
  prices: PublicPriceCandidate[];
  policies: PolicyCandidate[];
  accumulators: AccumulatorCandidate[];
  rebates: DealerRebateReconciliationRow[];
  financing: FinancingAnalysisRow[];
  reconciliation: ReconciliationRow[];
}): { rows: ValidationSampleRow[]; summary: Record<string, number> } {
  const offers = new Map(input.offers.map((offer) => [offer.id, offer]));
  const rows: ValidationSampleRow[] = [];

  const addPolicy = (category: string, candidates: PolicyCandidate[]): void => {
    for (const policy of [...candidates].sort(compareSource).slice(0, 5)) {
      const offer = offers.get(policy.sourceId);
      rows.push({
        category,
        source_table: 'public.product_price_offers',
        source_id: policy.sourceId,
        product_id: policy.productId,
        offer_month: policy.startsOn,
        legacy_data: canonicalJson(offer ?? {}),
        policy_type: policy.proposedPolicyType,
        calculated_value: policy.proposedMonetaryValue,
        dealer_rebate_amount: policy.dealerRebateAmount,
        relation_type: 'OR',
        relation_origin: 'legacy_default',
        parameter_set_id: policy.financialParameterSetId,
        parameter_set_version: policy.financialParameterSetVersion,
        classification: policy.classification,
        issue_codes: policy.issueCodes.join('|'),
        justification: policy.evidence,
      });
    }
  };

  for (const price of input.prices
    .filter((item) => item.classification === 'auto_classifiable')
    .sort((left, right) =>
      left.sourceIds[0]!.localeCompare(right.sourceIds[0]!, 'en', { numeric: true }),
    )
    .slice(0, 5)) {
    const sourceId = price.sourceIds[0] ?? '';
    const offer = offers.get(sourceId);
    rows.push({
      category: 'public_price_auto_classifiable',
      source_table: 'public.product_price_offers',
      source_id: sourceId,
      product_id: price.productId,
      offer_month: price.startsOn,
      legacy_data: canonicalJson(offer ?? {}),
      policy_type: null,
      calculated_value: price.proposedValue,
      dealer_rebate_amount: null,
      relation_type: null,
      relation_origin: null,
      parameter_set_id: null,
      parameter_set_version: null,
      classification: price.classification,
      issue_codes: price.issueCodes.join('|'),
      justification: 'Deterministic auto-classifiable public price sample',
    });
  }

  addPolicy(
    'retail_bonus',
    input.policies.filter((item) => item.proposedPolicyType === 'retail_bonus'),
  );
  addPolicy(
    'trade_in_bonus',
    input.policies.filter((item) => item.proposedPolicyType === 'trade_in_bonus'),
  );
  addPolicy(
    'others_bonus',
    input.policies.filter((item) => item.proposedPolicyType === 'other'),
  );
  addPolicy(
    'insurance_one_year',
    input.policies.filter(
      (item) => item.proposedPolicyType === 'free_insurance' && Number(item.coverageYears) === 1,
    ),
  );
  addPolicy(
    'insurance_two_years',
    input.policies.filter(
      (item) => item.proposedPolicyType === 'free_insurance' && Number(item.coverageYears) === 2,
    ),
  );
  addPolicy(
    'financing_zero_rate',
    input.policies.filter(
      (item) =>
        item.proposedPolicyType === 'subsidized_financing' &&
        offers.get(item.sourceId)?.subsidizedRateMonthly !== null &&
        Number(offers.get(item.sourceId)?.subsidizedRateMonthly) === 0,
    ),
  );
  addPolicy(
    'financing_positive_rate',
    input.policies.filter(
      (item) =>
        item.proposedPolicyType === 'subsidized_financing' &&
        Number(offers.get(item.sourceId)?.subsidizedRateMonthly) > 0,
    ),
  );
  addPolicy(
    'free_ipva',
    input.policies.filter((item) => item.proposedPolicyType === 'free_ipva'),
  );
  for (const [category, month] of [
    ['ipva_january', '-01-'],
    ['ipva_july', '-07-'],
    ['ipva_december', '-12-'],
  ] as const) {
    addPolicy(
      category,
      input.policies.filter(
        (item) => item.proposedPolicyType === 'free_ipva' && item.startsOn?.includes(month),
      ),
    );
  }
  addPolicy(
    'financing_zero_down_payment',
    input.policies.filter(
      (item) =>
        item.proposedPolicyType === 'subsidized_financing' &&
        Number(offers.get(item.sourceId)?.downPaymentPercent) === 0,
    ),
  );
  addPolicy(
    'promotional_rate_equals_reference',
    input.policies.filter((item) => {
      const rate = Number(offers.get(item.sourceId)?.subsidizedRateMonthly) / 100;
      return (
        item.proposedPolicyType === 'subsidized_financing' &&
        Number.isFinite(rate) &&
        Math.abs(rate - 0.014553487442) < 0.000000000001
      );
    }),
  );
  addPolicy(
    'negative_economic_value',
    input.policies.filter((item) => item.issueCodes.includes('NEGATIVE_ECONOMIC_VALUE')),
  );
  addPolicy(
    'dealer_rebate',
    input.policies.filter((item) => item.dealerRebateAmount !== null),
  );

  const addAnalysis = (
    category: string,
    sourceIds: string[],
    justification: (id: string) => string,
  ): void => {
    for (const sourceId of [...sourceIds]
      .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
      .slice(0, 5)) {
      const offer = offers.get(sourceId);
      rows.push({
        category,
        source_table: 'public.product_price_offers',
        source_id: sourceId,
        product_id: offer?.productId ?? '',
        offer_month: offer?.offerMonth ?? null,
        legacy_data: canonicalJson(offer ?? {}),
        policy_type: null,
        calculated_value: null,
        dealer_rebate_amount: null,
        relation_type: category === 'multiple_policies_or' ? 'OR' : null,
        relation_origin: category === 'multiple_policies_or' ? 'legacy_default' : null,
        parameter_set_id: null,
        parameter_set_version: null,
        classification: 'needs_review',
        issue_codes: '',
        justification: justification(sourceId),
      });
    }
  };
  addAnalysis(
    'dealer_rebate_total_mismatch',
    input.rebates.filter((row) => row.issueCodes.length > 0).map((row) => row.sourceId),
    (id) => input.rebates.find((row) => row.sourceId === id)?.explanation ?? '',
  );
  addAnalysis(
    'incomplete_financing',
    input.financing
      .filter((row) => row.issueCodes.includes('INCOMPLETE_FINANCING_TERMS'))
      .map((row) => row.sourceId),
    () => 'Financing terms are incomplete after explicit null checks',
  );
  addAnalysis(
    'legacy_calculation_method_difference',
    input.reconciliation
      .filter((row) => row.informationalIssueCodes.includes('LEGACY_CALCULATION_METHOD_DIFFERENCE'))
      .map((row) => row.sourceId),
    (id) => input.reconciliation.find((row) => row.sourceId === id)?.explanation ?? '',
  );
  addAnalysis(
    'zero_public_price',
    input.prices
      .filter((row) => row.issueCodes.includes('ZERO_PUBLIC_PRICE'))
      .flatMap((row) => row.sourceIds),
    () => 'Legacy public price is explicitly zero',
  );
  addAnalysis(
    'multiple_policies_or',
    input.accumulators.map((row) => row.sourceId),
    () => 'Policies from the same legacy offer default to unpublished OR relation',
  );
  const policyCounts = new Map<string, number>();
  for (const policy of input.policies)
    policyCounts.set(policy.sourceId, (policyCounts.get(policy.sourceId) ?? 0) + 1);
  addAnalysis(
    'offer_with_price_without_policy',
    input.offers
      .filter(
        (offer) =>
          (policyCounts.get(offer.id) ?? 0) === 0 &&
          input.prices.some(
            (price) =>
              price.sourceIds.includes(offer.id) &&
              price.proposedValue !== null &&
              price.issueCodes.length === 0,
          ),
      )
      .map((offer) => offer.id),
    () => 'Commercial offer retained for audit without policy',
  );
  addAnalysis(
    'offer_with_single_policy',
    input.offers.filter((offer) => policyCounts.get(offer.id) === 1).map((offer) => offer.id),
    () => 'Commercial offer has exactly one policy and no accumulator',
  );
  addAnalysis(
    'financing_absent_zero_zero_zero',
    input.offers
      .filter(
        (offer) =>
          Number(offer.subsidizedRateMonthly) === 0 &&
          Number(offer.downPaymentPercent) === 0 &&
          offer.installments === 0,
      )
      .map((offer) => offer.id),
    () => '0/0/0 explicitly means no financing policy',
  );
  addAnalysis(
    'financing_absent_null_null_null',
    input.offers
      .filter(
        (offer) =>
          offer.subsidizedRateMonthly === null &&
          offer.downPaymentPercent === null &&
          offer.installments === null,
      )
      .map((offer) => offer.id),
    () => 'NULL/NULL/NULL means no financing policy',
  );
  addAnalysis(
    'offer_without_valid_price',
    input.prices
      .filter((price) => price.proposedValue === null || price.issueCodes.length > 0)
      .flatMap((price) => price.sourceIds),
    () => 'Commercial offer has no valid price candidate',
  );

  rows.sort((left, right) =>
    `${left.category}|${left.source_id}`.localeCompare(
      `${right.category}|${right.source_id}`,
      'en',
      { numeric: true },
    ),
  );
  const requestedCategories = [
    'insurance_two_years',
    'financing_zero_down_payment',
    'promotional_rate_equals_reference',
  ];
  const summary = Object.fromEntries(
    [...new Set([...requestedCategories, ...rows.map((row) => row.category)])]
      .sort()
      .map((category) => [category, rows.filter((row) => row.category === category).length]),
  );
  return { rows, summary };
}
