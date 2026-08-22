export const IMPORT_PROCESSING_JOB_STATUSES = [
  'queued',
  'processing',
  'succeeded',
  'failed',
] as const;
export const IMPORT_PROCESSING_LEASE_SECONDS = 900;
export const IMPORT_PROCESSING_MAX_PAYLOAD_BYTES = 256 * 1024;
export const IMPORT_PROCESSING_MAX_ROWS = 100;
export type ImportProcessingJobStatus = (typeof IMPORT_PROCESSING_JOB_STATUSES)[number];

export interface ExtractionDocument {
  readonly id: string;
  readonly ordinal?: number;
  readonly role: string;
  readonly mimeType: 'application/pdf';
  readonly contentSha256: string;
  readonly originalFileName: string;
  readonly bytes: Uint8Array;
}
export interface ExtractionRequest {
  readonly documents: readonly ExtractionDocument[];
  readonly schemaVersion: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly instructions: string;
}
export interface ExtractionUsage {
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly totalUnits?: number;
}
export interface ExtractionResult {
  readonly providerRunId: string;
  readonly payloads: readonly unknown[];
  readonly usage: ExtractionUsage;
}
export interface ExtractionProvider {
  readonly key: string;
  readonly version: string;
  extract(request: ExtractionRequest): Promise<ExtractionResult>;
}

export class ExtractionProviderRegistry {
  private readonly providers = new Map<string, ExtractionProvider>();
  register(provider: ExtractionProvider): void {
    if (this.providers.has(provider.key)) throw new Error(`Provider duplicado: ${provider.key}.`);
    this.providers.set(provider.key, provider);
  }
  require(key: string): ExtractionProvider {
    const provider = this.providers.get(key);
    if (!provider) throw new Error(`Provider de extração não registrado: ${key}.`);
    return provider;
  }
}

export interface ProductMatchCandidate {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly externalCodes: readonly string[];
}
export interface ProductMatchInput {
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly externalCodes?: readonly string[];
}
export type ProductMatchResult =
  | {
      readonly status: 'confirmed';
      readonly selected: ProductMatchCandidate;
      readonly method: 'external_code' | 'business_key';
    }
  | { readonly status: 'ambiguous'; readonly candidates: readonly ProductMatchCandidate[] }
  | { readonly status: 'suggested'; readonly candidates: readonly ProductMatchCandidate[] }
  | { readonly status: 'unmatched'; readonly candidates: readonly [] };

