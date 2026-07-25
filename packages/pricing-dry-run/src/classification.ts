import Decimal from 'decimal.js';

import { logicalFingerprint } from './canonical.js';
import { decimal, money, nonZero, positive } from './money.js';
import type {
  AccumulatorCandidate,
  Classification,
  IssueCode,
  LegacyOffer,
  PolicyCandidate,
  PublicPriceCandidate,
  PublicPriceConflict,
} from './types.js';

function compareIds(left: string, right: string): number {
  return left.localeCompare(right, 'en', { numeric: true });
}

function uniqueIssues(issues: IssueCode[]): IssueCode[] {
  return [...new Set(issues)].sort();
}

function normalizedMoney(value: string | null): string | null {
  const parsed = decimal(value);
  return parsed === null ? null : money(parsed);
}

function priceGroupKey(offer: LegacyOffer): string {
  return `${offer.productId}|${offer.offerMonth ?? 'NULL'}`;
}

export function classifyPublicPrices(
  offers: LegacyOffer[],
  knownProductIds: Set<string>,
): { candidates: PublicPriceCandidate[]; conflicts: PublicPriceConflict[] } {
  const groups = new Map<string, LegacyOffer[]>();
  for (const offer of offers) {
    const key = priceGroupKey(offer);
    groups.set(key, [...(groups.get(key) ?? []), offer]);
  }

  const candidates: PublicPriceCandidate[] = [];
  const conflicts: PublicPriceConflict[] = [];
  for (const [groupKey, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const ordered = [...group].sort((left, right) => compareIds(left.id, right.id));
    const first = ordered[0];
    if (!first) continue;

    const distinctValues = [
      ...new Set(ordered.map((offer) => normalizedMoney(offer.publicPrice) ?? 'NULL')),
    ].sort();
    const issues: IssueCode[] = [];
    if (!knownProductIds.has(first.productId)) issues.push('MISSING_PRODUCT_MATCH');
    if (first.offerMonth === null) issues.push('INVALID_OR_MISSING_VALIDITY');

    if (distinctValues.length > 1) {
      issues.push('CONFLICTING_PUBLIC_PRICE');
      conflicts.push({
        productId: first.productId,
        startsOn: first.offerMonth,
        sourceIds: ordered.map((offer) => offer.id),
        distinctValues,
        issueCode: 'CONFLICTING_PUBLIC_PRICE',
        automaticWinner: null,
      });
      candidates.push({
        sourceIds: ordered.map((offer) => offer.id),
        productId: first.productId,
        startsOn: first.offerMonth,
        legacyValue: distinctValues.join('|'),
        proposedValue: null,
        classification: 'needs_review',
        issueCodes: uniqueIssues(issues),
        deduplicationGroup: groupKey,
        logicalFingerprint: logicalFingerprint('price-conflict', {
          productId: first.productId,
          startsOn: first.offerMonth,
          values: distinctValues,
        }),
      });
      continue;
    }

    const value = decimal(first.publicPrice);
    let classification: Classification =
      ordered.length > 1 ? 'classifiable_with_reconciliation' : 'auto_classifiable';
    let proposedValue = value === null ? null : money(value);
    if (value === null) {
      classification = 'source_only';
      proposedValue = null;
    } else if (value.isZero()) {
      classification = 'needs_review';
      issues.push('ZERO_PUBLIC_PRICE');
    } else if (value.isNegative()) {
      classification = 'needs_review';
      issues.push('NEGATIVE_ECONOMIC_VALUE');
      proposedValue = null;
    }
    if (
      issues.some((issue) =>
        ['MISSING_PRODUCT_MATCH', 'INVALID_OR_MISSING_VALIDITY'].includes(issue),
      )
    ) {
      classification = 'needs_review';
    }

    candidates.push({
      sourceIds: ordered.map((offer) => offer.id),
      productId: first.productId,
      startsOn: first.offerMonth,
      legacyValue: value === null ? null : money(value),
      proposedValue,
      classification,
      issueCodes: uniqueIssues(issues),
      deduplicationGroup: groupKey,
      logicalFingerprint: logicalFingerprint('public-price', {
        productId: first.productId,
        startsOn: first.offerMonth,
        value: proposedValue,
      }),
    });
  }

  return { candidates, conflicts };
}

export function validateCandidateMoney(candidate: PolicyCandidate): IssueCode[] {
  const issues: IssueCode[] = [];
  const explicitMethod =
    candidate.calculationMethod === 'fixed_amount' ||
    candidate.calculationMethod === 'manual_amount';
  if (explicitMethod && candidate.inputMonetaryValue === null) {
    issues.push('MISSING_INPUT_MONETARY_VALUE');
  }
  if (!explicitMethod && candidate.inputMonetaryValue !== null) {
    issues.push('UNEXPECTED_INPUT_MONETARY_VALUE');
  }
  if (
    explicitMethod &&
    candidate.inputMonetaryValue !== null &&
    candidate.proposedMonetaryValue !== null &&
    !new Decimal(candidate.inputMonetaryValue).equals(candidate.proposedMonetaryValue)
  ) {
    issues.push('INPUT_ECONOMIC_VALUE_MISMATCH');
  }
  return issues;
}

interface PolicyInput {
  offer: LegacyOffer;
  proposedPolicyType: PolicyCandidate['proposedPolicyType'];
  calculationMethod: PolicyCandidate['calculationMethod'];
  inputMonetaryValue: string | null;
  proposedMonetaryValue: string | null;
  classification: Classification;
  issueCodes?: IssueCode[];
  evidence: string;
}

function policyCandidate(input: PolicyInput): PolicyCandidate {
  const candidate: PolicyCandidate = {
    sourceId: input.offer.id,
    productId: input.offer.productId,
    proposedPolicyType: input.proposedPolicyType,
    calculationMethod: input.calculationMethod,
    inputMonetaryValue: input.inputMonetaryValue,
    proposedMonetaryValue: input.proposedMonetaryValue,
    startsOn: input.offer.offerMonth,
    classification: input.classification,
    issueCodes: [],
    evidence: input.evidence,
    fingerprint: '',
  };
  candidate.issueCodes = uniqueIssues([
    ...(input.issueCodes ?? []),
    ...validateCandidateMoney(candidate),
  ]);
  if (candidate.issueCodes.length > 0 && candidate.classification !== 'source_only') {
    candidate.classification = 'needs_review';
  }
  candidate.fingerprint = logicalFingerprint('policy-suggestion', {
    calculationMethod: candidate.calculationMethod,
    inputMonetaryValue: candidate.inputMonetaryValue,
    productId: candidate.productId,
    proposedMonetaryValue: candidate.proposedMonetaryValue,
    proposedPolicyType: candidate.proposedPolicyType,
    sourceId: candidate.sourceId,
    startsOn: candidate.startsOn,
  });
  return candidate;
}

function explicitMoneyCandidate(
  offer: LegacyOffer,
  field: string,
  value: string | null,
  type: 'retail_bonus' | 'trade_in_bonus',
): PolicyCandidate | null {
  const parsed = decimal(value);
  if (parsed === null || parsed.isZero()) return null;
  const negative = parsed.isNegative();
  return policyCandidate({
    offer,
    proposedPolicyType: type,
    calculationMethod: 'fixed_amount',
    inputMonetaryValue: money(parsed),
    proposedMonetaryValue: negative ? null : money(parsed),
    classification: negative ? 'needs_review' : 'classifiable_with_reconciliation',
    issueCodes: negative ? ['NEGATIVE_ECONOMIC_VALUE'] : [],
    evidence: `${field}=${money(parsed)}`,
  });
}

export function classifyPolicies(
  offers: LegacyOffer[],
  insurancePercentage: string | null,
  knownProductIds?: Set<string>,
): PolicyCandidate[] {
  const candidates: PolicyCandidate[] = [];
  const insuranceRate = decimal(insurancePercentage);

  for (const offer of [...offers].sort((left, right) => compareIds(left.id, right.id))) {
    const retail = explicitMoneyCandidate(offer, 'retail_bonus', offer.retailBonus, 'retail_bonus');
    if (retail) candidates.push(retail);
    const tradeIn = explicitMoneyCandidate(
      offer,
      'trade_in_bonus',
      offer.tradeInBonus,
      'trade_in_bonus',
    );
    if (tradeIn) candidates.push(tradeIn);

    const financingFieldsPresent =
      offer.subsidizedRateMonthly !== null ||
      offer.downPaymentPercent !== null ||
      offer.installments !== null;
    if (financingFieldsPresent) {
      const rate = decimal(offer.subsidizedRateMonthly);
      const downPayment = decimal(offer.downPaymentPercent);
      const complete =
        rate !== null &&
        !rate.isNegative() &&
        downPayment !== null &&
        !downPayment.isNegative() &&
        offer.installments !== null &&
        offer.installments > 0;
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'subsidized_financing',
          calculationMethod: 'present_value_subsidy',
          inputMonetaryValue: null,
          proposedMonetaryValue: null,
          classification: 'needs_review',
          issueCodes: complete
            ? ['UNPUBLISHED_FINANCIAL_PARAMETER_SET']
            : ['INCOMPLETE_FINANCING_TERMS'],
          evidence: `rate=${offer.subsidizedRateMonthly ?? ''};down_payment=${offer.downPaymentPercent ?? ''};installments=${offer.installments ?? ''}`,
        }),
      );
    }

    const insuranceYears = decimal(offer.insuranceYears);
    if (insuranceYears !== null && !insuranceYears.isZero()) {
      const invalid = insuranceYears.isNegative();
      const publicPrice = decimal(offer.publicPrice);
      const canCalculate =
        !invalid && insuranceRate !== null && publicPrice !== null && publicPrice.greaterThan(0);
      const calculated = canCalculate
        ? money(publicPrice.mul(insuranceRate).div(100).mul(insuranceYears))
        : null;
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'free_insurance',
          calculationMethod: 'percentage_of_msrp',
          inputMonetaryValue: null,
          proposedMonetaryValue: calculated,
          classification: canCalculate ? 'classifiable_with_reconciliation' : 'needs_review',
          issueCodes: invalid
            ? ['NEGATIVE_ECONOMIC_VALUE']
            : insuranceRate === null
              ? ['AMBIGUOUS_POLICY_TYPE']
              : [],
          evidence: `insurance_years=${offer.insuranceYears};simulation_percentage=${insurancePercentage ?? 'NOT_ADOPTED'}`,
        }),
      );
    }

    if (offer.ipvaIncluded) {
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'free_ipva',
          calculationMethod: 'percentage_of_msrp',
          inputMonetaryValue: null,
          proposedMonetaryValue: null,
          classification: 'needs_review',
          issueCodes: ['SUSPICIOUS_IPVA_FLAG'],
          evidence: 'ipva_included=true;percentage=NOT_ASSUMED',
        }),
      );
    }

    const others = decimal(offer.othersBonus);
    if (others !== null && !others.isZero()) {
      const issues: IssueCode[] = [];
      if (others.isNegative()) issues.push('NEGATIVE_ECONOMIC_VALUE');
      if ((offer.notes ?? '').trim() === '') issues.push('MISSING_POLICY_DESCRIPTION');
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'other',
          calculationMethod: 'manual_amount',
          inputMonetaryValue: money(others),
          proposedMonetaryValue: others.isNegative() ? null : money(others),
          classification: issues.length > 0 ? 'needs_review' : 'classifiable_with_reconciliation',
          issueCodes: issues,
          evidence: `others_bonus=${money(others)};description=${offer.notes ?? ''}`,
        }),
      );
    }

    const rebateEvidence = [
      ['retail_rebate', offer.retailRebate],
      ['trade_in_rebate', offer.tradeInRebate],
      ['rate_rebate', offer.rateRebate],
    ].filter(([, value]) => nonZero(value ?? null));
    if (rebateEvidence.length > 0) {
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: null,
          calculationMethod: null,
          inputMonetaryValue: null,
          proposedMonetaryValue: null,
          classification: 'needs_review',
          issueCodes: ['UNSUPPORTED_REBATE_FIELD'],
          evidence: rebateEvidence.map(([field, value]) => `${field}=${value}`).join(';'),
        }),
      );
    }
    if (nonZero(offer.totalDealerRebate)) {
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: null,
          calculationMethod: null,
          inputMonetaryValue: null,
          proposedMonetaryValue: null,
          classification: 'source_only',
          issueCodes: ['UNSUPPORTED_REBATE_FIELD'],
          evidence: `total_dealer_rebate=${offer.totalDealerRebate}`,
        }),
      );
    }
  }

  if (knownProductIds) {
    for (const candidate of candidates) {
      if (!knownProductIds.has(candidate.productId)) {
        candidate.issueCodes = uniqueIssues([...candidate.issueCodes, 'MISSING_PRODUCT_MATCH']);
        if (candidate.classification !== 'source_only') candidate.classification = 'needs_review';
      }
    }
  }

  return candidates.sort((left, right) =>
    `${left.sourceId}|${left.proposedPolicyType ?? ''}|${left.evidence}`.localeCompare(
      `${right.sourceId}|${right.proposedPolicyType ?? ''}|${right.evidence}`,
      'en',
      { numeric: true },
    ),
  );
}

