import { deriveConfidenceBand } from '../services/import-processing';
import type { CommercialDocumentFactValue } from './commercial-document-extraction';
import type { CommercialDocumentReconciliationSourceRef } from './commercial-document-reconciliation';
import {
  validateSemanticallyReconciledCommercialDocument,
  type SemanticDocumentaryRule,
  type SEMANTIC_COMMERCIAL_DOCUMENT_VERSION,
  type SemanticallyReconciledCommercialDocument,
} from './commercial-document-semantic-reconciliation';

export const COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_VERSION =
  'CommercialDocumentDomainMappingResult/1' as const;
export const COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_PAYLOAD_VERSION =
  'commercial-letter/mmv-payload/1' as const;

export type CommercialDocumentDomainMappingIssueCode =
  | 'MMV_FIELD_MISSING'
  | 'MMV_YEAR_AMBIGUOUS'
  | 'SOURCE_BLOCK_INCOMPLETE'
  | 'SOURCE_PRECEDENCE_UNRESOLVED'
  | 'MSRP_AMBIGUOUS'
  | 'MSRP_CONFLICT'
  | 'POLICY_TYPE_UNSUPPORTED'
  | 'POLICY_VALUE_MISSING'
  | 'POLICY_PARAMETERS_INCOMPLETE'
  | 'POLICY_PERIOD_CONFLICT'
  | 'OFFER_RELATION_AMBIGUOUS'
  | 'OFFER_REFERENCES_UNKNOWN_POLICY'
  | 'OFFER_COVERAGE_GAP'
  | 'OFFER_CHANNEL_UNSUPPORTED'
  | 'OFFER_RESTRICTION_UNSUPPORTED'
  | 'OUTPUT_PROVENANCE_UNSUPPORTED';

export interface CommercialDocumentDomainMappingSource {
  readonly documentId: string;
  readonly ordinal: number;
  readonly originalFileName: string;
}

export interface CommercialDocumentDomainMappingPeriod {
  readonly competence: string;
  readonly kind: 'monthly' | 'special';
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface MapCommercialDocumentToDomainInput {
  readonly semanticDocument: SemanticallyReconciledCommercialDocument;
  readonly sources: readonly CommercialDocumentDomainMappingSource[];
  readonly commercialPeriod: CommercialDocumentDomainMappingPeriod;
}

export interface CommercialDocumentDomainMappingIssue {
  readonly issueId: string;
  readonly code: CommercialDocumentDomainMappingIssueCode;
  readonly severity: 'warning' | 'error';
  readonly recipientIds: readonly string[];
  readonly ruleIds: readonly string[];
  readonly message: string;
}

export interface CommercialDocumentDomainMappingResult {
  readonly schemaVersion: typeof COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_VERSION;
  readonly sourceReconciliationVersion: typeof SEMANTIC_COMMERCIAL_DOCUMENT_VERSION;
  readonly status: 'complete' | 'review_required' | 'blocked';
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly mappingIssues: readonly CommercialDocumentDomainMappingIssue[];
  readonly unresolvedRuleIds: readonly string[];
  readonly unresolvedRecipientIds: readonly string[];
  readonly coverage: {
    readonly expectedRecipientCount: number;
    readonly mappedRecipientCount: number;
    readonly expectedRuleCount: number;
    readonly mappedRuleCount: number;
    readonly expectedCompositionGroupCount: number;
    readonly mappedCompositionGroupCount: number;
    readonly unresolvedItemCount: number;
  };
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export const COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING = Object.freeze({
  public_price: 'MSRP',
  promotional_price: 'UNSUPPORTED_PROMOTIONAL_PRICE',
  bonus: 'POLICY_RETAIL_BONUS',
  discount: 'POLICY_INVOICE_DISCOUNT',
  trade_in: 'POLICY_TRADE_IN_BONUS',
  financing_rate: 'POLICY_SUBSIDIZED_FINANCING_RATE',
  financing_down_payment: 'POLICY_SUBSIDIZED_FINANCING_DOWN_PAYMENT',
  financing_installments: 'POLICY_SUBSIDIZED_FINANCING_TERM',
  grace_period: 'UNSUPPORTED_FINANCING_PARAMETER',
  registration_bonus: 'POLICY_FREE_REGISTRATION',
  accessory: 'POLICY_OTHER',
  wallbox: 'POLICY_FREE_WALLBOX',
  charging: 'POLICY_FUEL_OR_RECHARGE_VOUCHER',
  insurance: 'POLICY_FREE_INSURANCE',
  maintenance: 'POLICY_FREE_MAINTENANCE',
  eligibility: 'APPLICABILITY_RESTRICTION',
  restriction: 'APPLICABILITY_RESTRICTION',
  channel_rule: 'APPLICABILITY_RESTRICTION',
  other: 'UNSUPPORTED_OTHER',
} as const);

type MappingIssueDraft = Omit<CommercialDocumentDomainMappingIssue, 'issueId'>;
type JsonObject = Record<string, unknown>;
type PolicyDraft = {
  readonly semanticKey: string;
  readonly ruleIds: readonly string[];
  readonly value: JsonObject;
};

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compare)
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};
const provenanceKey = (value: CommercialDocumentReconciliationSourceRef): string =>
  `${value.artifactId}\u0000${value.sourceId}\u0000${value.documentId ?? ''}\u0000${value.documentPage ?? ''}\u0000${value.blockKey ?? ''}`;
