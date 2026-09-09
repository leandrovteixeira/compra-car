import type { CommercialPolicyType, PricingVoucherType } from '../entities/commercial-pricing';

export const COMMERCIAL_IMPORT_CONTRACT_VERSION = 'CommercialImportContract/1' as const;

export const COMMERCIAL_IMPORT_REQUIRED_SHEETS = [
  'Metadata',
  'Products',
  'Policies',
  'Offers',
  'OfferPolicies',
  'Issues',
  'Evidence',
] as const;

export type CommercialImportRequiredSheet = (typeof COMMERCIAL_IMPORT_REQUIRED_SHEETS)[number];

export const COMMERCIAL_IMPORT_COLUMNS = Object.freeze({
  Metadata: [
    'contract_version',
    'source_document_name',
    'source_document_sha256',
    'issuer_brand',
    'competence',
    'period_kind',
    'valid_from',
    'valid_to',
    'generated_at',
    'extraction_method',
    'prompt_version',
    'handbook_version',
    'source_channel',
    'notes',
  ],
  Products: [
    'product_external_key',
    'brand',
    'model',
    'version',
    'production_year',
    'model_year',
    'source_mvs',
    'source_page',
    'source_reference',
    'confidence_status',
    'confidence_score',
    'reason_code',
    'resolution_status',
    'resolved_product_id',
    'notes',
  ],
  Policies: [
    'policy_external_key',
    'product_external_key',
    'competence',
    'policy_type',
    'title',
    'description',
    'starts_on',
    'ends_on',
    'amount',
    'dealer_rebate_amount',
    'customer_benefit_amount',
    'value_origin',
    'term_months',
    'customer_interest_rate_monthly',
    'down_payment_percentage',
    'financed_principal',
    'annual_rate',
    'offer_month',
    'remaining_months',
    'coverage_years',
    'maintenance_count',
    'coverage_months',
    'coverage_km',
    'voucher_type',
    'calculation_base_price_id',
    'financial_parameter_set_id',
    'eligibility_or_restriction',
    'confidence_status',
    'confidence_score',
    'reason_code',
    'source_page',
    'source_reference',
    'notes',
  ],
  Offers: [
    'offer_external_key',
    'product_external_key',
    'competence',
    'valid_from',
    'valid_to',
    'public_price_id',
    'public_price_amount',
    'benefit_amount',
    'transactional_price',
    'confidence_status',
    'confidence_score',
    'reason_code',
    'source_page',
    'source_reference',
    'notes',
  ],
  OfferPolicies: ['offer_external_key', 'policy_external_key'],
  Issues: [
    'issue_external_key',
    'entity_type',
    'entity_key',
    'severity',
    'reason_code',
    'explanation',
    'decision_taken',
    'source_page',
    'source_reference',
    'prompt_version',
    'blocks_apply',
  ],
  Evidence: [
    'evidence_external_key',
    'entity_type',
    'entity_key',
    'source_document_name',
    'source_page',
    'table_or_block_reference',
    'cell_reference',
    'evidence_excerpt',
    'value_origin',
    'notes',
  ],
} as const satisfies Readonly<Record<CommercialImportRequiredSheet, readonly string[]>>);

export type CommercialImportPeriodKindV1 = 'monthly' | 'special';
export type CommercialImportConfidenceStatusV1 = 'high' | 'medium' | 'low' | 'review_required';
export type CommercialImportResolutionStatusV1 =
  'unresolved' | 'resolved' | 'ambiguous' | 'not_found';
export type CommercialImportIssueSeverityV1 = 'info' | 'warning' | 'error' | 'blocker';

export interface CommercialImportMetadataV1 {
  readonly contractVersion: string;
  readonly sourceDocumentName: string | null;
  readonly sourceDocumentSha256: string | null;
  readonly issuerBrand: string | null;
  readonly competence: string | null;
  readonly periodKind: CommercialImportPeriodKindV1 | string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly generatedAt: string | null;
  readonly extractionMethod: string | null;
  readonly promptVersion: string | null;
  readonly handbookVersion: string | null;
  readonly sourceChannel: string | null;
  readonly notes: string | null;
}

export interface CommercialImportProductV1 {
  readonly productExternalKey: string | null;
  readonly brand: string | null;
  readonly model: string | null;
  readonly version: string | null;
  readonly productionYear: number | null;
  readonly modelYear: number | null;
  readonly sourceMvs: string | null;
  readonly sourcePage: number | null;
  readonly sourceReference: string | null;
  readonly confidenceStatus: CommercialImportConfidenceStatusV1 | string | null;
  readonly confidenceScore: number | null;
  readonly reasonCode: string | null;
  readonly resolutionStatus: CommercialImportResolutionStatusV1 | string | null;
  readonly resolvedProductId: string | null;
  readonly notes: string | null;
}