export function classifyAccumulatorSuggestions(
  offers: LegacyOffer[],
  policies: PolicyCandidate[],
): AccumulatorCandidate[] {
  const policiesBySource = new Map<string, PolicyCandidate[]>();
  for (const policy of policies.filter((candidate) => candidate.proposedPolicyType !== null)) {
    policiesBySource.set(policy.sourceId, [
      ...(policiesBySource.get(policy.sourceId) ?? []),
      policy,
    ]);
  }

  const suggestions: AccumulatorCandidate[] = [];
  for (const offer of offers) {
    const members = policiesBySource.get(offer.id) ?? [];
    if (members.length < 2) continue;
    const evidenceText = offer.notes ?? '';
    const ambiguousText = /(?:\bOR\b|\bOU\b|\/)/iu.test(evidenceText);
    const fingerprints = members.map((candidate) => candidate.fingerprint).sort();
    suggestions.push({
      sourceId: offer.id,
      proposedPolicyFingerprints: fingerprints,
      evidenceText,
      andOrClassification: ambiguousText ? 'ambiguous_text' : 'unknown',
      issueCodes: ['AMBIGUOUS_AND_OR_RELATION'],
      automaticallyPublishable: false,
      fingerprint: logicalFingerprint('accumulator-suggestion', {
        sourceId: offer.id,
        members: fingerprints,
      }),
    });
  }
  return suggestions.sort((left, right) => compareIds(left.sourceId, right.sourceId));
}

export function hasPositiveExplicitBenefit(offer: LegacyOffer): boolean {
  return positive(offer.retailBonus) || positive(offer.tradeInBonus) || positive(offer.othersBonus);
}
