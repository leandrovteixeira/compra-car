export const issueCodes = [
  'ZERO_PUBLIC_PRICE',
  'CONFLICTING_PUBLIC_PRICE',
  'MISSING_PUBLIC_PRICE',
  'MISSING_PRODUCT_MATCH',
  'AMBIGUOUS_POLICY_TYPE',
  'MISSING_POLICY_DESCRIPTION',
  'MISSING_INPUT_MONETARY_VALUE',
  'UNEXPECTED_INPUT_MONETARY_VALUE',
  'INPUT_ECONOMIC_VALUE_MISMATCH',
  'INCOMPLETE_FINANCING_TERMS',
  'UNPUBLISHED_FINANCIAL_PARAMETER_SET',
  'AMBIGUOUS_AND_OR_RELATION',
  'LEGACY_TOTAL_MISMATCH',
  'NEGATIVE_ECONOMIC_VALUE',
  'SUSPICIOUS_IPVA_FLAG',
  'UNSUPPORTED_REBATE_FIELD',
  'DEALER_REBATE_TOTAL_MISMATCH',
  'IPVA_MISSING_PUBLIC_PRICE',
  'IPVA_INVALID_OFFER_MONTH',
  'IPVA_NON_POSITIVE_PUBLIC_PRICE',
  'INSURANCE_NON_POSITIVE_PUBLIC_PRICE',
  'INVALID_INSURANCE_YEARS',
  'INVALID_OR_MISSING_VALIDITY',
  'LEGACY_CALCULATION_METHOD_DIFFERENCE',
  'UNALLOCATED_LEGACY_DEALER_REBATE',
  'REGISTRATION_NON_POSITIVE_PUBLIC_PRICE',
] as const;

export type IssueCode = (typeof issueCodes)[number];
export type Classification =
  'auto_classifiable' | 'classifiable_with_reconciliation' | 'needs_review' | 'source_only';