const orderedProvenance = (
  values: readonly CommercialDocumentReconciliationSourceRef[],
): CommercialDocumentReconciliationSourceRef[] =>
  [...new Map(values.map((item) => [provenanceKey(item), item])).values()].sort((left, right) =>
    compare(provenanceKey(left), provenanceKey(right)),
  );
const scoreFrom = (score: number): number =>
  Math.max(
    0,
    Math.min(100, Number.isInteger(score) && score > 1 ? score : Math.round(score * 100)),
  );
const confidence = (score: number, rationale: string): JsonObject => {
  const normalized = scoreFrom(score);
  return { score: normalized, band: deriveConfidenceBand(normalized), rationale };
};
const evidenceFrom = (
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject[] =>
  orderedProvenance(provenance)
    .filter(
      (
        item,
      ): item is CommercialDocumentReconciliationSourceRef & {
        documentPage: number;
        blockKey: string;
      } => Boolean(item.documentPage && item.blockKey && excerpt?.trim()),
    )
    .map((item) => ({
      documentPage: item.documentPage,
      excerpt: excerpt!.trim().slice(0, 2_000),
      blockKey: item.blockKey,
    }));
const meta = (
  score: number,
  rationale: string,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({
  origin: 'source',
  confidence: confidence(score, rationale),
  evidence: evidenceFrom(provenance, excerpt),
});
const annotatedString = (
  value: string,
  score: number,
  rationale: string,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({ value, meta: meta(score, rationale, provenance, excerpt) });
const annotatedNullableString = (
  value: string | null,
  score: number,
  rationale: string,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({ value, meta: meta(score, rationale, provenance, excerpt) });
const annotatedDate = (
  value: string,
  score: number,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({ value, meta: meta(score, 'Documentary validity.', provenance, excerpt) });
const annotatedMoney = (
  amount: string,
  currency: string,
  score: number,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({
  amount: decimalMoney(amount),
  currency,
  meta: meta(score, 'Documentary monetary value.', provenance, excerpt),
});
const annotatedPercentage = (
  value: string,
  score: number,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({
  value: decimal(value),
  unit: 'percent',
  meta: meta(score, 'Documentary percentage.', provenance, excerpt),
});
const annotatedInteger = (
  value: number,
  score: number,
  provenance: readonly CommercialDocumentReconciliationSourceRef[],
  excerpt?: string,
): JsonObject => ({
  value,
  meta: meta(score, 'Documentary integer.', provenance, excerpt),
});
const decimal = (value: string): string => {
  const normalized = value.replace(/^\+/u, '').replace(/\.0+$/u, '');
  return normalized || '0';
};
const decimalMoney = (value: string): string => {
  const [integer = '0', fraction = ''] = value.split('.');
  return `${integer}.${`${fraction}00`.slice(0, 2)}`;
};
const isIsoCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1]!;
};
const factExcerpt = (rule: SemanticDocumentaryRule): string | undefined =>
  rule.evidence.excerpt ?? rule.rawLabel;
const money = (
  value: CommercialDocumentFactValue,
): Extract<CommercialDocumentFactValue, { kind: 'money' }> | undefined =>
  value.kind === 'money' && value.currency === 'BRL' ? value : undefined;
const percentage = (
  value: CommercialDocumentFactValue,
): Extract<CommercialDocumentFactValue, { kind: 'percentage' }> | undefined =>
  value.kind === 'percentage' ? value : undefined;
const quantity = (
  value: CommercialDocumentFactValue,
): Extract<CommercialDocumentFactValue, { kind: 'quantity' }> | undefined =>
  value.kind === 'quantity' ? value : undefined;
const textValue = (rule: SemanticDocumentaryRule): string =>
  rule.rawLabel ??
  (rule.value.kind === 'text'
    ? rule.value.text
    : rule.value.kind === 'boolean'
      ? String(rule.value.value)
      : (rule.value.rawText ?? rule.factType));

const emptyParameters = (): JsonObject => ({
  termMonths: null,
  customerInterestRateMonthly: null,
  downPaymentPercentage: null,
  annualRate: null,
  coverageYears: null,
  offerMonth: null,
  maintenanceCount: null,
  coverageMonths: null,
  coverageKm: null,
  voucherType: null,
  balloonAmount: null,
  firstPaymentOn: null,
});

const issueMessage: Readonly<Record<CommercialDocumentDomainMappingIssueCode, string>> = {
  MMV_FIELD_MISSING: 'Required documentary MMV identity is missing.',
  MMV_YEAR_AMBIGUOUS: 'Documentary production/model year remains ambiguous.',
  SOURCE_BLOCK_INCOMPLETE: 'Documentary source coverage is incomplete.',
  SOURCE_PRECEDENCE_UNRESOLVED: 'Documentary precedence remains unresolved.',
  MSRP_AMBIGUOUS: 'MSRP cannot be selected unambiguously.',
  MSRP_CONFLICT: 'Overlapping incompatible MSRP facts remain unresolved.',
  POLICY_TYPE_UNSUPPORTED: 'Documentary rule has no safe canonical Policy mapping.',
  POLICY_VALUE_MISSING: 'Documentary Policy value is missing or incompatible.',
  POLICY_PARAMETERS_INCOMPLETE: 'Documentary financing parameters cannot be represented safely.',
  POLICY_PERIOD_CONFLICT: 'Documentary Policy validity conflicts with the canonical period.',
  OFFER_RELATION_AMBIGUOUS: 'Documentary Offer composition remains ambiguous.',
  OFFER_REFERENCES_UNKNOWN_POLICY: 'Offer references a Policy that was not materialized.',
  OFFER_COVERAGE_GAP: 'Applicable documentary rule is absent from Offer composition.',
  OFFER_CHANNEL_UNSUPPORTED: 'Documentary channel distinction cannot be represented safely.',
  OFFER_RESTRICTION_UNSUPPORTED: 'Documentary restriction cannot be represented safely.',
  OUTPUT_PROVENANCE_UNSUPPORTED:
    'Documentary provenance cannot be represented by the canonical payload.',
};

function policyFromRule(
  rule: SemanticDocumentaryRule,
  period: CommercialDocumentDomainMappingPeriod,
  contextualRestrictions: readonly string[],
  addIssue: (code: CommercialDocumentDomainMappingIssueCode, ruleIds: readonly string[]) => void,
): JsonObject | undefined {
  const score = scoreFrom(rule.confidence.score);
  const ruleProvenance = rule.provenance;
  const excerpt = factExcerpt(rule);
  const parameters = emptyParameters();
  let canonicalType: string;
  let customerBenefitAmount: JsonObject | null = null;
  const mapping = COMMERCIAL_DOCUMENT_FACT_DOMAIN_MAPPING[rule.factType];
  if (mapping === 'MSRP' || mapping === 'APPLICABILITY_RESTRICTION') return undefined;
  if (mapping.startsWith('UNSUPPORTED_')) {
    addIssue(
      mapping === 'UNSUPPORTED_FINANCING_PARAMETER'
        ? 'POLICY_PARAMETERS_INCOMPLETE'
        : 'POLICY_TYPE_UNSUPPORTED',
      [rule.ruleId],
    );
    return undefined;
  }
  if (mapping === 'POLICY_RETAIL_BONUS') canonicalType = 'retail_bonus';
  else if (mapping === 'POLICY_INVOICE_DISCOUNT') canonicalType = 'invoice_discount';
  else if (mapping === 'POLICY_TRADE_IN_BONUS') canonicalType = 'trade_in_bonus';
  else if (mapping.startsWith('POLICY_SUBSIDIZED_FINANCING'))
    canonicalType = 'subsidized_financing';
  else if (mapping === 'POLICY_FREE_REGISTRATION') canonicalType = 'free_registration';
  else if (mapping === 'POLICY_FREE_WALLBOX') canonicalType = 'free_wallbox';
  else if (mapping === 'POLICY_FUEL_OR_RECHARGE_VOUCHER')
    canonicalType = 'fuel_or_recharge_voucher';
  else if (mapping === 'POLICY_FREE_INSURANCE') canonicalType = 'free_insurance';
  else if (mapping === 'POLICY_FREE_MAINTENANCE') canonicalType = 'free_maintenance';
  else canonicalType = 'other';

  const monetary = money(rule.value);
  if (monetary)
    customerBenefitAmount = annotatedMoney(
      monetary.amount,
      monetary.currency,
      score,
      ruleProvenance,
      excerpt,
    );
  if (['retail_bonus', 'invoice_discount', 'trade_in_bonus'].includes(canonicalType) && !monetary) {
    addIssue('POLICY_VALUE_MISSING', [rule.ruleId]);
    return undefined;
  }
  if (mapping === 'POLICY_SUBSIDIZED_FINANCING_RATE') {
    const rate = percentage(rule.value);
    if (!rate) {
      addIssue('POLICY_PARAMETERS_INCOMPLETE', [rule.ruleId]);
      return undefined;
    }
    parameters.customerInterestRateMonthly = annotatedPercentage(
      rate.percentage,
      score,
      ruleProvenance,
      excerpt,
    );
  }
  if (mapping === 'POLICY_SUBSIDIZED_FINANCING_DOWN_PAYMENT') {
    const downPayment = percentage(rule.value);
    if (!downPayment) {
      addIssue('POLICY_PARAMETERS_INCOMPLETE', [rule.ruleId]);
      return undefined;
    }
    parameters.downPaymentPercentage = annotatedPercentage(
      downPayment.percentage,
      score,
      ruleProvenance,
      excerpt,
    );
  }
  if (mapping === 'POLICY_SUBSIDIZED_FINANCING_TERM') {
    const term = quantity(rule.value);
    const parsed = term && Number(term.amount);
    if (!term || !Number.isInteger(parsed) || parsed! < 0) {
      addIssue('POLICY_PARAMETERS_INCOMPLETE', [rule.ruleId]);
      return undefined;
    }
    parameters.termMonths = annotatedInteger(parsed!, score, ruleProvenance, excerpt);
  }
  if (canonicalType === 'fuel_or_recharge_voucher')
    parameters.voucherType = annotatedString(
      'recharge',
      score,
      'Documentary benefit kind.',
      ruleProvenance,
      excerpt,
    );

  const restrictions = unique([
    ...contextualRestrictions,
    ...rule.channelConstraints.map((channel) => `channel:${channel}`),
    ...rule.eligibility.map((item) => `eligibility:${item}`),
    ...rule.restrictions,
  ]).map((item) =>
    annotatedString(item, score, 'Documentary applicability.', ruleProvenance, excerpt),
  );
  const startsOn = rule.validity?.startsOn ?? period.startsOn;
  const endsOn = rule.validity?.endsOn ?? period.endsOn;
  if (!isIsoCalendarDate(startsOn) || !isIsoCalendarDate(endsOn) || startsOn > endsOn) {
    addIssue('POLICY_PERIOD_CONFLICT', [rule.ruleId]);
    return undefined;
  }
  return {
    clientPolicyId: 'pending',
    sourceLabel: annotatedString(
      textValue(rule),
      score,
      'Documentary source label.',
      ruleProvenance,
      excerpt,
    ),
    canonicalType,
    mappingStatus: 'mapped',
    title: annotatedString(
      textValue(rule),
      score,
      'Deterministic fact mapping.',
      ruleProvenance,
      excerpt,
    ),
    description: annotatedNullableString(
      null,
      score,
      'No documentary description.',
      ruleProvenance,
    ),
    startsOn: annotatedDate(startsOn, score, ruleProvenance, excerpt),
    endsOn: annotatedDate(endsOn, score, ruleProvenance, excerpt),
    customerBenefitAmount,
    dealerRebateAmount: null,
    parameters,
    restrictions,
    promotionAction: 'blocked',
    existingPolicyId: null,
    predecessor: null,
    issueIds: [],
  };
}

const validateContext = (input: MapCommercialDocumentToDomainInput): void => {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(input.commercialPeriod.competence))
    throw new Error('COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_INVALID_COMPETENCE');
  if (
    !isIsoCalendarDate(input.commercialPeriod.startsOn) ||
    !isIsoCalendarDate(input.commercialPeriod.endsOn)
  )
    throw new Error('COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_INVALID_PERIOD');
  if (input.commercialPeriod.startsOn > input.commercialPeriod.endsOn)
    throw new Error('COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_INVALID_PERIOD');
  const sourceIds = input.sources.map((source) => source.documentId);
  if (
    new Set(sourceIds).size !== sourceIds.length ||
    input.sources.some(
      (source) =>
        !source.originalFileName.trim() ||
        source.originalFileName.length > 512 ||
        !Number.isInteger(source.ordinal) ||
        source.ordinal < 1,
    )
  )
    throw new Error('COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_INVALID_SOURCE');
};

export function mapCommercialDocumentToDomain(
  input: MapCommercialDocumentToDomainInput,
): CommercialDocumentDomainMappingResult {
  validateSemanticallyReconciledCommercialDocument(input.semanticDocument);
  validateContext(input);
  const semantic = input.semanticDocument;
  const sourceById = new Map(input.sources.map((source) => [source.documentId, source]));
  const rulesById = new Map(semantic.rules.map((rule) => [rule.ruleId, rule]));
  const groupsByRuleId = new Map<string, Set<string>>();
  const groupsById = new Map(semantic.composition.groups.map((group) => [group.groupId, group]));
  const childGroupIdsByParent = new Map<string, string[]>();
  for (const group of semantic.composition.groups)
    for (const ruleId of [...group.memberRuleIds, ...group.sharedRuleIds])
      groupsByRuleId.set(ruleId, new Set([...(groupsByRuleId.get(ruleId) ?? []), group.groupId]));
  for (const group of semantic.composition.groups)
    if (group.parentGroupId)
      childGroupIdsByParent.set(
        group.parentGroupId,
        unique([...(childGroupIdsByParent.get(group.parentGroupId) ?? []), group.groupId]),
      );
  const applicabilityByRecipient = new Map(
    semantic.recipientApplicability.map((item) => [item.recipientId, item]),
  );
  const issueDrafts: MappingIssueDraft[] = [];
  const mappedRuleIds = new Set<string>();
  const mappedGroupIds = new Set<string>();
  const mappedRecipientIds = new Set<string>();
  const addGlobalIssue = (
    code: CommercialDocumentDomainMappingIssueCode,
    recipientIds: readonly string[],
    ruleIds: readonly string[],
    severity: 'warning' | 'error' = 'error',
  ): void => {
    issueDrafts.push({
      code,
      severity,
      recipientIds: unique(recipientIds),
      ruleIds: unique(ruleIds),
      message: issueMessage[code],
    });
  };
  const vehicleRecipients = semantic.recipients
    .filter((recipient) => recipient.recipientType === 'VEHICLE')
    .sort((left, right) => compare(left.recipientId, right.recipientId));
  const rows: JsonObject[] = [];

  for (const recipient of vehicleRecipients) {
    const identity = recipient.vehicleIdentity;
    const projection = applicabilityByRecipient.get(recipient.recipientId);
    if (
      !identity ||
      !identity.brand.trim() ||
      !identity.model.trim() ||
      !identity.version?.trim()
    ) {
      addGlobalIssue('MMV_FIELD_MISSING', [recipient.recipientId], []);
      continue;
    }
    const applicableRules = unique(projection?.applicableRuleIds ?? [])
      .map((ruleId) => rulesById.get(ruleId))
      .filter((rule): rule is SemanticDocumentaryRule => Boolean(rule))
      .filter((rule) => !rule.supersededByRuleId);
    const localIssues: Array<{
      code: CommercialDocumentDomainMappingIssueCode;
      ruleIds: string[];
    }> = [];
    const addLocalIssue = (
      code: CommercialDocumentDomainMappingIssueCode,
      ruleIds: readonly string[],
    ) => {
      localIssues.push({ code, ruleIds: unique(ruleIds) });
      addGlobalIssue(code, [recipient.recipientId], ruleIds);
    };
    if (projection?.unresolvedRuleIds.length)
      addLocalIssue('OFFER_COVERAGE_GAP', projection.unresolvedRuleIds);
    const conflicts = semantic.unresolvedConflicts.filter((conflict) =>
      conflict.recipientRefs.includes(recipient.recipientId),
    );
    for (const conflict of conflicts)
      addLocalIssue(
        conflict.ruleRefs.some((ruleId) => rulesById.get(ruleId)?.factType === 'public_price')
          ? 'MSRP_CONFLICT'
          : 'SOURCE_PRECEDENCE_UNRESOLVED',
        conflict.ruleRefs,
      );
    const contextRules = applicableRules.filter((rule) =>
      ['eligibility', 'restriction', 'channel_rule'].includes(rule.factType),
    );
    const contextualRestrictions = contextRules.map(textValue);
    contextRules.forEach((rule) => mappedRuleIds.add(rule.ruleId));

    const policyDraftsByKey = new Map<string, PolicyDraft>();
    const ruleToPolicyKey = new Map<string, string>();
    for (const rule of applicableRules) {
      if (rule.factType === 'public_price' || contextRules.includes(rule)) continue;
      const value = policyFromRule(
        rule,
        input.commercialPeriod,
        contextualRestrictions,
        addLocalIssue,
      );
      if (!value) continue;
      const semanticKey = canonical({
        factType: rule.factType,
        value: rule.value,
        channelConstraints: rule.channelConstraints,
        eligibility: rule.eligibility,
        restrictions: rule.restrictions,
        validity: rule.validity,
        contextualRestrictions,
      });
      const existing = policyDraftsByKey.get(semanticKey);
      const ruleIds = unique([...(existing?.ruleIds ?? []), rule.ruleId]);
      policyDraftsByKey.set(semanticKey, { semanticKey, ruleIds, value });
      ruleToPolicyKey.set(rule.ruleId, semanticKey);
      mappedRuleIds.add(rule.ruleId);
    }
    const orderedDrafts = [...policyDraftsByKey.values()].sort((left, right) =>
      compare(left.semanticKey, right.semanticKey),
    );
    const policyIdByKey = new Map<string, string>();
    const policies = orderedDrafts.map((draft, index) => {
      const clientPolicyId = `policy_${String(index + 1).padStart(4, '0')}`;
      policyIdByKey.set(draft.semanticKey, clientPolicyId);
      return { ...draft.value, clientPolicyId };
    });
    const policyIdForRule = (ruleId: string): string | undefined => {
      const key = ruleToPolicyKey.get(ruleId);
      return key ? policyIdByKey.get(key) : undefined;
    };

    const offersDraft: Array<{
      key: string;
      policyIds: string[];
      relation: 'and' | 'or_alternative' | 'standalone';
      ruleIds: string[];
    }> = [];
    const groupedRuleIds = new Set<string>();
    const applicableRuleIdSet = new Set(applicableRules.map((rule) => rule.ruleId));
    const relevantGroupIds = new Set(
      applicableRules.flatMap((rule) => [...(groupsByRuleId.get(rule.ruleId) ?? [])]),
    );
    for (const groupId of [...relevantGroupIds]) {
      let current = groupsById.get(groupId);
      while (current?.parentGroupId) {
        relevantGroupIds.add(current.parentGroupId);
        current = groupsById.get(current.parentGroupId);
      }
    }
    const rootGroupIds = [...relevantGroupIds]
      .filter((groupId) => {
        const parent = groupsById.get(groupId)?.parentGroupId;
        return !parent || !relevantGroupIds.has(parent);
      })
      .sort(compare);
    const expandGroup = (
      groupId: string,
      visiting = new Set<string>(),
    ): Array<{ ruleIds: string[]; alternative: boolean; groupIds: string[] }> => {
      if (visiting.has(groupId)) return [];
      const group = groupsById.get(groupId);
      if (!group) return [];
      const next = new Set(visiting).add(groupId);
      const members = group.memberRuleIds.filter((ruleId) => applicableRuleIdSet.has(ruleId));
      const shared = group.sharedRuleIds.filter((ruleId) => applicableRuleIdSet.has(ruleId));
      const children = (childGroupIdsByParent.get(groupId) ?? [])
        .filter((childId) => relevantGroupIds.has(childId))
        .flatMap((childId) => expandGroup(childId, next));
      if (group.groupType === 'ALTERNATIVE')
        return [
          ...members.map((ruleId) => ({
            ruleIds: unique([ruleId, ...shared]),
            alternative: true,
            groupIds: [groupId],
          })),
          ...children.map((branch) => ({
            ruleIds: unique([...branch.ruleIds, ...shared]),
            alternative: true,
            groupIds: unique([groupId, ...branch.groupIds]),
          })),
        ];
      let branches = [
        { ruleIds: unique([...members, ...shared]), alternative: false, groupIds: [groupId] },
      ];
      for (const childId of childGroupIdsByParent.get(groupId) ?? []) {
        if (!relevantGroupIds.has(childId)) continue;
        const childBranches = expandGroup(childId, next);
        if (!childBranches.length) continue;
        branches = branches.flatMap((base) =>
          childBranches.map((child) => ({
            ruleIds: unique([...base.ruleIds, ...child.ruleIds]),
            alternative: base.alternative || child.alternative || childBranches.length > 1,
            groupIds: unique([...base.groupIds, ...child.groupIds]),
          })),
        );
      }
      return branches;
    };
    for (const rootGroupId of rootGroupIds) {
      for (const branch of expandGroup(rootGroupId)) {
        const ruleIds = branch.ruleIds;
        const policyIds = unique(
          ruleIds.map(policyIdForRule).filter((id): id is string => Boolean(id)),
        );
        const missing = ruleIds.filter((ruleId) => {
          const rule = rulesById.get(ruleId);
          return (
            rule &&
            !['public_price', 'eligibility', 'restriction', 'channel_rule'].includes(
              rule.factType,
            ) &&
            !policyIdForRule(ruleId)
          );
        });
        if (missing.length) {
          addLocalIssue('OFFER_COVERAGE_GAP', missing);
          continue;
        }
        if (!policyIds.length) continue;
        offersDraft.push({
          key: `${rootGroupId}\u0000${ruleIds.join('\u0000')}`,
          policyIds,
          relation: branch.alternative ? 'or_alternative' : 'and',
          ruleIds,
        });
        ruleIds.forEach((ruleId) => groupedRuleIds.add(ruleId));
        branch.groupIds.forEach((groupId) => mappedGroupIds.add(groupId));
      }
    }
    for (const rule of applicableRules) {
      const policyId = policyIdForRule(rule.ruleId);
      if (policyId && !groupedRuleIds.has(rule.ruleId))
        offersDraft.push({
          key: `standalone\u0000${rule.ruleId}`,
          policyIds: [policyId],
          relation: 'standalone',
          ruleIds: [rule.ruleId],
        });
    }
    const policyIds = new Set(policies.map((policy) => String(policy.clientPolicyId)));
    const offers = offersDraft
      .sort((left, right) => compare(left.key, right.key))
      .map((offer, index) => {
        const unknown = offer.policyIds.filter((id) => !policyIds.has(id));
        if (unknown.length) {
          addLocalIssue('OFFER_REFERENCES_UNKNOWN_POLICY', offer.ruleIds);
          return undefined;
        }
        const offerRules = offer.ruleIds.map((ruleId) => rulesById.get(ruleId)!).filter(Boolean);
        const offerProvenance = orderedProvenance(offerRules.flatMap((rule) => rule.provenance));
        const score = Math.min(...offerRules.map((rule) => scoreFrom(rule.confidence.score)), 100);
        return {
          clientOfferId: `offer_${String(index + 1).padStart(4, '0')}`,
          label: annotatedString(
            `Offer ${String(index + 1).padStart(2, '0')}`,
            score,
            'Reconciled documentary composition.',
            offerProvenance,
          ),
          policyClientIds: offer.policyIds,
          sourceRelation: {
            value: offer.relation,
            meta: meta(score, 'Reconciled documentary composition.', offerProvenance),
          },
          startsOn: annotatedDate(input.commercialPeriod.startsOn, score, offerProvenance),
          endsOn: annotatedDate(input.commercialPeriod.endsOn, score, offerProvenance),
          restrictions: contextualRestrictions.map((item) =>
            annotatedString(item, score, 'Documentary applicability.', offerProvenance),
          ),
          promotionAction: 'blocked',
          existingOfferId: null,
          issueIds: [],
        };
      })
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));

    const msrpRules = applicableRules.filter((rule) => rule.factType === 'public_price');
    const msrpCandidates = new Map(
      msrpRules.filter((rule) => money(rule.value)).map((rule) => [canonical(rule.value), rule]),
    );
    let publicPrice: JsonObject = { presence: 'not_mentioned', candidate: null, issueIds: [] };
    if (msrpRules.length && msrpCandidates.size !== 1) {
      addLocalIssue(
        'MSRP_AMBIGUOUS',
        msrpRules.map((rule) => rule.ruleId),
      );
      publicPrice = { presence: 'ambiguous', candidate: null, issueIds: [] };
    } else if (msrpCandidates.size === 1) {
      const rule = [...msrpCandidates.values()][0]!;
      const value = money(rule.value)!;
      const score = scoreFrom(rule.confidence.score);
      const startsOn = rule.validity?.startsOn ?? input.commercialPeriod.startsOn;
      const endsOn = rule.validity?.endsOn ?? input.commercialPeriod.endsOn;
      if (!isIsoCalendarDate(startsOn) || !isIsoCalendarDate(endsOn) || startsOn > endsOn) {
        addLocalIssue('MSRP_AMBIGUOUS', [rule.ruleId]);
        publicPrice = { presence: 'ambiguous', candidate: null, issueIds: [] };
      } else {
        publicPrice = {
          presence: 'mentioned',
          candidate: {
            amount: annotatedMoney(
              value.amount,
              value.currency,
              score,
              rule.provenance,
              factExcerpt(rule),
            ),
            startsOn: annotatedDate(startsOn, score, rule.provenance, factExcerpt(rule)),
            endsOn: annotatedDate(endsOn, score, rule.provenance, factExcerpt(rule)),
            promotionAction: 'blocked',
            existingPriceId: null,
            expectedLockVersion: null,
            issueIds: [],
          },
          issueIds: [],
        };
        mappedRuleIds.add(rule.ruleId);
      }
    }

    const rowProvenance = orderedProvenance([
      ...recipient.provenance,
      ...applicableRules.flatMap((rule) => rule.provenance),
    ]);
    const located = rowProvenance.filter((item) => item.documentPage && item.blockKey);
    if (!located.length) {
      addGlobalIssue(
        'OUTPUT_PROVENANCE_UNSUPPORTED',
        [recipient.recipientId],
        applicableRules.map((rule) => rule.ruleId),
      );
      continue;
    }
    const sourceDocuments = unique(
      located.map((item) => item.documentId).filter((id): id is string => Boolean(id)),
    )
      .map((id) => sourceById.get(id))
      .filter((source): source is CommercialDocumentDomainMappingSource => Boolean(source))
      .sort(
        (left, right) => left.ordinal - right.ordinal || compare(left.documentId, right.documentId),
      );
    if (!sourceDocuments.length) {
      addGlobalIssue(
        'OUTPUT_PROVENANCE_UNSUPPORTED',
        [recipient.recipientId],
        applicableRules.map((rule) => rule.ruleId),
      );
      continue;
    }
    const rowScoreBase = Math.min(
      scoreFrom(identity.confidence.score),
      ...applicableRules.map((rule) => scoreFrom(rule.confidence.score)),
      100,
    );
    const rowScore = localIssues.length
      ? Math.min(rowScoreBase, 69)
      : semantic.coverage.status === 'partial'
        ? Math.min(rowScoreBase, 89)
        : rowScoreBase;
    const issues = localIssues
      .sort((left, right) =>
        compare(
          `${left.code}\u0000${left.ruleIds.join()}`,
          `${right.code}\u0000${right.ruleIds.join()}`,
        ),
      )
      .map((issue, index) => ({
        issueId: `issue_${String(index + 1).padStart(4, '0')}`,
        code: issue.code,
        severity: 'error',
        blocking: true,
        path: issue.code.startsWith('MSRP')
          ? '/publicPrice'
          : issue.code.startsWith('OFFER')
            ? '/offers'
            : '/issues',
        message: issueMessage[issue.code],
        evidence: evidenceFrom(
          issue.ruleIds.flatMap((ruleId) => rulesById.get(ruleId)?.provenance ?? []),
        ),
        status: 'open',
        resolution: null,
      }));
    const mmvEvidence = evidenceFrom(recipient.provenance, identity.evidence.excerpt);
    const mmvMeta = {
      origin: 'source',
      confidence: confidence(identity.confidence.score, 'Reconciled documentary MMV identity.'),
      evidence: mmvEvidence,
    };
    const row: JsonObject = {
      schemaVersion: COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_PAYLOAD_VERSION,
      source: {
        originalFileName: sourceDocuments[0]!.originalFileName,
        sourceRowNumber: rows.length + 1,
        primaryPage: Math.min(...located.map((item) => item.documentPage!)),
        applicablePages: [...new Set(located.map((item) => item.documentPage!))].sort(
          (a, b) => a - b,
        ),
        applicableBlockKeys: unique(located.map((item) => item.blockKey!)),
        fullApplicableBlockRead: semantic.coverage.status === 'complete' && !localIssues.length,
        inheritedRulePages: [
          ...new Set(
            applicableRules.flatMap((rule) =>
              rule.provenance
                .map((item) => item.documentPage)
                .filter((page): page is number => Boolean(page)),
            ),
          ),
        ].sort((a, b) => a - b),
        notes: sourceDocuments
          .slice(1)
          .map((source) => `Additional source: ${source.originalFileName}`),
      },
      mmv: {
        brand: { value: identity.brand, meta: structuredClone(mmvMeta) },
        model: { value: identity.model, meta: structuredClone(mmvMeta) },
        version: { value: identity.version, meta: structuredClone(mmvMeta) },
        modelYear: {
          value: identity.modelYear ? String(identity.modelYear) : null,
          meta: structuredClone(mmvMeta),
        },
        productionYear: {
          value: identity.productionYear ? String(identity.productionYear) : null,
          meta: structuredClone(mmvMeta),
        },
        externalCodes: [],
        ...(identity.rawYearText && (!identity.productionYear || !identity.modelYear)
          ? {
              variantRestrictions: [
                annotatedString(
                  identity.rawYearText,
                  rowScore,
                  'Ambiguous documentary year.',
                  recipient.provenance,
                  identity.evidence.excerpt,
                ),
              ],
            }
          : {}),
      },
      productMatch: {
        status: 'unmatched',
        selectedProductId: null,
        selectedBy: 'none',
        candidates: [],
        expectedProductFingerprint: null,
        issueIds: [],
      },
      commercialPeriod: {
        competence: input.commercialPeriod.competence,
        kind: input.commercialPeriod.kind,
        startsOn: annotatedDate(input.commercialPeriod.startsOn, rowScore, rowProvenance),
        endsOn: annotatedDate(input.commercialPeriod.endsOn, rowScore, rowProvenance),
        timezone: 'America/Sao_Paulo',
        issueIds: [],
      },
      publicPrice,
      policies,
      offers,
      promotionPlan: {
        mode: 'blocked',
        publishedPriceIdForOffers: null,
        affectedOffers: [],
        requiresExplicitConfirmation: true,
        issueIds: [],
      },
      issues,
      overallConfidence: confidence(
        rowScore,
        localIssues.length
          ? 'Review required by deterministic mapping issues.'
          : 'Deterministically mapped reconciled document.',
      ),
      validation: {
        blockingIssueCount: issues.length,
        warningCount: 0,
        readyForApproval: false,
        readyForPromotion: false,
      },
    };
    rows.push(row);
    mappedRecipientIds.add(recipient.recipientId);
  }

  rows.sort((left, right) =>
    compare(
      ['brand', 'model', 'version', 'productionYear', 'modelYear']
        .map((field) => String(((left.mmv as JsonObject)[field] as JsonObject).value ?? ''))
        .join('\u0000'),
      ['brand', 'model', 'version', 'productionYear', 'modelYear']
        .map((field) => String(((right.mmv as JsonObject)[field] as JsonObject).value ?? ''))
        .join('\u0000'),
    ),
  );
  rows.forEach((row, index) => ((row.source as JsonObject).sourceRowNumber = index + 1));
  const mappingIssues = issueDrafts
    .sort((left, right) =>
      compare(
        `${left.code}\u0000${left.recipientIds.join()}\u0000${left.ruleIds.join()}`,
        `${right.code}\u0000${right.recipientIds.join()}\u0000${right.ruleIds.join()}`,
      ),
    )
    .map((issue, index) => ({
      issueId: `mapping-issue-${String(index + 1).padStart(4, '0')}`,
      ...issue,
    }));
  const unresolvedRuleIds = semantic.rules
    .map((rule) => rule.ruleId)
    .filter((ruleId) => !mappedRuleIds.has(ruleId))
    .sort(compare);
  const unresolvedRecipientIds = vehicleRecipients
    .map((recipient) => recipient.recipientId)
    .filter((recipientId) => !mappedRecipientIds.has(recipientId))
    .sort(compare);
  const unresolvedItemCount =
    mappingIssues.length + unresolvedRuleIds.length + unresolvedRecipientIds.length;
  return {
    schemaVersion: COMMERCIAL_DOCUMENT_DOMAIN_MAPPING_VERSION,
    sourceReconciliationVersion: semantic.schemaVersion,
    status: unresolvedRecipientIds.length
      ? 'blocked'
      : unresolvedItemCount
        ? 'review_required'
        : 'complete',
    rows,
    mappingIssues,
    unresolvedRuleIds,
    unresolvedRecipientIds,
    coverage: {
      expectedRecipientCount: vehicleRecipients.length,
      mappedRecipientCount: mappedRecipientIds.size,
      expectedRuleCount: semantic.rules.length,
      mappedRuleCount: mappedRuleIds.size,
      expectedCompositionGroupCount: semantic.composition.groups.length,
      mappedCompositionGroupCount: mappedGroupIds.size,
      unresolvedItemCount,
    },
    provenance: orderedProvenance(semantic.provenance),
  };
}
