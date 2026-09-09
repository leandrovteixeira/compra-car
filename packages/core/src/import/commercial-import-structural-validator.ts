import {
  CURRENT_COMMERCIAL_POLICY_TYPES,
  PRICING_VOUCHER_TYPES,
} from '../entities/commercial-pricing';
import {
  COMMERCIAL_IMPORT_CONTRACT_VERSION,
  type CommercialImportContractV1,
  type CommercialImportDiagnostic,
  type CommercialImportRequiredSheet,
  type CommercialImportStructuralValidationResult,
} from './commercial-import-contract';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const COMPETENCE = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
const SHA256 = /^[\da-f]{64}$/iu;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const CONFIDENCE_STATUSES = new Set(['high', 'medium', 'low', 'review_required']);
const RESOLUTION_STATUSES = new Set(['unresolved', 'resolved', 'ambiguous', 'not_found']);
const PERIOD_KINDS = new Set(['monthly', 'special']);
const ISSUE_SEVERITIES = new Set(['info', 'warning', 'error', 'blocker']);
const VALUE_ORIGINS = new Set(['direct', 'derived']);

function validDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function diagnostic(
  diagnostics: CommercialImportDiagnostic[],
  code: CommercialImportDiagnostic['code'],
  sheet: CommercialImportRequiredSheet,
  row: number,
  column: string,
  message: string,
): void {
  diagnostics.push({ code, sheet, row, column, message });
}

function required(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  row: number,
  column: string,
  value: string | null,
): value is string {
  if (value !== null && value.trim() !== '') return true;
  diagnostic(
    diagnostics,
    'REQUIRED_VALUE_MISSING',
    sheet,
    row,
    column,
    `${sheet}!${column} is required.`,
  );
  return false;
}

function validateDate(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  row: number,
  column: string,
  value: string | null,
  isRequired = false,
): void {
  if (!value) {
    if (isRequired) required(diagnostics, sheet, row, column, value);
    return;
  }
  if (!validDate(value))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      sheet,
      row,
      column,
      `${sheet}!${column} must be an ISO calendar date.`,
    );
}

function validateInteger(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  row: number,
  column: string,
  value: number | null,
  minimum = 1,
): void {
  if (value !== null && (!Number.isSafeInteger(value) || value < minimum))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      sheet,
      row,
      column,
      `${sheet}!${column} must be an integer greater than or equal to ${minimum}.`,
    );
}

function validateDecimal(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  row: number,
  column: string,
  value: string | null,
): void {
  if (value !== null && !DECIMAL.test(value))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      sheet,
      row,
      column,
      `${sheet}!${column} must be a non-negative canonical decimal.`,
    );
}

function validateConfidence(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  row: number,
  status: string | null,
  score: number | null,
): void {
  if (status !== null && !CONFIDENCE_STATUSES.has(status))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      sheet,
      row,
      'confidence_status',
      `${sheet}!confidence_status is unsupported.`,
    );
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      sheet,
      row,
      'confidence_score',
      `${sheet}!confidence_score must be between 0 and 100.`,
    );
}

function duplicateKeys(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  column: string,
  values: readonly (string | null)[],
): Set<string> {
  const known = new Set<string>();
  values.forEach((value, index) => {
    if (!value) return;
    if (known.has(value))
      diagnostic(
        diagnostics,
        'DUPLICATE_KEY',
        sheet,
        index + 2,
        column,
        `${sheet}!${column} duplicates ${value}.`,
      );
    known.add(value);
  });
  return known;
}

function validateCompetence(
  diagnostics: CommercialImportDiagnostic[],
  sheet: CommercialImportRequiredSheet,
  row: number,
  value: string | null,
  isRequired: boolean,
): void {
  if (!value) {
    if (isRequired) required(diagnostics, sheet, row, 'competence', value);
    return;
  }
  if (!COMPETENCE.test(value))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      sheet,
      row,
      'competence',
      `${sheet}!competence must use YYYY-MM.`,
    );
}

