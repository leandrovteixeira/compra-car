import Decimal from 'decimal.js';

import { decimal, money } from './money.js';
import type {
  CanonicalRow,
  DealerRebateAllocationRow,
  DealerRebateReconciliationRow,
  FinancingAnalysisRow,
  LegacyOffer,
  PolicyCandidate,
} from './types.js';

export function reconcileDealerRebates(
  offers: LegacyOffer[],
  allocations: DealerRebateAllocationRow[] = [],
): DealerRebateReconciliationRow[] {
  return [...offers]
    .sort((left, right) => left.id.localeCompare(right.id, 'en', { numeric: true }))
    .map((offer) => {
      const structured = [offer.retailRebate, offer.tradeInRebate, offer.rateRebate].reduce(
        (sum: Decimal, value) => sum.plus(decimal(value) ?? 0),
        new Decimal(0),
      );
      const legacy = decimal(offer.totalDealerRebate);
      const offerAllocations = allocations.filter((row) => row.legacyOfferId === offer.id);
      const allocated = offerAllocations.reduce(
        (sum, row) => sum.plus(decimal(row.dealerRebateAmount) ?? 0),
        new Decimal(0),
      );
      const effectiveTotal = offerAllocations.length > 0 ? allocated : structured;
      const difference = legacy === null ? null : effectiveTotal.minus(legacy).abs();
      const mismatch = difference?.greaterThan('0.01') === true;
      const unallocated = offerAllocations.some((row) =>
        row.issueCodes.includes('UNALLOCATED_LEGACY_DEALER_REBATE'),
      );
      const components = [
        ['retail_rebate', offer.retailRebate],
        ['trade_in_rebate', offer.tradeInRebate],
        ['rate_rebate', offer.rateRebate],
      ] as const;
      return {
        commercialOfferCandidateId: `offer-${offer.id}`,
        sourceId: offer.id,
        retailRebate: offer.retailRebate,
        tradeInRebate: offer.tradeInRebate,
        rateRebate: offer.rateRebate,
        structuredTotal: money(structured),
        allocatedTotal: money(effectiveTotal),
        legacyTotal: offer.totalDealerRebate,
        absoluteDifference: difference === null ? null : money(difference),
        explanation:
          legacy === null
            ? 'Legacy total_dealer_rebate is null; individual rebates remain traceable'
            : mismatch
              ? 'Sum of explicit or allocated dealer rebates differs from total_dealer_rebate'
              : 'Sum of explicit or allocated dealer rebates matches total_dealer_rebate',
        componentsPresent: components
          .filter(([, value]) => value !== null)
          .map(([name]) => name)
          .join('|'),
        componentsMissing: components
          .filter(([, value]) => value === null)
          .map(([name]) => name)
          .join('|'),
        issueCodes: [
          ...(mismatch ? (['DEALER_REBATE_TOTAL_MISMATCH'] as const) : []),
          ...(unallocated ? (['UNALLOCATED_LEGACY_DEALER_REBATE'] as const) : []),
        ],
      };
    });
}

export function analyzeFinancing(
  offers: LegacyOffer[],
  policies: PolicyCandidate[],
): FinancingAnalysisRow[] {
  const offerById = new Map(offers.map((offer) => [offer.id, offer]));
  return policies
    .filter((policy) => policy.proposedPolicyType === 'subsidized_financing')
    .map((policy) => {
      const offer = offerById.get(policy.sourceId);
      if (!offer) throw new Error(`Financing policy has no legacy offer: ${policy.sourceId}`);
      return {
        commercialOfferCandidateId: `offer-${offer.id}`,
        sourceId: offer.id,
        productId: offer.productId,
        offerMonth: offer.offerMonth,
        promotionalMonthlyRate: offer.subsidizedRateMonthly,
        downPaymentPercent: offer.downPaymentPercent,
        installments: offer.installments,
        financedPrincipal: policy.financedPrincipal,
        dealerRebate: policy.dealerRebateAmount,
        missingRate: offer.subsidizedRateMonthly === null,
        missingDownPayment: offer.downPaymentPercent === null,
        missingInstallments: offer.installments === null || offer.installments <= 0,
        missingPublicPrice: decimal(offer.publicPrice)?.greaterThan(0) !== true,
        missingParameterSet: policy.financialParameterSetId === null,
        classification: policy.classification,
        issueCodes: policy.issueCodes,
      };
    })
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId, 'en', { numeric: true }));
}

export function summarizeMissingFinancingFields(rows: FinancingAnalysisRow[]): CanonicalRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const fields = [
      row.missingRate ? 'rate' : null,
      row.missingDownPayment ? 'down_payment' : null,
      row.missingInstallments ? 'installments' : null,
      row.missingPublicPrice ? 'public_price' : null,
      row.missingParameterSet ? 'parameter_set' : null,
    ].filter((value): value is string => value !== null);
    const key = fields.length === 0 ? 'complete' : fields.join('+');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([missing_fields, count]) => ({ missing_fields, count }));
}
