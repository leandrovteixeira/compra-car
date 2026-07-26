import Decimal from 'decimal.js';

import { logicalFingerprint } from './canonical.js';
import { constantPayment, presentValue } from './finance.js';
import { LEGACY_CDI_PARAMETER_SET, validFinancialParameterSet } from './financial-parameters.js';
import { decimal, money, positive } from './money.js';
import type {
  AccumulatorCandidate,
  CommercialOfferCandidate,
  Classification,
  IssueCode,
  FinancialParameterSet,
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
  return `${offer.productId}|${validityForMonth(offer.offerMonth).validFrom ?? 'NULL'}`;
}

function candidateId(prefix: string, value: unknown): string {
  return `${prefix}-${logicalFingerprint(prefix, value).slice(0, 16)}`;
}

export function validityForMonth(value: string | null): {
  validFrom: string | null;
  validTo: string | null;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value ?? '');
  if (!match) return { validFrom: null, validTo: null };
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return { validFrom: null, validTo: null };
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    validFrom: `${match[1]}-${match[2]}-01`,
    validTo: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  };
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
        startsOn: validityForMonth(first.offerMonth).validFrom,
        sourceIds: ordered.map((offer) => offer.id),
        distinctValues,
        issueCode: 'CONFLICTING_PUBLIC_PRICE',
        automaticWinner: null,
      });
      candidates.push({
        candidatePriceId: candidateId('price', { groupKey, values: distinctValues }),
        sourceIds: ordered.map((offer) => offer.id),
        productId: first.productId,
        startsOn: first.offerMonth,
        endsOn: validityForMonth(first.offerMonth).validTo,
        priceType: 'msrp',
        sourceSystem: 'legacy',
        sourceReference: `product_price_offers:${groupKey}`,
        status: 'draft',
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
      candidatePriceId: candidateId('price', { groupKey, value: proposedValue }),
      sourceIds: ordered.map((offer) => offer.id),
      productId: first.productId,
      startsOn: validityForMonth(first.offerMonth).validFrom,
      endsOn: validityForMonth(first.offerMonth).validTo,
      priceType: 'msrp',
      sourceSystem: 'legacy',
      sourceReference: `product_price_offers:${groupKey}`,
      status: 'draft',
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
  dealerRebateAmount?: string | null;
  dealerRebateAllocationMethod?: PolicyCandidate['dealerRebateAllocationMethod'];
  legacyPolicySource?: string | null;
  legacySourceColumn?: string | null;
  annualRate?: string | null;
  remainingMonths?: number | null;
  financedPrincipal?: string | null;
  promotionalPayment?: string | null;
  promotionalTotalPaid?: string | null;
  referencePayment?: string | null;
  referenceTotalPaid?: string | null;
  totalPaidBenefit?: string | null;
  financialParameterSetId?: string | null;
  financialParameterSetVersion?: number | null;
  financialCalculationMethod?: string | null;
  classification: Classification;
  issueCodes?: IssueCode[];
  evidence: string;
}

function policyCandidate(input: PolicyInput): PolicyCandidate {
  const commercialOfferId = `offer-${input.offer.id}`;
  const candidate: PolicyCandidate = {
    candidatePolicyId: '',
    commercialOfferId,
    calculationBasePriceId: null,
    sourceId: input.offer.id,
    productId: input.offer.productId,
    proposedPolicyType: input.proposedPolicyType,
    calculationMethod: input.calculationMethod,
    inputMonetaryValue: input.inputMonetaryValue,
    proposedMonetaryValue: input.proposedMonetaryValue,
    dealerRebateAmount: input.dealerRebateAmount ?? null,
    dealerRebateAllocationMethod: input.dealerRebateAllocationMethod ?? null,
    dealerRebateAllocationBase: null,
    dealerRebateAllocationPercentage: null,
    dealerRebateRoundingResidual: null,
    legacyPolicySource: input.legacyPolicySource ?? null,
    legacySourceColumn: input.legacySourceColumn ?? null,
    legacyDealerRebateValue: input.dealerRebateAmount ?? null,
    fixedAmount: input.calculationMethod === 'fixed_amount' ? input.proposedMonetaryValue : null,
    percentageRate: null,
    voucherType: null,
    policyParameters: {},
    annualRate: input.annualRate ?? null,
    coverageYears: null,
    remainingMonths: input.remainingMonths ?? null,
    financedPrincipal: input.financedPrincipal ?? null,
    promotionalPayment: input.promotionalPayment ?? null,
    promotionalTotalPaid: input.promotionalTotalPaid ?? null,
    referencePayment: input.referencePayment ?? null,
    referenceTotalPaid: input.referenceTotalPaid ?? null,
    promotionalPresentValue: null,
    referencePresentValue: null,
    totalPaidBenefit: input.totalPaidBenefit ?? null,
    financialParameterSetId: input.financialParameterSetId ?? null,
    financialParameterSetVersion: input.financialParameterSetVersion ?? null,
    financialCalculationMethod: input.financialCalculationMethod ?? null,
    startsOn: validityForMonth(input.offer.offerMonth).validFrom,
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
    dealerRebateAmount: candidate.dealerRebateAmount,
    proposedPolicyType: candidate.proposedPolicyType,
    sourceId: candidate.sourceId,
    startsOn: candidate.startsOn,
  });
  candidate.candidatePolicyId = candidateId('policy', candidate.fingerprint);
  return candidate;
}

