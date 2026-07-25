export const issueCodes = [
  'ZERO_PUBLIC_PRICE',
  'CONFLICTING_PUBLIC_PRICE',
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
  'INVALID_OR_MISSING_VALIDITY',
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
  sourceIds: string[];
  productId: string;
  startsOn: string | null;
  legacyValue: string | null;
  proposedValue: string | null;
  classification: Classification;
  issueCodes: IssueCode[];
  deduplicationGroup: string;
  logicalFingerprint: string;
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
  | 'other';

export type CalculationMethod =
  'fixed_amount' | 'percentage_of_msrp' | 'present_value_subsidy' | 'manual_amount';

export interface PolicyCandidate {
  sourceId: string;
  productId: string;
  proposedPolicyType: PolicyType | null;
  calculationMethod: CalculationMethod | null;
  inputMonetaryValue: string | null;
  proposedMonetaryValue: string | null;
  startsOn: string | null;
  classification: Classification;
  issueCodes: IssueCode[];
  evidence: string;
  fingerprint: string;
}

export interface AccumulatorCandidate {
  sourceId: string;
  proposedPolicyFingerprints: string[];
  evidenceText: string;
  andOrClassification: 'ambiguous_text' | 'unknown';
  issueCodes: IssueCode[];
  automaticallyPublishable: false;
  fingerprint: string;
}

export interface ReconciliationRow {
  productId: string;
  offerMonth: string | null;
  sourceId: string;
  legacyPublicPrice: string | null;
  proposedPublicPrice: string | null;
  explicitBenefitInputs: string;
  safelyCalculatedComponents: string;
  legacyTotalCustomerBenefit: string | null;
  calculatedKnownTotal: string;
  absoluteDifference: string | null;
  percentageDifference: string | null;
  status: 'MATCH' | 'MISMATCH' | 'PARTIAL' | 'NOT_COMPARABLE';
  explanation: string;
  issueCodes: IssueCode[];
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
}

export interface BaselineDifference {
  metric: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface DryRunResult {
  summary: Record<string, unknown>;
  sourceInventory: SourceInventoryRow[];
  publicPriceCandidates: PublicPriceCandidate[];
  publicPriceConflicts: PublicPriceConflict[];
  policyCandidates: PolicyCandidate[];
  accumulatorCandidates: AccumulatorCandidate[];
  needsReview: CanonicalRow[];
  reconciliation: ReconciliationRow[];
  viewCoverage: ViewCoverageRow[];
  baselineDifferences: BaselineDifference[];
}
