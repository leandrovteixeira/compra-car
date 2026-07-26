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
      const knownPolicies = sourcePolicies.filter(
        (policy) => policy.proposedPolicyType !== null && policy.proposedMonetaryValue !== null,
      );
      const incompletePolicies = sourcePolicies.filter(
        (policy) => policy.proposedPolicyType !== null && policy.proposedMonetaryValue === null,
      );
      const values = knownPolicies.map((policy) => new Decimal(policy.proposedMonetaryValue ?? 0));
      const sum = values.reduce((total, value) => total.plus(value), new Decimal(0));
      const maximum = values.length === 0 ? null : Decimal.max(...values);
      const legacyTotal = decimal(offer.totalCustomerBenefit);
      const issues: IssueCode[] = [];
      const informationalIssues: IssueCode[] = [];
      let absoluteDifference: string | null = null;
      let percentageDifference: string | null = null;
      let status: ReconciliationRow['status'];
      let explanation: string;
      let reasonNotComparable: string | null = null;

      if (legacyTotal === null) {
        status = 'NOT_COMPARABLE';
        explanation = 'Legacy total_customer_benefit is null';
        reasonNotComparable = 'missing_legacy_total';
      } else if (maximum === null) {
        status = 'NOT_COMPARABLE';
        explanation = 'No policy has a safely calculated customer benefit';
        reasonNotComparable = 'no_known_policy_value';
      } else {
        const difference = maximum.minus(legacyTotal).abs();
        absoluteDifference = money(difference);
        if (!legacyTotal.isZero())
          percentageDifference = percentage(difference.div(legacyTotal.abs()).mul(100));
        if (legacyTotal.isNegative()) issues.push('NEGATIVE_ECONOMIC_VALUE');
        if (incompletePolicies.length > 0) {
          status = 'PARTIAL';
          explanation =
            'Maximum known OR alternative is diagnostic; at least one policy value is unavailable';
          reasonNotComparable = 'incomplete_or_alternatives';
        } else if (difference.isZero()) {
          status = 'MATCH';
          explanation = 'Maximum alternative policy value matches the legacy customer total';
        } else {
          status = 'MISMATCH';
          explanation = 'Maximum alternative policy value differs from the legacy customer total';
          informationalIssues.push('LEGACY_CALCULATION_METHOD_DIFFERENCE');
        }
      }

      const policyValues = knownPolicies
        .map((policy) => `${policy.proposedPolicyType}=${policy.proposedMonetaryValue}`)
        .sort();
      const excluded = [
        ...incompletePolicies.map((policy) => `${policy.proposedPolicyType}=UNAVAILABLE`),
        ...sourcePolicies
          .filter((policy) => policy.dealerRebateAmount !== null)
          .map(
            (policy) => `${policy.proposedPolicyType}.dealer_rebate=${policy.dealerRebateAmount}`,
          ),
      ].sort();

      return {
        commercialOfferCandidateId: `offer-${offer.id}`,
        productId: offer.productId,
        offerMonth: offer.offerMonth,
        sourceId: offer.id,
        legacyPublicPrice: offer.publicPrice,
        proposedPublicPrice: price?.proposedValue ?? null,
        explicitBenefitInputs: knownPolicies
          .filter((policy) => policy.inputMonetaryValue !== null)
          .map((policy) => `${policy.proposedPolicyType}=${policy.inputMonetaryValue}`)
          .sort()
          .join('|'),
        safelyCalculatedComponents: knownPolicies
          .filter((policy) => policy.inputMonetaryValue === null)
          .map((policy) => `${policy.proposedPolicyType}=${policy.proposedMonetaryValue}`)
          .sort()
          .join('|'),
        legacyTotalCustomerBenefit: offer.totalCustomerBenefit,
        knownPolicyValues: policyValues.join('|'),
        maximumAlternativePolicyValue: maximum === null ? null : money(maximum),
        sumOfAllPolicyValues: money(sum),
        comparableTotal: maximum === null ? null : money(maximum),
        calculatedKnownTotal: maximum === null ? '0.00' : money(maximum),
        absoluteDifference,
        percentageDifference,
        status,
        explanation,
        componentsIncluded: policyValues.join('|'),
        componentsExcluded: excluded.join('|'),
        reasonNotComparable,
        issueCodes: uniqueIssues(issues),
        informationalIssueCodes: uniqueIssues(informationalIssues),
      };
    });
}