function explicitMoneyCandidate(
  offer: LegacyOffer,
  field: string,
  value: string | null,
  rebate: string | null,
  type: 'retail_bonus' | 'trade_in_bonus',
): PolicyCandidate | null {
  const parsed = decimal(value);
  const parsedRebate = decimal(rebate);
  if (
    (parsed === null || parsed.lessThanOrEqualTo(0)) &&
    (parsedRebate === null || parsedRebate.lessThanOrEqualTo(0))
  )
    return null;
  const negative = parsed?.isNegative() ?? false;
  const nonPositive = parsed === null || parsed.lessThanOrEqualTo(0);
  return policyCandidate({
    offer,
    proposedPolicyType: type,
    calculationMethod: 'fixed_amount',
    inputMonetaryValue: parsed === null ? null : money(parsed),
    proposedMonetaryValue: nonPositive ? null : money(parsed),
    dealerRebateAmount: parsedRebate?.greaterThan(0) === true ? money(parsedRebate) : null,
    dealerRebateAllocationMethod:
      parsedRebate?.greaterThan(0) === true ? 'explicit_legacy_component' : null,
    legacyPolicySource: field,
    legacySourceColumn: field,
    classification: nonPositive ? 'needs_review' : 'classifiable_with_reconciliation',
    issueCodes: negative ? ['NEGATIVE_ECONOMIC_VALUE'] : [],
    evidence: `${field}=${parsed === null ? 'NULL' : money(parsed)};dealer_rebate=${parsedRebate === null ? 'NULL' : money(parsedRebate)}`,
  });
}

function offerMonthNumber(value: string | null): number | null {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/u.exec(value ?? '');
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? month : null;
}