const normalize = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
const tokens = (value: string): readonly string[] =>
  normalize(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
export function matchProduct(
  input: ProductMatchInput,
  catalog: readonly ProductMatchCandidate[],
): ProductMatchResult {
  for (const externalCode of input.externalCodes ?? []) {
    if (!externalCode.trim()) continue;
    const code = normalize(externalCode);
    const exactCode = catalog.filter((product) =>
      product.externalCodes.some((item) => normalize(item) === code),
    );
    if (exactCode.length === 1)
      return { status: 'confirmed', selected: exactCode[0]!, method: 'external_code' };
    if (exactCode.length > 1) return { status: 'ambiguous', candidates: exactCode };
  }
  const key = [input.brand, input.model, input.version, input.modelYear, input.productionYear].map(
    normalize,
  );
  const exact = catalog.filter((product) =>
    [product.brand, product.model, product.version, product.modelYear, product.productionYear]
      .map(normalize)
      .every((part, index) => part === key[index]),
  );
  if (exact.length === 1)
    return { status: 'confirmed', selected: exact[0]!, method: 'business_key' };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact };
  const wanted = new Set(tokens(`${input.brand} ${input.model} ${input.version}`));
  const suggestions = catalog.filter((product) => {
    const available = new Set(tokens(`${product.brand} ${product.model} ${product.version}`));
    return wanted.size > 0 && [...wanted].every((token) => available.has(token));
  });
  return suggestions.length
    ? { status: 'suggested', candidates: suggestions }
    : { status: 'unmatched', candidates: [] };
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown, field: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${field} inválido.`);
  return value as JsonObject;
};
const fieldValue = (payload: JsonObject, field: string): string => {
  const wrapper = object(object(payload.mmv, 'mmv')[field], `mmv.${field}`);
  if (wrapper.value === null && (field === 'modelYear' || field === 'productionYear')) return '';
  if (typeof wrapper.value !== 'string' || !wrapper.value.trim())
    throw new Error(`mmv.${field}.value inválido.`);
  return wrapper.value.trim();
};

export class CommercialLetterPayloadValidationError extends Error {
  constructor(
    readonly issues: readonly string[],
    readonly referenceIntegrity?: CommercialLetterReferenceIntegrityDiagnostic,
  ) {
    super(`Payload canônico inválido (${issues.length} violação(ões)).`);
    this.name = 'CommercialLetterPayloadValidationError';
  }
}

export interface CommercialLetterReferenceIntegrityDiagnostic {
  readonly policyCount: number;
  readonly offerCount: number;
  readonly referenceCount: number;
  readonly orphanReferenceCount: number;
  readonly deterministicRemappingCount: number;
  readonly affectedOfferPaths: readonly string[];
}

export function analyzeCommercialLetterReferenceIntegrity(
  payload: Readonly<JsonObject>,
): CommercialLetterReferenceIntegrityDiagnostic {
  const policies = Array.isArray(payload.policies) ? (payload.policies as JsonObject[]) : [];
  const offers = Array.isArray(payload.offers) ? (payload.offers as JsonObject[]) : [];
  const knownPolicies = new Set(policies.map((policy) => String(policy.clientPolicyId)));
  let referenceCount = 0;
  let orphanReferenceCount = 0;
  const affectedOfferPaths: string[] = [];
  offers.forEach((offer, index) => {
    const references = Array.isArray(offer.policyClientIds)
      ? (offer.policyClientIds as unknown[]).map(String)
      : [];
    referenceCount += references.length;
    const orphanCount = references.filter((id) => !knownPolicies.has(id)).length;
    orphanReferenceCount += orphanCount;
    if (orphanCount) affectedOfferPaths.push(`/offers/${index}/policyClientIds`);
  });
  return Object.freeze({
    policyCount: policies.length,
    offerCount: offers.length,
    referenceCount,
    orphanReferenceCount,
    // No Policy transformation currently exists, so there is no legitimate remapping source.
    deterministicRemappingCount: 0,
    affectedOfferPaths: Object.freeze(affectedOfferPaths),
  });
}

export type ConfidenceBand = 'high' | 'medium' | 'low';

export function deriveConfidenceBand(score: number): ConfidenceBand {
  if (!Number.isInteger(score) || score < 0 || score > 100)
    throw new CommercialLetterPayloadValidationError(['/confidence/score: invalid']);
  return score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
}

function normalizeConfidenceBands(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => normalizeConfidenceBands(item, `${path}/${index}`));
    return;
  }
  const current = value as JsonObject;
  for (const [key, nested] of Object.entries(current)) {
    const nestedPath = `${path}/${key}`;
    if (key === 'confidence' || key === 'overallConfidence') {
      const confidence = object(nested, nestedPath);
      try {
        confidence.band = deriveConfidenceBand(confidence.score as number);
      } catch (error) {
        if (error instanceof CommercialLetterPayloadValidationError)
          throw new CommercialLetterPayloadValidationError([`${nestedPath}/score: invalid`]);
        throw error;
      }
    } else {
      normalizeConfidenceBands(nested, nestedPath);
    }
  }
}

export function validateCommercialLetterInvariants(payload: JsonObject): void {
  const errors: string[] = [];
  const policies = payload.policies as JsonObject[];
  const offers = payload.offers as JsonObject[];
  const issues = payload.issues as JsonObject[];
  const policyIds = policies.map((policy) => String(policy.clientPolicyId));
  const offerIds = offers.map((offer) => String(offer.clientOfferId));
  const issueIds = issues.map((issue) => String(issue.issueId));
  const hasDuplicates = (values: readonly string[]) => new Set(values).size !== values.length;
  if (hasDuplicates(policyIds)) errors.push('/policies: duplicateClientPolicyId');
  if (hasDuplicates(offerIds)) errors.push('/offers: duplicateClientOfferId');
  if (hasDuplicates(issueIds)) errors.push('/issues: duplicateIssueId');
  const referenceIntegrity = analyzeCommercialLetterReferenceIntegrity(payload);
  const knownPolicies = new Set(policyIds);
  offers.forEach((offer, index) =>
    (offer.policyClientIds as string[]).forEach((id) => {
      if (!knownPolicies.has(id)) errors.push(`/offers/${index}/policyClientIds: unknownPolicy`);
    }),
  );
  const confidence = object(payload.overallConfidence, 'overallConfidence');
  const expectedBand = deriveConfidenceBand(confidence.score as number);
  if (confidence.band !== expectedBand)
    errors.push('/overallConfidence/band: inconsistentWithScore');
  if (errors.length) throw new CommercialLetterPayloadValidationError(errors, referenceIntegrity);
}

function sanitizeServerOwnedFields(value: unknown): JsonObject {
  const raw = object(structuredClone(value), 'payload');
  for (const field of ['publicPrice', 'commercialPeriod', 'mmv', 'source'])
    object(raw[field], field);
  if (!Array.isArray(raw.policies) || !Array.isArray(raw.offers) || !Array.isArray(raw.issues))
    throw new CommercialLetterPayloadValidationError(['/: extractionShape']);
  const issues = (raw.issues as JsonObject[]).filter(
    (issue) =>
      !['PRODUCT_UNMATCHED', 'PRODUCT_MATCH_AMBIGUOUS', 'PRODUCT_MATCH_STALE'].includes(
        String(issue.code),
      ),
  );
  const blocked = (entry: JsonObject, kind: 'price' | 'policy' | 'offer'): JsonObject => ({
    ...entry,
    promotionAction: 'blocked',
    ...(kind === 'price' ? { existingPriceId: null, expectedLockVersion: null } : {}),
    ...(kind === 'policy' ? { existingPolicyId: null, predecessor: null } : {}),
    ...(kind === 'offer' ? { existingOfferId: null } : {}),
  });
  const publicPrice = object(raw.publicPrice, 'publicPrice');
  const sanitized = {
    ...raw,
    productMatch: {
      status: 'unmatched',
      selectedProductId: null,
      selectedBy: 'none',
      candidates: [],
      expectedProductFingerprint: null,
      issueIds: [],
    },
    publicPrice: {
      ...publicPrice,
      candidate: publicPrice.candidate
        ? blocked(object(publicPrice.candidate, 'publicPrice.candidate'), 'price')
        : null,
    },
    policies: (raw.policies as JsonObject[]).map((policy) => blocked(policy, 'policy')),
    offers: (raw.offers as JsonObject[]).map((offer) => blocked(offer, 'offer')),
    promotionPlan: {
      mode: 'blocked',
      publishedPriceIdForOffers: null,
      affectedOffers: [],
      requiresExplicitConfirmation: true,
      issueIds: [],
    },
    issues,
    validation: {
      blockingIssueCount: issues.filter(
        (issue) => issue.blocking === true && issue.status === 'open',
      ).length,
      warningCount: issues.filter(
        (issue) => issue.severity === 'warning' && issue.status === 'open',
      ).length,
      readyForApproval: false,
      readyForPromotion: false,
    },
  };
  normalizeConfidenceBands(sanitized);
  return sanitized;
}

export interface PreparedImportRow {
  readonly sourceRowNumber: number;
  readonly sourcePage: number | null;
  readonly rawPayload: Readonly<JsonObject>;
  readonly normalizedPayload: Readonly<JsonObject>;
  readonly confidenceScore: number;
  readonly issueCodes: readonly string[];
  readonly matchInput: ProductMatchInput;
}
export interface ImportProcessingJobResult {
  readonly jobId: string;
  readonly batchId?: string;
  readonly attempt?: number;
  readonly rowCount?: number;
  readonly idempotentReplay: boolean;
  readonly lockVersion?: number;
}
export interface ImportProcessingRepository {
  enqueue(input: {
    readonly batchId: string;
    readonly pluginVersion: string;
    readonly providerKey: string;
    readonly providerVersion: string;
    readonly schemaVersion: string;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ImportProcessingJobResult>;
  claim(input: {
    readonly jobId: string;
    readonly claimToken: string;
    readonly actorId: string;
    readonly correlationId: string;
    readonly leaseSeconds: number;
  }): Promise<ImportProcessingJobResult>;
  downloadDocument(bucket: string, path: string): Promise<Uint8Array>;
  findMatchCandidates(input: ProductMatchInput): Promise<readonly ProductMatchCandidate[]>;
  findMatchCandidatesBatch(
    inputs: readonly ProductMatchInput[],
  ): Promise<readonly (readonly ProductMatchCandidate[])[]>;
  finalize(input: {
    readonly jobId: string;
    readonly claimToken: string;
    readonly rows: readonly (PreparedImportRow & {
      readonly matchedProductId: string | null;
      readonly status: 'unmatched' | 'needs_review';
    })[];
    readonly providerRunId: string;
    readonly usage: ExtractionUsage;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<ImportProcessingJobResult>;
  fail(input: {
    readonly jobId: string;
    readonly claimToken: string;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly actorId: string;
    readonly correlationId: string;
  }): Promise<void>;
}

export const COMMERCIAL_LETTER_PAYLOAD_SCHEMA_VERSION = 'commercial-letter/mmv-payload/1';
export function prepareCommercialLetterRows(
  payloads: readonly unknown[],
  validate: (payload: unknown) => void,
): readonly PreparedImportRow[] {
  if (!payloads.length || payloads.length > IMPORT_PROCESSING_MAX_ROWS)
    throw new CommercialLetterPayloadValidationError(['/: rowCount']);
  const prepared = payloads.map((value) => {
    const raw = sanitizeServerOwnedFields(value);
    validate(raw);
    const source = object(raw.source, 'source');
    const pages = (Array.isArray(source.applicablePages) ? source.applicablePages : []).filter(
      (page): page is number => Number.isInteger(page) && Number(page) > 0,
    );
    const confidence = object(raw.overallConfidence, 'overallConfidence');
    const externalCodes = (object(raw.mmv, 'mmv').externalCodes as JsonObject[])
      .map((item) => String(item.value ?? ''))
      .filter(Boolean);
    const matchInput: ProductMatchInput = {
      brand: fieldValue(raw, 'brand'),
      model: fieldValue(raw, 'model'),
      version: fieldValue(raw, 'version'),
      modelYear: fieldValue(raw, 'modelYear'),
      productionYear: fieldValue(raw, 'productionYear'),
      externalCodes,
    };
    const period = object(raw.commercialPeriod, 'commercialPeriod');
    const blockKeys = (Array.isArray(source.applicableBlockKeys) ? source.applicableBlockKeys : [])
      .map(String)
      .sort()
      .join(',');
    const restrictions = (raw.offers as JsonObject[])
      .flatMap((offer) =>
        Array.isArray(offer.restrictions)
          ? offer.restrictions.map((item) => JSON.stringify(item))
          : [],
      )
      .sort()
      .join(',');
    const semanticKey = [
      matchInput.brand,
      matchInput.model,
      matchInput.version,
      matchInput.modelYear,
      matchInput.productionYear,
      String(period.competence ?? ''),
      String(object(period.startsOn, 'startsOn').value ?? ''),
      String(object(period.endsOn, 'endsOn').value ?? ''),
      restrictions,
      blockKeys,
    ]
      .map(normalize)
      .join('|');
    return {
      semanticKey,
      sourcePage: pages[0] ?? null,
      rawPayload: raw,
      normalizedPayload: raw,
      confidenceScore: Number(confidence.score),
      issueCodes: [] as readonly string[],
      matchInput,
    };
  });
  prepared.sort(
    (a, b) =>
      a.semanticKey.localeCompare(b.semanticKey, 'pt-BR') ||
      JSON.stringify(a.rawPayload).localeCompare(JSON.stringify(b.rawPayload), 'pt-BR'),
  );
  return prepared.map((row, index) => ({
    sourceRowNumber: index + 1,
    sourcePage: row.sourcePage,
    rawPayload: row.rawPayload,
    normalizedPayload: row.normalizedPayload,
    confidenceScore: row.confidenceScore,
    issueCodes: row.issueCodes,
    matchInput: row.matchInput,
  }));
}

export function enrichCommercialLetterRow(
  row: PreparedImportRow,
  match: ProductMatchResult,
  validate: (payload: unknown) => void,
): PreparedImportRow & {
  readonly matchedProductId: string | null;
  readonly status: 'unmatched' | 'needs_review';
} {
  const selected = match.status === 'confirmed' ? match.selected : null;
  const issueCode =
    match.status === 'ambiguous'
      ? 'PRODUCT_MATCH_AMBIGUOUS'
      : selected
        ? null
        : 'PRODUCT_UNMATCHED';
  const issueId = issueCode ? `issue_product_${match.status}` : null;
  const baseIssues = (row.normalizedPayload.issues as JsonObject[]).filter(
    (issue) => !String(issue.code).startsWith('PRODUCT_'),
  );
  const evidence = object(
    object(object(row.normalizedPayload.mmv, 'mmv').model, 'mmv.model').meta,
    'meta',
  ).evidence as unknown[];
  const issues = issueCode
    ? [
        ...baseIssues,
        {
          issueId,
          code: issueCode,
          severity: 'error',
          blocking: true,
          path: '/productMatch',
          message:
            issueCode === 'PRODUCT_MATCH_AMBIGUOUS'
              ? 'Mais de um Product corresponde ao MMV.'
              : 'Nenhum Product foi confirmado para o MMV.',
          evidence,
          status: 'open',
          resolution: null,
        },
      ]
    : baseIssues;
  const candidateProducts: readonly ProductMatchCandidate[] =
    match.status === 'confirmed'
      ? [match.selected]
      : match.status === 'unmatched'
        ? []
        : match.candidates;
  const matchMethod =
    match.status === 'confirmed' && match.method === 'external_code'
      ? 'external_code'
      : match.status === 'confirmed'
        ? 'exact_business_key'
        : 'normalized_tokens';
  const candidates = candidateProducts.slice(0, 10).map((candidate) => ({
    productId: Number(candidate.id),
    displayName: [
      candidate.brand,
      candidate.model,
      candidate.version,
      candidate.productionYear,
      candidate.modelYear,
    ].join(' '),
    matchMethod,
    score: selected ? 100 : 70,
  }));
  const blocking = issues.filter(
    (issue) => issue.blocking === true && issue.status === 'open',
  ).length;
  const warnings = issues.filter(
    (issue) => issue.severity === 'warning' && issue.status === 'open',
  ).length;
  const payload: JsonObject = {
    ...row.normalizedPayload,
    productMatch: {
      status: match.status,
      selectedProductId: selected ? Number(selected.id) : null,
      selectedBy: selected ? 'system' : 'none',
      candidates,
      expectedProductFingerprint: selected
        ? [
            selected.brand,
            selected.model,
            selected.version,
            selected.modelYear,
            selected.productionYear,
          ].join('|')
        : null,
      issueIds: issueId ? [issueId] : [],
    },
    promotionPlan: {
      mode: 'blocked',
      publishedPriceIdForOffers: null,
      affectedOffers: [],
      requiresExplicitConfirmation: true,
      issueIds: issues
        .filter((issue) => issue.blocking === true && issue.status === 'open')
        .map((issue) => issue.issueId),
    },
    issues,
    validation: {
      blockingIssueCount: blocking,
      warningCount: warnings,
      readyForApproval: false,
      readyForPromotion: false,
    },
  };
  validate(payload);
  return {
    ...row,
    normalizedPayload: payload,
    issueCodes: issueCode ? [issueCode] : [],
    matchedProductId: selected?.id ?? null,
    status: selected ? 'needs_review' : 'unmatched',
  };
}

export function sanitizeProcessingError(error: unknown): {
  readonly code: string;
  readonly message: string;
} {
  if (error instanceof CommercialLetterPayloadValidationError)
    return {
      code: 'CANONICAL_PAYLOAD_INVALID',
      message: `Payload canônico recusado: ${error.issues.slice(0, 10).join('; ')}`.slice(0, 1000),
    };
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    const providerCodes = new Set([
      'PROVIDER_AUTH_ERROR',
      'PROVIDER_RATE_LIMITED',
      'PROVIDER_TIMEOUT',
      'PROVIDER_INVALID_OUTPUT',
      'PROVIDER_REFUSAL',
      'PROVIDER_FILE_UPLOAD_FAILED',
      'PROVIDER_FILE_CLEANUP_FAILED',
      'PROVIDER_REQUEST_INVALID',
      'PROVIDER_UNKNOWN_ERROR',
    ]);
    if (providerCodes.has(code))
      return { code, message: 'O provider de extração falhou. Consulte o correlation ID.' };
    if (code === 'DOCUMENT_MAP_CANONICALIZATION_FAILED')
      return {
        code,
        message: 'O pipeline segmentado falhou. Consulte o correlation ID.',
      };
  }
  const segmentedCode =
    error instanceof Error
      ? error.message.match(
          /^(DOCUMENT_MAP_FAILED|DOCUMENT_MAP_INVALID|UNIT_PLAN_INVALID|UNIT_EXTRACTION_(?:FAILED|TIMEOUT|PROVIDER_TIMEOUT|PROVIDER_FAILURE|INVALID_STRUCTURED_OUTPUT|CANONICAL_VALIDATION_FAILED|ORCHESTRATION_TIMEOUT|ABORTED_SIBLING)|MERGE_FAILED|SEMANTIC_RECONCILIATION_FAILED|DOMAIN_MAPPING_(?:FAILED|BLOCKED|PERIOD_UNAVAILABLE)|ARTIFACT_PERSISTENCE_FAILED|SEGMENTED_[A-Z_]+)$/u,
        )?.[1]
      : undefined;
  if (segmentedCode)
    return {
      code: segmentedCode.slice(0, 64),
      message: 'O pipeline segmentado falhou. Consulte o correlation ID.',
    };
  return {
    code: 'PROCESSING_FAILED',
    message: 'O processamento falhou sem persistir rows. Consulte o correlation ID.',
  };
}