export interface LegacyOffer {
  id: string;
  productId: string;
  offerMonth: string | null;
  publicPrice: string | null;
  retailBonus: string | null;
  retailRebate: string | null;
  tradeInBonus: string | null;
  tradeInRebate: string | null;
  subsidizedRateMonthly: string | null;
  downPaymentPercent: string | null;
  installments: number | null;
  rateRebate: string | null;
  insuranceYears: string | null;
  ipvaIncluded: boolean;
  othersBonus: string | null;
  totalCustomerBenefit: string | null;
  totalDealerRebate: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface LegacyProduct {
  id: string;
  isActive: boolean;
}

export interface LegacyImport {
  id: string;
  validFrom: string | null;
  validTo: string | null;
  status: string | null;
}

export interface LegacyImportRow {
  id: string;
  importId: string | null;
  productId: string | null;
  publicPrice: string | null;
  rawText: string | null;
  status: string | null;
}

export type CanonicalRow = Record<string, boolean | number | string | null>;

export interface SourceSnapshot {
  databaseIdentity: string;
  offers: LegacyOffer[];
  products: LegacyProduct[];
  imports: LegacyImport[];
  importRows: LegacyImportRow[];
  stagingRows: CanonicalRow[];
  productSpecs: CanonicalRow[];
  specs: CanonicalRow[];
  legacyViewProductIds: string[];
  v2ViewProductIds: string[];
  sprint9ObjectCounts: Record<string, number>;
}

export interface PublicPriceCandidate {
  candidatePriceId: string;
  sourceIds: string[];
  productId: string;
  startsOn: string | null;
  endsOn: string | null;
  priceType: 'msrp';
  sourceSystem: 'legacy';
  sourceReference: string;
  status: 'draft';
  legacyValue: string | null;
  proposedValue: string | null;
  classification: Classification;
  issueCodes: IssueCode[];
  deduplicationGroup: string;
  logicalFingerprint: string;
}

export interface CommercialOfferCandidate {
  candidateOfferId: string;
  legacySourceId: string;
  productId: string;
  publicPriceCandidateId: string | null;
  validFrom: string | null;
  validTo: string | null;
  status: 'draft';
  sourceSystem: 'legacy';
  sourceReference: string;
  policyCount: number;
  accumulatorCandidateId: string | null;
  blockingIssueCodes: IssueCode[];
  informationalIssueCodes: IssueCode[];
  fingerprint: string;
}

export interface PublicPriceConflict {
  productId: string;
  startsOn: string | null;
  sourceIds: string[];
  distinctValues: string[];
  issueCode: 'CONFLICTING_PUBLIC_PRICE';
  automaticWinner: null;
}

export type PolicyType =
  | 'retail_bonus'
  | 'trade_in_bonus'
  | 'subsidized_financing'
  | 'free_ipva'
  | 'free_insurance'
  | 'free_wallbox'
  | 'free_registration'
  | 'free_maintenance'
  | 'fuel_or_recharge_voucher'
  | 'other';

export type CalculationMethod =
  | 'fixed_amount'
  | 'percentage_of_msrp'
  | 'proportional_ipva'
  | 'discounted_promotional_cash_flow_difference'
  | 'non_monetized'
  | 'manual_amount';

export type DealerRebateAllocationMethod =
  'explicit_legacy_component' | 'proportional_legacy_total' | 'unallocated_legacy_total';

export type VoucherType = 'fuel' | 'electric_recharge' | 'unspecified';

export interface FinancialParameterSet {
  id: string;
  version: number;
  name: string;
  annualReferenceRate: string;
  monthlyReferenceRate: string;
  monthlySpreadRate: string;
  monthlyCombinedReferenceRate: string;
  rateType: 'CDI';
  validFrom: string;
  validTo: string | null;
  status: 'published' | 'draft';
  publishedAt: string | null;
  calculationMethod: 'effective_annual_to_monthly_compound';
  notes: string;
}

export interface PolicyCandidate {
  candidatePolicyId: string;
  commercialOfferId: string;
  calculationBasePriceId: string | null;
  sourceId: string;
  productId: string;
  proposedPolicyType: PolicyType | null;
  calculationMethod: CalculationMethod | null;
  inputMonetaryValue: string | null;
  proposedMonetaryValue: string | null;
  dealerRebateAmount: string | null;
  dealerRebateAllocationMethod: DealerRebateAllocationMethod | null;
  dealerRebateAllocationBase: string | null;
  dealerRebateAllocationPercentage: string | null;
  dealerRebateRoundingResidual: string | null;
  legacyPolicySource: string | null;
  legacySourceColumn: string | null;
  legacyDealerRebateValue: string | null;
  fixedAmount: string | null;
  percentageRate: string | null;
  voucherType: VoucherType | null;
  policyParameters: CanonicalRow;
  annualRate: string | null;
  coverageYears: string | null;
  remainingMonths: number | null;
  financedPrincipal: string | null;
  promotionalPayment: string | null;
  promotionalTotalPaid: string | null;
  referencePayment: string | null;
  referenceTotalPaid: string | null;
  promotionalPresentValue: string | null;
  referencePresentValue: string | null;
  totalPaidBenefit: string | null;
  financialParameterSetId: string | null;
  financialParameterSetVersion: number | null;
  financialCalculationMethod: string | null;
  startsOn: string | null;
  classification: Classification;
  issueCodes: IssueCode[];
  evidence: string;
  fingerprint: string;
}

export interface AccumulatorCandidate {
  candidateAccumulatorId: string;
  commercialOfferId: string;
  sourceId: string;
  proposedPolicyFingerprints: string[];
  evidenceText: string;
  relationType: 'OR';
  relationOrigin: 'legacy_default';
  status: 'draft';
  issueCodes: IssueCode[];
  automaticallyPublishable: false;
  fingerprint: string;
}

export interface ReconciliationRow {
  commercialOfferCandidateId: string;
  productId: string;
  offerMonth: string | null;
  sourceId: string;
  legacyPublicPrice: string | null;
  proposedPublicPrice: string | null;
  explicitBenefitInputs: string;
  safelyCalculatedComponents: string;
  legacyTotalCustomerBenefit: string | null;
  knownPolicyValues: string;
  maximumAlternativePolicyValue: string | null;
  sumOfAllPolicyValues: string;
  comparableTotal: string | null;
  calculatedKnownTotal: string;
  absoluteDifference: string | null;
  percentageDifference: string | null;
  status: 'MATCH' | 'MISMATCH' | 'PARTIAL' | 'NOT_COMPARABLE';
  explanation: string;
  componentsIncluded: string;
  componentsExcluded: string;
  reasonNotComparable: string | null;
  issueCodes: IssueCode[];
  informationalIssueCodes: IssueCode[];
}

export interface DealerRebateReconciliationRow {
  commercialOfferCandidateId: string;
  sourceId: string;
  retailRebate: string | null;
  tradeInRebate: string | null;
  rateRebate: string | null;
  structuredTotal: string;
  allocatedTotal: string;
  legacyTotal: string | null;
  absoluteDifference: string | null;
  explanation: string;
  componentsPresent: string;
  componentsMissing: string;
  issueCodes: IssueCode[];
}

export interface DealerRebateAllocationRow {
  legacyOfferId: string;
  sourceRowId: string;
  productId: string;
  policyCandidateId: string | null;
  policyType: PolicyType | null;
  legacyTotalDealerRebate: string | null;
  legacyRetailRebate: string | null;
  legacyTradeInRebate: string | null;
  legacyRateRebate: string | null;
  customerBenefitAmount: string | null;
  eligibleForRebate: boolean;
  allocationBase: string | null;
  allocationPercentage: string | null;
  dealerRebateAmount: string | null;
  allocationMethod: DealerRebateAllocationMethod;
  roundingResidual: string | null;
  issueCodes: IssueCode[];
  classification: Classification;
  reconciliationDifference: string | null;
}

export interface FinancingAnalysisRow {
  commercialOfferCandidateId: string;
  sourceId: string;
  productId: string;
  offerMonth: string | null;
  promotionalMonthlyRate: string | null;
  downPaymentPercent: string | null;
  installments: number | null;
  financedPrincipal: string | null;
  dealerRebate: string | null;
  missingRate: boolean;
  missingDownPayment: boolean;
  missingInstallments: boolean;
  missingPublicPrice: boolean;
  missingParameterSet: boolean;
  classification: Classification;
  issueCodes: IssueCode[];
}

export interface OfferPolicySummaryRow {
  offerCandidateId: string;
  legacySourceId: string;
  price: string | null;
  retailBonus: string | null;
  tradeInBonus: string | null;
  subsidizedFinancing: string | null;
  freeIpva: string | null;
  freeInsurance: string | null;
  other: string | null;
  policyCount: number;
  relationType: 'OR' | null;
  bestCustomerBenefit: string | null;
  legacyTotalCustomerBenefit: string | null;
  difference: string | null;
  reviewStatus: string;
}

export interface ValidationSampleRow extends CanonicalRow {
  category: string;
  source_id: string;
  source_table: string;
  product_id: string;
  offer_month: string | null;
  policy_type: string | null;
  classification: string;
  issue_codes: string;
  justification: string;
}

export interface ViewCoverageRow {
  productId: string;
  activeProduct: boolean;
  hasActiveSpecs: boolean;
  hasLegacyCurrentPrice: boolean;
  hasNewCurrentPriceCandidate: boolean;
  eligibleForV2: boolean;
  absenceReason:
    | ''
    | 'NO_ACTIVE_SPECS'
    | 'NO_LEGACY_CURRENT_PRICE'
    | 'NO_NEW_CURRENT_PRICE_CANDIDATE'
    | 'INACTIVE_PRODUCT'
    | 'OTHER';
}

export interface SourceInventoryRow {
  sourceTable: string;
  sourceCount: number;
  distinctProducts: number;
  minBusinessDate: string | null;
  maxBusinessDate: string | null;
  logicalHash: string;
}

export interface DryRunOptions {
  algorithmVersion: string;
  cutoffDate: string | null;
  insurancePercentage: string | null;
  executedAt: string;
  excludeExecutedAtFromHash: boolean;
  failOnSourceChange: boolean;
  financialParameterSets?: FinancialParameterSet[];
}

export interface BaselineDifference {
  metric: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface DryRunResult {
  summary: Record<string, unknown>;
  commercialOfferCandidates: CommercialOfferCandidate[];
  sourceInventory: SourceInventoryRow[];
  publicPriceCandidates: PublicPriceCandidate[];
  publicPriceConflicts: PublicPriceConflict[];
  policyCandidates: PolicyCandidate[];
  accumulatorCandidates: AccumulatorCandidate[];
  needsReview: CanonicalRow[];
  reconciliation: ReconciliationRow[];
  dealerRebateReconciliation: DealerRebateReconciliationRow[];
  dealerRebateAllocations: DealerRebateAllocationRow[];
  financingAnalysis: FinancingAnalysisRow[];
  financingMissingSummary: CanonicalRow[];
  offerPolicySummary: OfferPolicySummaryRow[];
  informationalIssues: CanonicalRow[];
  validationSamples: ValidationSampleRow[];
  validationSampleSummary: Record<string, number>;
  viewCoverage: ViewCoverageRow[];
  baselineDifferences: BaselineDifference[];
}
