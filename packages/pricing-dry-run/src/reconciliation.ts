import Decimal from 'decimal.js';

import { decimal, money, percentage } from './money.js';
import type {
  IssueCode,
  LegacyOffer,
  PolicyCandidate,
  PublicPriceCandidate,
  ReconciliationRow,
} from './types.js';

function uniqueIssues(issues: IssueCode[]): IssueCode[] {
  return [...new Set(issues)].sort();
}

export function reconcileOffers(
  offers: LegacyOffer[],
  prices: PublicPriceCandidate[],
  policies: PolicyCandidate[],
): ReconciliationRow[] {
  const priceBySource = new Map<string, PublicPriceCandidate>();
  for (const price of prices) {
    for (const sourceId of price.sourceIds) priceBySource.set(sourceId, price);
  }
  const policiesBySource = new Map<string, PolicyCandidate[]>();
  for (const policy of policies) {
    policiesBySource.set(policy.sourceId, [
      ...(policiesBySource.get(policy.sourceId) ?? []),
      policy,
    ]);
  }

  return [...offers]
    .sort((left, right) =>
      `${left.productId}|${left.offerMonth ?? ''}|${left.id}`.localeCompare(
        `${right.productId}|${right.offerMonth ?? ''}|${right.id}`,
        'en',
        { numeric: true },
      ),
    )
    .map((offer) => {
      const price = priceBySource.get(offer.id);
      const sourcePolicies = policiesBySource.get(offer.id) ?? [];
      const explicit = sourcePolicies.filter(
        (policy) =>
          (policy.calculationMethod === 'fixed_amount' ||
            policy.calculationMethod === 'manual_amount') &&
          policy.proposedMonetaryValue !== null,
      );
      const calculated = sourcePolicies.filter(
        (policy) =>
          policy.calculationMethod === 'percentage_of_msrp' &&
          policy.proposedMonetaryValue !== null,
      );
      const known = [...explicit, ...calculated].reduce(
        (sum, policy) => sum.plus(policy.proposedMonetaryValue ?? 0),
        new Decimal(0),
      );
      const legacyTotal = decimal(offer.totalCustomerBenefit);
      const incomplete = sourcePolicies.some(
        (policy) => policy.proposedPolicyType !== null && policy.proposedMonetaryValue === null,
      );
      const issues: IssueCode[] = [];
      let absoluteDifference: string | null = null;
      let percentageDifference: string | null = null;
      let status: ReconciliationRow['status'];
      let explanation: string;

      if (legacyTotal === null) {
        status = 'NOT_COMPARABLE';
        explanation = 'Legacy total_customer_benefit is null';
      } else {
        const difference = known.minus(legacyTotal).abs();
        absoluteDifference = money(difference);
        if (!legacyTotal.isZero()) {
          percentageDifference = percentage(difference.div(legacyTotal.abs()).mul(100));
        }
        if (!difference.isZero()) issues.push('LEGACY_TOTAL_MISMATCH');
        if (legacyTotal.isNegative()) issues.push('NEGATIVE_ECONOMIC_VALUE');

        if (incomplete) {
          status = 'PARTIAL';
          explanation = 'Known components are partial; no equality is forced';
        } else if (difference.isZero()) {
          status = 'MATCH';
          explanation = 'Known components match the legacy customer total';
        } else {
          status = 'MISMATCH';
          explanation = 'Known components differ from the legacy customer total';
        }
      }

      return {
        productId: offer.productId,
        offerMonth: offer.offerMonth,
        sourceId: offer.id,
        legacyPublicPrice: offer.publicPrice,
        proposedPublicPrice: price?.proposedValue ?? null,
        explicitBenefitInputs: explicit
          .map((policy) => `${policy.proposedPolicyType}=${policy.inputMonetaryValue}`)
          .sort()
          .join('|'),
        safelyCalculatedComponents: calculated
          .map((policy) => `${policy.proposedPolicyType}=${policy.proposedMonetaryValue}`)
          .sort()
          .join('|'),
        legacyTotalCustomerBenefit: offer.totalCustomerBenefit,
        calculatedKnownTotal: money(known),
        absoluteDifference,
        percentageDifference,
        status,
        explanation,
        issueCodes: uniqueIssues(issues),
      };
    });
}