export interface CommercialImportPolicyV1 {
  readonly policyExternalKey: string | null;
  readonly productExternalKey: string | null;
  readonly competence: string | null;
  readonly policyType: CommercialPolicyType | string | null;
  readonly title: string | null;
  readonly description: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly amount: string | null;
  readonly dealerRebateAmount: string | null;
  readonly customerBenefitAmount: string | null;
  readonly valueOrigin: string | null;
  readonly termMonths: number | null;
  readonly customerInterestRateMonthly: string | null;
  readonly downPaymentPercentage: string | null;
  readonly financedPrincipal: string | null;
  readonly annualRate: string | null;
  readonly offerMonth: number | null;
  readonly remainingMonths: number | null;
  readonly coverageYears: string | null;
  readonly maintenanceCount: number | null;
  readonly coverageMonths: number | null;
  readonly coverageKm: string | null;
  readonly voucherType: PricingVoucherType | string | null;
  readonly calculationBasePriceId: string | null;
  readonly financialParameterSetId: string | null;
  readonly eligibilityOrRestriction: string | null;
  readonly confidenceStatus: CommercialImportConfidenceStatusV1 | string | null;
  readonly confidenceScore: number | null;
  readonly reasonCode: string | null;
  readonly sourcePage: number | null;
  readonly sourceReference: string | null;
  readonly notes: string | null;
}

export interface CommercialImportOfferV1 {
  readonly offerExternalKey: string | null;
  readonly productExternalKey: string | null;
  readonly competence: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly publicPriceId: string | null;
  readonly publicPriceAmount: string | null;
  readonly benefitAmount: string | null;
  readonly transactionalPrice: string | null;
  readonly confidenceStatus: CommercialImportConfidenceStatusV1 | string | null;
  readonly confidenceScore: number | null;
  readonly reasonCode: string | null;
  readonly sourcePage: number | null;
  readonly sourceReference: string | null;
  readonly notes: string | null;
}

export interface CommercialImportOfferPolicyV1 {
  readonly offerExternalKey: string | null;
  readonly policyExternalKey: string | null;
}

export interface CommercialImportIssueV1 {
  readonly issueExternalKey: string | null;
  readonly entityType: string | null;
  readonly entityKey: string | null;
  readonly severity: CommercialImportIssueSeverityV1 | string | null;
  readonly reasonCode: string | null;
  readonly explanation: string | null;
  readonly decisionTaken: string | null;
  readonly sourcePage: number | null;
  readonly sourceReference: string | null;
  readonly promptVersion: string | null;
  readonly blocksApply: boolean | null;
}

export interface CommercialImportEvidenceV1 {
  readonly evidenceExternalKey: string | null;
  readonly entityType: string | null;
  readonly entityKey: string | null;
  readonly sourceDocumentName: string | null;
  readonly sourcePage: number | null;
  readonly tableOrBlockReference: string | null;
  readonly cellReference: string | null;
  readonly evidenceExcerpt: string | null;
  readonly valueOrigin: string | null;
  readonly notes: string | null;
}

export interface CommercialImportContractV1 {
  readonly metadata: CommercialImportMetadataV1;
  readonly products: readonly CommercialImportProductV1[];
  readonly policies: readonly CommercialImportPolicyV1[];
  readonly offers: readonly CommercialImportOfferV1[];
  readonly offerPolicies: readonly CommercialImportOfferPolicyV1[];
  readonly issues: readonly CommercialImportIssueV1[];
  readonly evidence: readonly CommercialImportEvidenceV1[];
}

export type CommercialImportDiagnosticCode =
  | 'INVALID_XLSX'
  | 'WORKBOOK_LIMIT_EXCEEDED'
  | 'MISSING_SHEET'
  | 'DUPLICATE_SHEET'
  | 'UNEXPECTED_SHEET'
  | 'MISSING_COLUMN'
  | 'DUPLICATE_COLUMN'
  | 'UNEXPECTED_COLUMN'
  | 'INVALID_CELL_TYPE'
  | 'INVALID_METADATA_CARDINALITY'
  | 'INVALID_CONTRACT_VERSION'
  | 'REQUIRED_VALUE_MISSING'
  | 'INVALID_VALUE'
  | 'DUPLICATE_KEY'
  | 'UNKNOWN_REFERENCE'
  | 'DUPLICATE_MEMBERSHIP';

export interface CommercialImportDiagnostic {
  readonly code: CommercialImportDiagnosticCode;
  readonly message: string;
  readonly sheet?: CommercialImportRequiredSheet | string;
  readonly row?: number;
  readonly column?: string;
}

export interface CommercialImportStructuralValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly CommercialImportDiagnostic[];
}

export class CommercialImportContractParseError extends Error {
  override readonly name = 'CommercialImportContractParseError';

  constructor(
    readonly diagnostics: readonly CommercialImportDiagnostic[],
    options?: ErrorOptions,
  ) {
    super(diagnostics[0]?.message ?? 'Commercial import workbook could not be parsed.', options);
  }
}