export function validateCommercialImportContractV1(
  contract: CommercialImportContractV1,
): CommercialImportStructuralValidationResult {
  const diagnostics: CommercialImportDiagnostic[] = [];
  const metadata = contract.metadata;
  if (metadata.contractVersion !== COMMERCIAL_IMPORT_CONTRACT_VERSION)
    diagnostic(
      diagnostics,
      'INVALID_CONTRACT_VERSION',
      'Metadata',
      2,
      'contract_version',
      `Expected ${COMMERCIAL_IMPORT_CONTRACT_VERSION}.`,
    );
  required(diagnostics, 'Metadata', 2, 'issuer_brand', metadata.issuerBrand);
  validateCompetence(diagnostics, 'Metadata', 2, metadata.competence, true);
  if (!metadata.periodKind || !PERIOD_KINDS.has(metadata.periodKind))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      'Metadata',
      2,
      'period_kind',
      'Metadata!period_kind must be monthly or special.',
    );
  validateDate(diagnostics, 'Metadata', 2, 'valid_from', metadata.validFrom, true);
  validateDate(diagnostics, 'Metadata', 2, 'valid_to', metadata.validTo, false);
  if (metadata.validFrom && metadata.validTo && metadata.validTo < metadata.validFrom)
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      'Metadata',
      2,
      'valid_to',
      'Metadata!valid_to cannot precede valid_from.',
    );
  if (metadata.sourceDocumentSha256 && !SHA256.test(metadata.sourceDocumentSha256))
    diagnostic(
      diagnostics,
      'INVALID_VALUE',
      'Metadata',
      2,
      'source_document_sha256',
      'Metadata!source_document_sha256 must contain 64 hexadecimal characters.',
    );

  contract.products.forEach((product, index) => {
    const row = index + 2;
    required(diagnostics, 'Products', row, 'product_external_key', product.productExternalKey);
    required(diagnostics, 'Products', row, 'brand', product.brand);
    required(diagnostics, 'Products', row, 'model', product.model);
    required(diagnostics, 'Products', row, 'version', product.version);
    validateInteger(diagnostics, 'Products', row, 'production_year', product.productionYear, 1900);
    validateInteger(diagnostics, 'Products', row, 'model_year', product.modelYear, 1900);
    validateInteger(diagnostics, 'Products', row, 'source_page', product.sourcePage);
    validateConfidence(
      diagnostics,
      'Products',
      row,
      product.confidenceStatus,
      product.confidenceScore,
    );
    if (product.resolutionStatus !== null && !RESOLUTION_STATUSES.has(product.resolutionStatus))
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Products',
        row,
        'resolution_status',
        'Products!resolution_status is unsupported.',
      );
  });
  const productKeys = duplicateKeys(
    diagnostics,
    'Products',
    'product_external_key',
    contract.products.map((item) => item.productExternalKey),
  );

  contract.policies.forEach((policy, index) => {
    const row = index + 2;
    required(diagnostics, 'Policies', row, 'policy_external_key', policy.policyExternalKey);
    if (
      required(diagnostics, 'Policies', row, 'product_external_key', policy.productExternalKey) &&
      !productKeys.has(policy.productExternalKey)
    )
      diagnostic(
        diagnostics,
        'UNKNOWN_REFERENCE',
        'Policies',
        row,
        'product_external_key',
        `Unknown Product ${policy.productExternalKey}.`,
      );
    validateCompetence(diagnostics, 'Policies', row, policy.competence, true);
    if (!policy.policyType || !CURRENT_COMMERCIAL_POLICY_TYPES.includes(policy.policyType as never))
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Policies',
        row,
        'policy_type',
        'Policies!policy_type is unsupported or deprecated.',
      );
    required(diagnostics, 'Policies', row, 'title', policy.title);
    validateDate(diagnostics, 'Policies', row, 'starts_on', policy.startsOn, true);
    validateDate(diagnostics, 'Policies', row, 'ends_on', policy.endsOn);
    if (policy.startsOn && policy.endsOn && policy.endsOn < policy.startsOn)
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Policies',
        row,
        'ends_on',
        'Policies!ends_on cannot precede starts_on.',
      );
    for (const [column, value] of [
      ['amount', policy.amount],
      ['dealer_rebate_amount', policy.dealerRebateAmount],
      ['customer_benefit_amount', policy.customerBenefitAmount],
      ['customer_interest_rate_monthly', policy.customerInterestRateMonthly],
      ['down_payment_percentage', policy.downPaymentPercentage],
      ['financed_principal', policy.financedPrincipal],
      ['annual_rate', policy.annualRate],
      ['coverage_years', policy.coverageYears],
      ['coverage_km', policy.coverageKm],
    ] as const)
      validateDecimal(diagnostics, 'Policies', row, column, value);
    for (const [column, value] of [
      ['term_months', policy.termMonths],
      ['offer_month', policy.offerMonth],
      ['remaining_months', policy.remainingMonths],
      ['maintenance_count', policy.maintenanceCount],
      ['coverage_months', policy.coverageMonths],
      ['source_page', policy.sourcePage],
    ] as const)
      validateInteger(diagnostics, 'Policies', row, column, value);
    if (policy.voucherType !== null && !PRICING_VOUCHER_TYPES.includes(policy.voucherType as never))
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Policies',
        row,
        'voucher_type',
        'Policies!voucher_type is unsupported.',
      );
    if (policy.valueOrigin !== null && !VALUE_ORIGINS.has(policy.valueOrigin))
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Policies',
        row,
        'value_origin',
        'Policies!value_origin must be direct or derived.',
      );
    validateConfidence(
      diagnostics,
      'Policies',
      row,
      policy.confidenceStatus,
      policy.confidenceScore,
    );
  });
  const policyKeys = duplicateKeys(
    diagnostics,
    'Policies',
    'policy_external_key',
    contract.policies.map((item) => item.policyExternalKey),
  );

  contract.offers.forEach((offer, index) => {
    const row = index + 2;
    required(diagnostics, 'Offers', row, 'offer_external_key', offer.offerExternalKey);
    if (
      required(diagnostics, 'Offers', row, 'product_external_key', offer.productExternalKey) &&
      !productKeys.has(offer.productExternalKey)
    )
      diagnostic(
        diagnostics,
        'UNKNOWN_REFERENCE',
        'Offers',
        row,
        'product_external_key',
        `Unknown Product ${offer.productExternalKey}.`,
      );
    validateCompetence(diagnostics, 'Offers', row, offer.competence, true);
    validateDate(diagnostics, 'Offers', row, 'valid_from', offer.validFrom, true);
    validateDate(diagnostics, 'Offers', row, 'valid_to', offer.validTo);
    if (offer.validFrom && offer.validTo && offer.validTo < offer.validFrom)
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Offers',
        row,
        'valid_to',
        'Offers!valid_to cannot precede valid_from.',
      );
    for (const [column, value] of [
      ['public_price_amount', offer.publicPriceAmount],
      ['benefit_amount', offer.benefitAmount],
      ['transactional_price', offer.transactionalPrice],
    ] as const)
      validateDecimal(diagnostics, 'Offers', row, column, value);
    validateInteger(diagnostics, 'Offers', row, 'source_page', offer.sourcePage);
    validateConfidence(diagnostics, 'Offers', row, offer.confidenceStatus, offer.confidenceScore);
  });
  const offerKeys = duplicateKeys(
    diagnostics,
    'Offers',
    'offer_external_key',
    contract.offers.map((item) => item.offerExternalKey),
  );

  const memberships = new Set<string>();
  contract.offerPolicies.forEach((membership, index) => {
    const row = index + 2;
    const offerPresent = required(
      diagnostics,
      'OfferPolicies',
      row,
      'offer_external_key',
      membership.offerExternalKey,
    );
    const policyPresent = required(
      diagnostics,
      'OfferPolicies',
      row,
      'policy_external_key',
      membership.policyExternalKey,
    );
    if (offerPresent && !offerKeys.has(membership.offerExternalKey))
      diagnostic(
        diagnostics,
        'UNKNOWN_REFERENCE',
        'OfferPolicies',
        row,
        'offer_external_key',
        `Unknown Offer ${membership.offerExternalKey}.`,
      );
    if (policyPresent && !policyKeys.has(membership.policyExternalKey))
      diagnostic(
        diagnostics,
        'UNKNOWN_REFERENCE',
        'OfferPolicies',
        row,
        'policy_external_key',
        `Unknown Policy ${membership.policyExternalKey}.`,
      );
    if (offerPresent && policyPresent) {
      const key = `${membership.offerExternalKey}\u0000${membership.policyExternalKey}`;
      if (memberships.has(key))
        diagnostic(
          diagnostics,
          'DUPLICATE_MEMBERSHIP',
          'OfferPolicies',
          row,
          'policy_external_key',
          'Offer/Policy membership is duplicated.',
        );
      memberships.add(key);
    }
  });

  contract.issues.forEach((issue, index) => {
    const row = index + 2;
    required(diagnostics, 'Issues', row, 'issue_external_key', issue.issueExternalKey);
    required(diagnostics, 'Issues', row, 'entity_type', issue.entityType);
    required(diagnostics, 'Issues', row, 'entity_key', issue.entityKey);
    if (!issue.severity || !ISSUE_SEVERITIES.has(issue.severity))
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Issues',
        row,
        'severity',
        'Issues!severity is unsupported.',
      );
    required(diagnostics, 'Issues', row, 'reason_code', issue.reasonCode);
    required(diagnostics, 'Issues', row, 'explanation', issue.explanation);
    validateInteger(diagnostics, 'Issues', row, 'source_page', issue.sourcePage);
    if (issue.blocksApply === null)
      diagnostic(
        diagnostics,
        'REQUIRED_VALUE_MISSING',
        'Issues',
        row,
        'blocks_apply',
        'Issues!blocks_apply is required.',
      );
  });
  duplicateKeys(
    diagnostics,
    'Issues',
    'issue_external_key',
    contract.issues.map((item) => item.issueExternalKey),
  );

  contract.evidence.forEach((evidence, index) => {
    const row = index + 2;
    required(diagnostics, 'Evidence', row, 'evidence_external_key', evidence.evidenceExternalKey);
    required(diagnostics, 'Evidence', row, 'entity_type', evidence.entityType);
    required(diagnostics, 'Evidence', row, 'entity_key', evidence.entityKey);
    validateInteger(diagnostics, 'Evidence', row, 'source_page', evidence.sourcePage);
    required(diagnostics, 'Evidence', row, 'evidence_excerpt', evidence.evidenceExcerpt);
    if (evidence.valueOrigin !== null && !VALUE_ORIGINS.has(evidence.valueOrigin))
      diagnostic(
        diagnostics,
        'INVALID_VALUE',
        'Evidence',
        row,
        'value_origin',
        'Evidence!value_origin must be direct or derived.',
      );
  });
  duplicateKeys(
    diagnostics,
    'Evidence',
    'evidence_external_key',
    contract.evidence.map((item) => item.evidenceExternalKey),
  );

  return { ok: diagnostics.length === 0, diagnostics };
}