export function classifyPolicies(
  offers: LegacyOffer[],
  insurancePercentage: string | null,
  knownProductIds?: Set<string>,
  financialParameterSets: FinancialParameterSet[] = [LEGACY_CDI_PARAMETER_SET],
): PolicyCandidate[] {
  const candidates: PolicyCandidate[] = [];
  void insurancePercentage;

  for (const offer of [...offers].sort((left, right) => compareIds(left.id, right.id))) {
    const retail = explicitMoneyCandidate(
      offer,
      'retail_bonus',
      offer.retailBonus,
      offer.retailRebate,
      'retail_bonus',
    );
    if (retail) candidates.push(retail);
    const tradeIn = explicitMoneyCandidate(
      offer,
      'trade_in_bonus',
      offer.tradeInBonus,
      offer.tradeInRebate,
      'trade_in_bonus',
    );
    if (tradeIn) candidates.push(tradeIn);

    const allFinancingNull =
      offer.subsidizedRateMonthly === null &&
      offer.downPaymentPercent === null &&
      offer.installments === null;
    const allFinancingZero =
      decimal(offer.subsidizedRateMonthly)?.isZero() === true &&
      decimal(offer.downPaymentPercent)?.isZero() === true &&
      offer.installments === 0;
    const financingFieldsPresent =
      !allFinancingNull &&
      !allFinancingZero &&
      (offer.subsidizedRateMonthly !== null ||
        offer.downPaymentPercent !== null ||
        offer.installments !== null ||
        decimal(offer.rateRebate)?.isZero() === false);
    if (financingFieldsPresent) {
      const rate = decimal(offer.subsidizedRateMonthly);
      const downPayment = decimal(offer.downPaymentPercent);
      const publicPrice = decimal(offer.publicPrice);
      const rateRebate = decimal(offer.rateRebate);
      const parameterSet = validFinancialParameterSet(financialParameterSets, offer.offerMonth);
      const complete =
        rate !== null &&
        !rate.isNegative() &&
        downPayment !== null &&
        downPayment.greaterThanOrEqualTo(0) &&
        downPayment.lessThanOrEqualTo(100) &&
        offer.installments !== null &&
        offer.installments > 0 &&
        publicPrice !== null &&
        publicPrice.greaterThan(0) &&
        parameterSet !== null;
      let proposedMonetaryValue: string | null = null;
      let financedPrincipal: string | null = null;
      let promotionalPayment: string | null = null;
      let promotionalTotalPaid: string | null = null;
      let referencePayment: string | null = null;
      let referenceTotalPaid: string | null = null;
      let totalPaidBenefit: string | null = null;
      let promotionalPresentValue: string | null = null;
      let referencePresentValue: string | null = null;
      const financeIssues: IssueCode[] = [];
      if (!complete) financeIssues.push('INCOMPLETE_FINANCING_TERMS');
      if (parameterSet === null) financeIssues.push('UNPUBLISHED_FINANCIAL_PARAMETER_SET');
      if (
        complete &&
        parameterSet !== null &&
        publicPrice !== null &&
        downPayment !== null &&
        rate !== null &&
        offer.installments !== null
      ) {
        const principal = publicPrice.mul(new Decimal(1).minus(downPayment.div(100)));
        const promotionalRate = rate.div(100);
        const referenceRate = new Decimal(parameterSet.monthlyCombinedReferenceRate);
        const promotional = constantPayment(principal, promotionalRate, offer.installments);
        const reference = constantPayment(principal, referenceRate, offer.installments);
        const promotionalTotal = promotional.mul(offer.installments);
        const referenceTotal = reference.mul(offer.installments);
        const promotionalPv = presentValue(promotional, referenceRate, offer.installments);
        const referencePv = presentValue(reference, referenceRate, offer.installments);
        const officialBenefit = referencePv.minus(promotionalPv);
        financedPrincipal = money(principal);
        promotionalPayment = money(promotional);
        promotionalTotalPaid = money(promotionalTotal);
        referencePayment = money(reference);
        referenceTotalPaid = money(referenceTotal);
        totalPaidBenefit = money(referenceTotal.minus(promotionalTotal));
        promotionalPresentValue = money(promotionalPv);
        referencePresentValue = money(referencePv);
        if (officialBenefit.isNegative()) financeIssues.push('NEGATIVE_ECONOMIC_VALUE');
        else proposedMonetaryValue = money(officialBenefit);
      }
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'subsidized_financing',
          calculationMethod: 'discounted_promotional_cash_flow_difference',
          inputMonetaryValue: null,
          proposedMonetaryValue,
          dealerRebateAmount: rateRebate?.greaterThan(0) === true ? money(rateRebate) : null,
          dealerRebateAllocationMethod:
            rateRebate?.greaterThan(0) === true ? 'explicit_legacy_component' : null,
          legacyPolicySource: 'subsidized_rate_monthly',
          legacySourceColumn: 'rate_rebate',
          financedPrincipal,
          promotionalPayment,
          promotionalTotalPaid,
          referencePayment,
          referenceTotalPaid,
          totalPaidBenefit,
          financialParameterSetId: parameterSet?.id ?? null,
          financialParameterSetVersion: parameterSet?.version ?? null,
          financialCalculationMethod: parameterSet?.calculationMethod ?? null,
          classification:
            financeIssues.length === 0 ? 'classifiable_with_reconciliation' : 'needs_review',
          issueCodes: financeIssues,
          evidence: `rate=${offer.subsidizedRateMonthly ?? 'NULL'};down_payment=${offer.downPaymentPercent ?? 'NULL'};installments=${offer.installments ?? 'NULL'};public_price=${offer.publicPrice ?? 'NULL'};rate_rebate=${offer.rateRebate ?? 'NULL'};parameter_set=${parameterSet?.id ?? 'NULL'};official_method=discounted_promotional_cash_flow_difference;promotional_present_value=${promotionalPresentValue ?? 'NULL'};reference_present_value=${referencePresentValue ?? 'NULL'};diagnostic_method=reference_total_paid-promotional_total_paid`,
        }),
      );
      const added = candidates.at(-1);
      if (added?.proposedPolicyType === 'subsidized_financing') {
        added.promotionalPresentValue = promotionalPresentValue;
        added.referencePresentValue = referencePresentValue;
      }
    }

    const insuranceYears = decimal(offer.insuranceYears);
    if (insuranceYears !== null && !insuranceYears.isZero()) {
      const invalid = insuranceYears.isNegative();
      const publicPrice = decimal(offer.publicPrice);
      const canCalculate = !invalid && publicPrice !== null && publicPrice.greaterThan(0);
      const calculated = canCalculate ? money(publicPrice.mul('0.03').mul(insuranceYears)) : null;
      const insurance = policyCandidate({
        offer,
        proposedPolicyType: 'free_insurance',
        calculationMethod: 'percentage_of_msrp',
        inputMonetaryValue: null,
        proposedMonetaryValue: calculated,
        classification: canCalculate ? 'classifiable_with_reconciliation' : 'needs_review',
        annualRate: '0.030000',
        issueCodes: invalid
          ? ['INVALID_INSURANCE_YEARS']
          : publicPrice === null || publicPrice.lessThanOrEqualTo(0)
            ? ['INSURANCE_NON_POSITIVE_PUBLIC_PRICE']
            : [],
        evidence: `insurance_years=${offer.insuranceYears};annual_rate=0.03;public_price=${offer.publicPrice ?? 'NULL'}`,
      });
      insurance.coverageYears = offer.insuranceYears;
      candidates.push(insurance);
    }

    if (offer.ipvaIncluded) {
      const publicPrice = decimal(offer.publicPrice);
      const month = offerMonthNumber(offer.offerMonth);
      const issues: IssueCode[] = [];
      if (publicPrice === null) issues.push('IPVA_MISSING_PUBLIC_PRICE');
      else if (publicPrice.lessThanOrEqualTo(0)) issues.push('IPVA_NON_POSITIVE_PUBLIC_PRICE');
      if (month === null) issues.push('IPVA_INVALID_OFFER_MONTH');
      const remainingMonths = month === null ? null : 13 - month;
      const calculated =
        issues.length === 0 && publicPrice !== null && remainingMonths !== null
          ? money(publicPrice.mul('0.04').mul(remainingMonths).div(12))
          : null;
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'free_ipva',
          calculationMethod: 'proportional_ipva',
          inputMonetaryValue: null,
          proposedMonetaryValue: calculated,
          annualRate: '0.040000',
          remainingMonths,
          classification: issues.length === 0 ? 'classifiable_with_reconciliation' : 'needs_review',
          issueCodes: issues,
          evidence: `ipva_included=true;annual_rate=0.04;remaining_months=${remainingMonths ?? 'NULL'};source=legacy_proportional_ipva_rule`,
        }),
      );
    }

    const others = decimal(offer.othersBonus);
    if (others !== null && !others.isZero()) {
      const issues: IssueCode[] = [];
      if (others.isNegative()) issues.push('NEGATIVE_ECONOMIC_VALUE');
      candidates.push(
        policyCandidate({
          offer,
          proposedPolicyType: 'other',
          calculationMethod: 'fixed_amount',
          inputMonetaryValue: money(others),
          proposedMonetaryValue: others.isNegative() ? null : money(others),
          classification: issues.length > 0 ? 'needs_review' : 'classifiable_with_reconciliation',
          issueCodes: issues,
          evidence: `others_bonus=${money(others)};description=${offer.notes ?? ''}`,
          legacyPolicySource: 'others_bonus',
          legacySourceColumn: 'others_bonus',
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

export function linkOfferAggregate(
  offers: LegacyOffer[],
  prices: PublicPriceCandidate[],
  policies: PolicyCandidate[],
): CommercialOfferCandidate[] {
  const priceBySource = new Map<string, PublicPriceCandidate>();
  for (const price of prices)
    for (const sourceId of price.sourceIds) priceBySource.set(sourceId, price);
  const policiesBySource = new Map<string, PolicyCandidate[]>();
  for (const policy of policies)
    policiesBySource.set(policy.sourceId, [
      ...(policiesBySource.get(policy.sourceId) ?? []),
      policy,
    ]);

  for (const policy of policies) {
    const price = priceBySource.get(policy.sourceId);
    policy.calculationBasePriceId = [
      'free_ipva',
      'free_insurance',
      'subsidized_financing',
    ].includes(policy.proposedPolicyType ?? '')
      ? (price?.candidatePriceId ?? null)
      : null;
  }

  return [...offers]
    .sort((a, b) => compareIds(a.id, b.id))
    .map((offer) => {
      const price = priceBySource.get(offer.id);
      const validPrice =
        price !== undefined && price.proposedValue !== null && price.issueCodes.length === 0;
      const validity = validityForMonth(offer.offerMonth);
      const sourcePolicies = policiesBySource.get(offer.id) ?? [];
      const blocking = uniqueIssues([
        ...knownValidityIssues(validity.validFrom, offer.productId),
        ...(price?.issueCodes ?? []),
        ...(!validPrice ? ['MISSING_PUBLIC_PRICE' as IssueCode] : []),
      ]);
      return {
        candidateOfferId: `offer-${offer.id}`,
        legacySourceId: offer.id,
        productId: offer.productId,
        publicPriceCandidateId: validPrice ? price.candidatePriceId : null,
        validFrom: validity.validFrom,
        validTo: validity.validTo,
        status: 'draft',
        sourceSystem: 'legacy',
        sourceReference: `product_price_offers:${offer.id}`,
        policyCount: sourcePolicies.length,
        accumulatorCandidateId: sourcePolicies.length >= 2 ? `accumulator-${offer.id}` : null,
        blockingIssueCodes: blocking,
        informationalIssueCodes: [],
        fingerprint: logicalFingerprint('commercial-offer', {
          sourceId: offer.id,
          productId: offer.productId,
          priceId: price?.candidatePriceId ?? null,
          validity,
        }),
      };
    });
}

function knownValidityIssues(validFrom: string | null, productId: string): IssueCode[] {
  return validFrom === null || productId === '' ? ['INVALID_OR_MISSING_VALIDITY'] : [];
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
    const fingerprints = members.map((candidate) => candidate.fingerprint).sort();
    suggestions.push({
      candidateAccumulatorId: `accumulator-${offer.id}`,
      commercialOfferId: `offer-${offer.id}`,
      sourceId: offer.id,
      proposedPolicyFingerprints: fingerprints,
      evidenceText,
      relationType: 'OR',
      relationOrigin: 'legacy_default',
      status: 'draft',
      issueCodes: [],
      automaticallyPublishable: false,
      fingerprint: logicalFingerprint('accumulator-suggestion', {
        sourceId: offer.id,
        members: fingerprints,
        relationType: 'OR',
        relationOrigin: 'legacy_default',
      }),
    });
  }
  return suggestions.sort((left, right) => compareIds(left.sourceId, right.sourceId));
}

export function hasPositiveExplicitBenefit(offer: LegacyOffer): boolean {
  return positive(offer.retailBonus) || positive(offer.tradeInBonus) || positive(offer.othersBonus);
}
