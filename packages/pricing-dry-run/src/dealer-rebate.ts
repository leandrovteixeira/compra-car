import Decimal from 'decimal.js';

import { decimal, money, percentage } from './money.js';
import { isRebateEligiblePolicy, REBATE_ELIGIBLE_POLICY_TYPES } from './policy-rules.js';
import type {
  DealerRebateAllocationRow,
  IssueCode,
  LegacyOffer,
  PolicyCandidate,
  PolicyType,
} from './types.js';

const policyOrder = new Map<PolicyType, number>(
  REBATE_ELIGIBLE_POLICY_TYPES.map((type, index) => [type, index]),
);

function comparePolicies(left: PolicyCandidate, right: PolicyCandidate): number {
  const typeDifference =
    (policyOrder.get(left.proposedPolicyType ?? 'other') ?? 99) -
    (policyOrder.get(right.proposedPolicyType ?? 'other') ?? 99);
  if (typeDifference !== 0) return typeDifference;
  const sourceDifference = left.sourceId.localeCompare(right.sourceId, 'en', { numeric: true });
  return sourceDifference !== 0
    ? sourceDifference
    : left.candidatePolicyId.localeCompare(right.candidatePolicyId);
}

function isPositive(value: string | null): boolean {
  return decimal(value)?.greaterThan(0) === true;
}

function allocationRow(
  offer: LegacyOffer,
  policy: PolicyCandidate | null,
  method: DealerRebateAllocationRow['allocationMethod'],
  issues: IssueCode[] = [],
): DealerRebateAllocationRow {
  return {
    legacyOfferId: offer.id,
    sourceRowId: offer.id,
    productId: offer.productId,
    policyCandidateId: policy?.candidatePolicyId ?? null,
    policyType: policy?.proposedPolicyType ?? null,
    legacyTotalDealerRebate: offer.totalDealerRebate,
    legacyRetailRebate: offer.retailRebate,
    legacyTradeInRebate: offer.tradeInRebate,
    legacyRateRebate: offer.rateRebate,
    customerBenefitAmount: policy?.proposedMonetaryValue ?? null,
    eligibleForRebate: isRebateEligiblePolicy(policy?.proposedPolicyType ?? null),
    allocationBase: policy?.dealerRebateAllocationBase ?? null,
    allocationPercentage: policy?.dealerRebateAllocationPercentage ?? null,
    dealerRebateAmount: policy?.dealerRebateAmount ?? null,
    allocationMethod: method,
    roundingResidual: policy?.dealerRebateRoundingResidual ?? null,
    issueCodes: issues,
    classification: issues.length > 0 ? 'needs_review' : 'classifiable_with_reconciliation',
    reconciliationDifference: null,
  };
}

export function allocateDealerRebates(
  offers: LegacyOffer[],
  inputPolicies: PolicyCandidate[],
): { policies: PolicyCandidate[]; rows: DealerRebateAllocationRow[] } {
  const policies = inputPolicies.map((policy) => ({ ...policy }));
  const policiesBySource = new Map<string, PolicyCandidate[]>();
  for (const policy of policies)
    policiesBySource.set(policy.sourceId, [
      ...(policiesBySource.get(policy.sourceId) ?? []),
      policy,
    ]);

  const rows: DealerRebateAllocationRow[] = [];
  for (const offer of [...offers].sort((a, b) =>
    a.id.localeCompare(b.id, 'en', { numeric: true }),
  )) {
    const sourcePolicies = policiesBySource.get(offer.id) ?? [];
    const explicit = [offer.retailRebate, offer.tradeInRebate, offer.rateRebate].some(isPositive);
    const legacyTotal = decimal(offer.totalDealerRebate);

    if (explicit) {
      for (const policy of sourcePolicies
        .filter((item) => item.dealerRebateAllocationMethod === 'explicit_legacy_component')
        .sort(comparePolicies)) {
        policy.dealerRebateAllocationBase = policy.proposedMonetaryValue;
        policy.dealerRebateAllocationPercentage = null;
        policy.dealerRebateRoundingResidual = '0.00';
        rows.push(allocationRow(offer, policy, 'explicit_legacy_component'));
      }
      continue;
    }
    if (legacyTotal?.greaterThan(0) !== true) continue;

    const eligible = sourcePolicies
      .filter(
        (policy) =>
          isRebateEligiblePolicy(policy.proposedPolicyType) &&
          policy.classification !== 'needs_review' &&
          !policy.issueCodes.includes('NEGATIVE_ECONOMIC_VALUE') &&
          decimal(policy.proposedMonetaryValue)?.greaterThan(0) === true,
      )
      .sort(comparePolicies);
    const base = eligible.reduce(
      (sum, policy) => sum.plus(policy.proposedMonetaryValue ?? 0),
      new Decimal(0),
    );
    if (eligible.length === 0 || base.lessThanOrEqualTo(0)) {
      rows.push(
        allocationRow(offer, null, 'unallocated_legacy_total', [
          'UNALLOCATED_LEGACY_DEALER_REBATE',
        ]),
      );
      continue;
    }

    let allocated = new Decimal(0);
    eligible.forEach((policy, index) => {
      const benefit = new Decimal(policy.proposedMonetaryValue ?? 0);
      const raw = legacyTotal.mul(benefit).div(base);
      const finalAmount =
        index === eligible.length - 1
          ? legacyTotal.minus(allocated)
          : raw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      allocated = allocated.plus(finalAmount);
      policy.dealerRebateAmount = money(finalAmount);
      policy.dealerRebateAllocationMethod = 'proportional_legacy_total';
      policy.dealerRebateAllocationBase = money(base);
      policy.dealerRebateAllocationPercentage = percentage(benefit.div(base).mul(100));
      policy.dealerRebateRoundingResidual = money(finalAmount.minus(raw));
      policy.legacyDealerRebateValue = money(legacyTotal);
      policy.legacyPolicySource = 'total_dealer_rebate';
      policy.legacySourceColumn = 'total_dealer_rebate';
      rows.push(allocationRow(offer, policy, 'proportional_legacy_total'));
    });
  }

  return { policies, rows };
}
