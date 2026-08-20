import type {
  CommercialDocumentFact,
  CommercialDocumentFactValidity,
  CommercialDocumentFactValue,
  CommercialDocumentScope,
  CommercialDocumentScopeSelector,
} from './commercial-document-extraction';
import type {
  CommercialDocumentReconciliationResult,
  CommercialDocumentReconciliationSourceRef,
  ReconciledEntity,
} from './commercial-document-reconciliation';
import { validateCommercialDocumentReconciliationResult } from './commercial-document-reconciliation';

export const SEMANTIC_COMMERCIAL_DOCUMENT_VERSION =
  'SemanticallyReconciledCommercialDocument/1' as const;

export type SemanticRecipientType =
  'DOCUMENT' | 'BRAND_LINE' | 'MODEL' | 'VERSION_SET' | 'VEHICLE' | 'CHANNEL' | 'GROUP';

export type SemanticIssueCode =
  | 'UNRESOLVED_SCOPE'
  | 'UNRESOLVED_RECIPIENT'
  | 'OVERLAPPING_RULE_CONFLICT'
  | 'AMBIGUOUS_ALIAS'
  | 'GENERAL_RULE_PARTIAL_COVERAGE'
  | 'INVALID_EXCLUSION'
  | 'UNRESOLVED_PRECEDENCE'
  | 'COMPOSITION_SCOPE_CONFLICT'
  | 'CHANNEL_SCOPE_CONFLICT'
  | 'UNRESOLVED_CONTEXT';

export interface ExplicitDocumentaryAlias {
  readonly alias: string;
  readonly canonicalLabel: string;
  readonly recipientType: 'BRAND_LINE' | 'MODEL' | 'VERSION_SET' | 'CHANNEL';
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface ExplicitDocumentaryPrecedence {
  readonly earlierFactRef: string;
  readonly laterFactRef: string;
  readonly relation: 'REPLACES' | 'CORRECTS' | 'SUPPLEMENTS';
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface DocumentaryContextAssertion {
  readonly factRef: string;
  readonly contextRef: string;
  readonly scopeRefs: readonly string[];
  readonly explicitlyScoped: boolean;
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface SemanticReconciliationDirectives {
  readonly aliases?: readonly ExplicitDocumentaryAlias[];
  readonly precedence?: readonly ExplicitDocumentaryPrecedence[];
  readonly contexts?: readonly DocumentaryContextAssertion[];
}

export interface SemanticDocumentaryRecipient {
  readonly recipientId: string;
  readonly recipientType: SemanticRecipientType;
  readonly label: string;
  readonly vehicleIdentityRef?: string;
  readonly vehicleIdentity?: {
    readonly brand: string;
    readonly model: string;
    readonly version?: string;
    readonly productionYear?: number;
    readonly modelYear?: number;
    readonly rawYearText?: string;
    readonly evidence: CommercialDocumentFact['evidence'];
    readonly confidence: CommercialDocumentFact['confidence'];
  };
  readonly sourceRef?: string;
  readonly channels: readonly string[];
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface SemanticDocumentaryRule {
  readonly ruleId: string;
  readonly sourceFactRefs: readonly string[];
  readonly sourceScopeRefs: readonly string[];
  readonly factType: CommercialDocumentFact['factType'];
  readonly rawLabel?: string;
  readonly value: CommercialDocumentFactValue;
  readonly eligibility: readonly string[];
  readonly restrictions: readonly string[];
  readonly evidence: CommercialDocumentFact['evidence'];
  readonly confidence: CommercialDocumentFact['confidence'];
  readonly applicability: readonly SemanticRecipientType[];
  readonly exclusions: CommercialDocumentScopeSelector;
  readonly channelConstraints: readonly string[];
  readonly compositionGroupRefs: readonly string[];
  readonly validity?: CommercialDocumentFactValidity;
  readonly documentaryState: 'supported' | 'review_required';
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
  readonly supersededByRuleId?: string;
}

export interface SemanticRuleApplicability {
  readonly ruleId: string;
  readonly expectedRecipientIds: readonly string[];
  readonly resolvedRecipientIds: readonly string[];
  readonly excludedRecipientIds: readonly string[];
  readonly unresolvedRecipientRefs: readonly string[];
  readonly status: 'complete' | 'partial';
}

export interface SemanticRecipientApplicability {
  readonly recipientId: string;
  readonly applicableRuleIds: readonly string[];
  readonly excludedRuleIds: readonly string[];
  readonly unresolvedRuleIds: readonly string[];
  readonly status: 'complete' | 'partial';
}

export interface SemanticRuleConflict {
  readonly conflictId: string;
  readonly status: 'resolved' | 'unresolved';
  readonly ruleRefs: readonly string[];
  readonly recipientRefs: readonly string[];
  readonly resolution?: 'EXPLICIT_REPLACEMENT' | 'EXPLICIT_CORRECTION';
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface SemanticReconciliationIssue {
  readonly issueId: string;
  readonly code: SemanticIssueCode;
  readonly severity: 'warning' | 'error';
  readonly ruleRefs: readonly string[];
  readonly recipientRefs: readonly string[];
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
  readonly message: string;
}

export interface SemanticallyReconciledCommercialDocument {
  readonly schemaVersion: typeof SEMANTIC_COMMERCIAL_DOCUMENT_VERSION;
  readonly status: 'complete' | 'partial' | 'conflicted';
  readonly rules: readonly SemanticDocumentaryRule[];
  readonly recipients: readonly SemanticDocumentaryRecipient[];
  readonly ruleApplicability: readonly SemanticRuleApplicability[];
  readonly recipientApplicability: readonly SemanticRecipientApplicability[];
  readonly composition: {
    readonly groups: readonly {
      readonly groupId: string;
      readonly groupType: 'ALTERNATIVE' | 'CUMULATIVE';
      readonly memberRuleIds: readonly string[];
      readonly sharedRuleIds: readonly string[];
      readonly parentGroupId?: string;
      readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
    }[];
  };
  readonly resolvedConflicts: readonly SemanticRuleConflict[];
  readonly unresolvedConflicts: readonly SemanticRuleConflict[];
  readonly semanticIssues: readonly SemanticReconciliationIssue[];
  readonly coverage: {
    readonly status: 'complete' | 'partial';
    readonly ruleCount: number;
    readonly fullyReconciledRuleCount: number;
    readonly recipientCount: number;
    readonly fullyCoveredRecipientCount: number;
    readonly unresolvedScopeCount: number;
  };
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface ReconcileCommercialDocumentSemanticsInput {
  readonly foundation: CommercialDocumentReconciliationResult;
  readonly directives?: SemanticReconciliationDirectives;
}

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const unique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const normalized = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
const provenanceKey = (value: CommercialDocumentReconciliationSourceRef): string =>
  `${value.artifactId}\u0000${value.sourceId}\u0000${JSON.stringify(value.evidence ?? {})}`;
const provenance = (
  values: readonly CommercialDocumentReconciliationSourceRef[],
): CommercialDocumentReconciliationSourceRef[] =>
  [...new Map(values.map((item) => [provenanceKey(item), structuredClone(item)])).values()].sort(
    (left, right) => compare(provenanceKey(left), provenanceKey(right)),
  );
const setIntersection = (left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> =>
  new Set([...left].filter((item) => right.has(item)));
const setUnion = (...sets: readonly ReadonlySet<string>[]): Set<string> =>
  new Set(sets.flatMap((set) => [...set]));

type PendingIssue = Omit<SemanticReconciliationIssue, 'issueId'>;

const valueKey = (value: CommercialDocumentFactValue): string => JSON.stringify(value);
const datesOverlap = (
  left: CommercialDocumentFactValidity | undefined,
  right: CommercialDocumentFactValidity | undefined,
): boolean => {
  const leftStart = left?.startsOn ?? '0000-01-01';
  const leftEnd = left?.endsOn ?? '9999-12-31';
  const rightStart = right?.startsOn ?? '0000-01-01';
  const rightEnd = right?.endsOn ?? '9999-12-31';
  return leftStart <= rightEnd && rightStart <= leftEnd;
};

export function validateSemanticallyReconciledCommercialDocument(
  value: SemanticallyReconciledCommercialDocument,
): void {
  if (value.schemaVersion !== SEMANTIC_COMMERCIAL_DOCUMENT_VERSION)
    throw new Error('SEMANTIC_RECONCILIATION_INVALID_VERSION');
  const recipientIds = new Set(value.recipients.map((item) => item.recipientId));
  const ruleIds = new Set(value.rules.map((item) => item.ruleId));
  if (
    value.recipients.some(
      (recipient) => recipient.recipientType === 'VEHICLE' && !recipient.vehicleIdentity,
    )
  )
    throw new Error('SEMANTIC_RECONCILIATION_MISSING_VEHICLE_IDENTITY');
  if (!value.composition || !Array.isArray(value.composition.groups))
    throw new Error('SEMANTIC_RECONCILIATION_MISSING_COMPOSITION');
  const groupIds = new Set(value.composition.groups.map((group) => group.groupId));
  if (groupIds.size !== value.composition.groups.length)
    throw new Error('SEMANTIC_RECONCILIATION_DUPLICATE_GROUP');
  for (const group of value.composition.groups) {
    if (group.parentGroupId && !groupIds.has(group.parentGroupId))
      throw new Error('SEMANTIC_RECONCILIATION_UNKNOWN_PARENT_GROUP');
    for (const ruleId of [...group.memberRuleIds, ...group.sharedRuleIds])
      if (!ruleIds.has(ruleId)) throw new Error('SEMANTIC_RECONCILIATION_UNKNOWN_GROUP_RULE');
    const visited = new Set<string>([group.groupId]);
    let parentId = group.parentGroupId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error('SEMANTIC_RECONCILIATION_GROUP_CYCLE');
      visited.add(parentId);
      parentId = value.composition.groups.find(
        (candidate) => candidate.groupId === parentId,
      )?.parentGroupId;
    }
  }
  for (const applicability of value.ruleApplicability) {
    if (!ruleIds.has(applicability.ruleId)) throw new Error('SEMANTIC_RECONCILIATION_UNKNOWN_RULE');
    for (const recipientId of [
      ...applicability.resolvedRecipientIds,
      ...applicability.excludedRecipientIds,
    ])
      if (!recipientIds.has(recipientId))
        throw new Error('SEMANTIC_RECONCILIATION_UNKNOWN_RECIPIENT');
  }
  for (const recipient of value.recipientApplicability) {
    const forwardApplicable = value.ruleApplicability
      .filter((item) => item.resolvedRecipientIds.includes(recipient.recipientId))
      .map((item) => item.ruleId)
      .sort(compare);
    const forwardExcluded = value.ruleApplicability
      .filter((item) => item.excludedRecipientIds.includes(recipient.recipientId))
      .map((item) => item.ruleId)
      .sort(compare);
    if (JSON.stringify(forwardApplicable) !== JSON.stringify(recipient.applicableRuleIds))
      throw new Error('SEMANTIC_RECONCILIATION_BIDIRECTIONAL_APPLICABLE_MISMATCH');
    if (JSON.stringify(forwardExcluded) !== JSON.stringify(recipient.excludedRuleIds))
      throw new Error('SEMANTIC_RECONCILIATION_BIDIRECTIONAL_EXCLUDED_MISMATCH');
  }
  if (
    value.recipients.some(
      (recipient) =>
        !value.recipientApplicability.some((item) => item.recipientId === recipient.recipientId),
    )
  )
    throw new Error('SEMANTIC_RECONCILIATION_MISSING_RECIPIENT_PROJECTION');
}

export function reconcileCommercialDocumentSemantics(
  input: ReconcileCommercialDocumentSemanticsInput,
): SemanticallyReconciledCommercialDocument {
  validateCommercialDocumentReconciliationResult(input.foundation);
  const foundation = input.foundation;
  const directives = input.directives ?? {};
  const pendingIssues: PendingIssue[] = [];
  const addIssue = (
    code: SemanticIssueCode,
    severity: 'warning' | 'error',
    ruleRefs: readonly string[],
    recipientRefs: readonly string[],
    issueProvenance: readonly CommercialDocumentReconciliationSourceRef[],
    message: string,
  ): void => {
    pendingIssues.push({
      code,
      severity,
      ruleRefs: unique(ruleRefs),
      recipientRefs: unique(recipientRefs),
      provenance: provenance(issueProvenance),
      message,
    });
  };

  const aliases = new Map<string, string>();
  const ambiguousAliases = new Set<string>();
  for (const alias of [...(directives.aliases ?? [])].sort((left, right) =>
    compare(
      `${left.recipientType}\u0000${left.alias}`,
      `${right.recipientType}\u0000${right.alias}`,
    ),
  )) {
    const key = `${alias.recipientType}\u0000${normalized(alias.alias)}`;
    const target = normalized(alias.canonicalLabel);
    const existing = aliases.get(key);
    if (existing && existing !== target) ambiguousAliases.add(key);
    else aliases.set(key, target);
  }
  const resolveLabel = (type: SemanticRecipientType, value: string): string | undefined => {
    const key = `${type}\u0000${normalized(value)}`;
    if (ambiguousAliases.has(key)) return undefined;
    return aliases.get(key) ?? normalized(value);
  };

  const vehicleRecipients: SemanticDocumentaryRecipient[] = [...foundation.vehicleIdentities]
    .sort((left, right) => compare(left.reconciledId, right.reconciledId))
    .map((item) => ({
      recipientId: `recipient-vehicle-${item.reconciledId}`,
      recipientType: 'VEHICLE',
      label: [item.value.brand, item.value.model, item.value.version].filter(Boolean).join(' '),
      vehicleIdentityRef: item.reconciledId,
      vehicleIdentity: {
        brand: item.value.brand,
        model: item.value.model,
        ...(item.value.version ? { version: item.value.version } : {}),
        ...(item.value.productionYear ? { productionYear: item.value.productionYear } : {}),
        ...(item.value.modelYear ? { modelYear: item.value.modelYear } : {}),
        ...(item.value.rawYearText ? { rawYearText: item.value.rawYearText } : {}),
        evidence: structuredClone(item.value.evidence),
        confidence: structuredClone(item.value.confidence),
      },
      channels: [],
      provenance: provenance(item.provenance),
    }));
  const vehicleRecipientByIdentity = new Map(
    vehicleRecipients.map((recipient) => [recipient.vehicleIdentityRef!, recipient.recipientId]),
  );
  const allVehicles = new Set(vehicleRecipients.map((item) => item.recipientId));
  const identityByRecipient = new Map(
    vehicleRecipients.map((recipient) => [
      recipient.recipientId,
      foundation.vehicleIdentities.find(
        (identity) => identity.reconciledId === recipient.vehicleIdentityRef,
      )!,
    ]),
  );
  const scopes = new Map(foundation.scopes.map((item) => [item.reconciledId, item]));
  const groups = new Map(foundation.composition.groups.map((item) => [item.reconciledId, item]));
  const facts = new Map(foundation.facts.map((item) => [item.reconciledId, item]));

  const baseIndex = (field: 'brand' | 'model' | 'version'): Map<string, Set<string>> => {
    const result = new Map<string, Set<string>>();
    for (const recipient of vehicleRecipients) {
      const identity = identityByRecipient.get(recipient.recipientId)!.value;
      const raw = identity[field];
      if (!raw) continue;
      const type = field === 'brand' ? 'BRAND_LINE' : field === 'model' ? 'MODEL' : 'VERSION_SET';
      const key = resolveLabel(type, raw)!;
      result.set(key, new Set([...(result.get(key) ?? []), recipient.recipientId]));
    }
    return result;
  };
  const brandIndex = baseIndex('brand');
  const modelIndex = baseIndex('model');
  const versionIndex = baseIndex('version');

  const resolveSelectorValues = (
    type: SemanticRecipientType,
    values: readonly string[] | undefined,
    index: ReadonlyMap<string, Set<string>>,
  ): { recipients: Set<string>; unresolved: string[] } => {
    const recipients = new Set<string>();
    const unresolved: string[] = [];
    for (const value of values ?? []) {
      const aliasKey = `${type}\u0000${normalized(value)}`;
      if (ambiguousAliases.has(aliasKey)) {
        unresolved.push(value);
        continue;
      }
      const found = index.get(resolveLabel(type, value)!);
      if (found) found.forEach((recipient) => recipients.add(recipient));
      else unresolved.push(value);
    }
    return { recipients, unresolved };
  };

  const resolveScope = (
    scope: ReconciledEntity<CommercialDocumentScope>,
    visiting = new Set<string>(),
  ): {
    candidates: Set<string>;
    excluded: Set<string>;
    unresolved: string[];
    channels: string[];
  } => {
    if (visiting.has(scope.reconciledId))
      return {
        candidates: new Set(),
        excluded: new Set(),
        unresolved: [scope.reconciledId],
        channels: [],
      };
    const next = new Set(visiting).add(scope.reconciledId);
    const selector = scope.value.selector;
    let candidates = new Set<string>();
    const unresolved: string[] = [];
    if (scope.value.ambiguous || scope.value.requiresReview) unresolved.push(scope.reconciledId);
    if (scope.value.scopeType === 'DOCUMENT') candidates = new Set(allVehicles);
    else if (scope.value.scopeType === 'BRAND_LINE') {
      const result = resolveSelectorValues('BRAND_LINE', selector.brandLines, brandIndex);
      candidates = result.recipients;
      unresolved.push(...result.unresolved);
    } else if (scope.value.scopeType === 'MODEL') {
      const result = resolveSelectorValues('MODEL', selector.models, modelIndex);
      candidates = result.recipients;
      unresolved.push(...result.unresolved);
    } else if (scope.value.scopeType === 'VERSION_SET') {
      if (selector.vehicleIdentityIds?.length)
        for (const id of selector.vehicleIdentityIds) {
          const recipient = vehicleRecipientByIdentity.get(id);
          if (recipient) candidates.add(recipient);
          else unresolved.push(id);
        }
      const result = resolveSelectorValues('VERSION_SET', selector.versions, versionIndex);
      candidates = setUnion(candidates, result.recipients);
      unresolved.push(...result.unresolved);
    } else if (scope.value.scopeType === 'VEHICLE') {
      for (const id of selector.vehicleIdentityIds ?? []) {
        const recipient = vehicleRecipientByIdentity.get(id);
        if (recipient) candidates.add(recipient);
        else unresolved.push(id);
      }
    } else if (scope.value.scopeType === 'CHANNEL') {
      candidates = new Set(allVehicles);
    } else if (scope.value.scopeType === 'GROUP') {
      for (const groupId of selector.groupIds ?? []) {
        const group = groups.get(groupId);
        if (!group) {
          unresolved.push(groupId);
          continue;
        }
        const groupSets: Set<string>[] = [];
        for (const scopeId of group.scopeIds) {
          const groupScope = scopes.get(scopeId);
          if (groupScope) {
            const resolved = resolveScope(groupScope, next);
            groupSets.push(resolved.candidates);
            unresolved.push(...resolved.unresolved);
          }
        }
        for (const factId of [...group.memberFactIds, ...group.sharedFactIds]) {
          const fact = facts.get(factId);
          for (const scopeId of fact?.value.scopeIds ?? []) {
            const groupScope = scopes.get(scopeId);
            if (groupScope && groupScope.value.scopeType !== 'GROUP') {
              const resolved = resolveScope(groupScope, next);
              groupSets.push(resolved.candidates);
              unresolved.push(...resolved.unresolved);
            }
          }
        }
        candidates = setUnion(candidates, ...groupSets);
      }
    }

    const excluded = new Set<string>();
    const exclusions = scope.value.exclusions;
    for (const id of exclusions.vehicleIdentityIds ?? []) {
      const recipient = vehicleRecipientByIdentity.get(id);
      if (recipient) excluded.add(recipient);
      else unresolved.push(id);
    }
    const exclusionLookups: Array<
      [SemanticRecipientType, readonly string[] | undefined, Map<string, Set<string>>]
    > = [
      ['BRAND_LINE', exclusions.brandLines, brandIndex],
      ['MODEL', exclusions.models, modelIndex],
      ['VERSION_SET', exclusions.versions, versionIndex],
    ];
    for (const [type, values, index] of exclusionLookups) {
      const result = resolveSelectorValues(type, values, index);
      result.recipients.forEach((recipient) => excluded.add(recipient));
      unresolved.push(...result.unresolved);
    }
    for (const groupId of exclusions.groupIds ?? []) {
      const groupScope: ReconciledEntity<CommercialDocumentScope> = {
        reconciledId: `${scope.reconciledId}-exclusion-${groupId}`,
        value: {
          ...scope.value,
          scopeId: `${scope.value.scopeId}-exclusion`,
          scopeType: 'GROUP',
          selector: { groupIds: [groupId] },
          exclusions: {},
        },
        provenance: scope.provenance,
      };
      const result = resolveScope(groupScope, next);
      result.candidates.forEach((recipient) => excluded.add(recipient));
      unresolved.push(...result.unresolved);
    }
    return {
      candidates,
      excluded,
      unresolved: unique(unresolved),
      channels: unique(selector.channels ?? []),
    };
  };

  const factToRule = new Map<string, string>();
  const rules: SemanticDocumentaryRule[] = [...foundation.facts]
    .sort((left, right) => compare(left.reconciledId, right.reconciledId))
    .map((fact, index) => {
      const ruleId = `semantic-rule-${String(index + 1).padStart(4, '0')}`;
      factToRule.set(fact.reconciledId, ruleId);
      const factScopes = fact.value.scopeIds
        .map((id) => scopes.get(id))
        .filter(Boolean) as ReconciledEntity<CommercialDocumentScope>[];
      const compositionGroupRefs = foundation.composition.groups
        .filter((group) =>
          [...group.memberFactIds, ...group.sharedFactIds].includes(fact.reconciledId),
        )
        .map((group) => group.reconciledId)
        .sort(compare);
      return {
        ruleId,
        sourceFactRefs: [fact.reconciledId],
        sourceScopeRefs: factScopes.map((scope) => scope.reconciledId).sort(compare),
        factType: fact.value.factType,
        ...(fact.value.rawLabel ? { rawLabel: fact.value.rawLabel } : {}),
        value: structuredClone(fact.value.value),
        eligibility: [...fact.value.eligibility].sort(compare),
        restrictions: [...fact.value.restrictions].sort(compare),
        evidence: structuredClone(fact.value.evidence),
        confidence: structuredClone(fact.value.confidence),
        applicability: unique(
          factScopes.map((scope) => scope.value.scopeType),
        ) as SemanticRecipientType[],
        exclusions: Object.assign(
          {},
          ...factScopes.map((scope) => structuredClone(scope.value.exclusions)),
        ),
        channelConstraints: unique([
          ...(fact.value.channel ? [fact.value.channel] : []),
          ...factScopes.flatMap((scope) => scope.value.selector.channels ?? []),
        ]),
        compositionGroupRefs,
        ...(fact.value.validity ? { validity: structuredClone(fact.value.validity) } : {}),
        documentaryState:
          fact.value.confidence.ambiguous ||
          fact.value.confidence.requiresReview ||
          factScopes.some((scope) => scope.value.ambiguous || scope.value.requiresReview)
            ? 'review_required'
            : 'supported',
        provenance: provenance([
          ...fact.provenance,
          ...factScopes.flatMap((scope) => scope.provenance),
        ]),
      };
    });

  const channelToVehicles = new Map<string, Set<string>>();
  for (const fact of foundation.facts) {
    const channels = unique([
      ...(fact.value.channel ? [fact.value.channel] : []),
      ...fact.value.scopeIds.flatMap((id) => scopes.get(id)?.value.selector.channels ?? []),
    ]);
    if (!channels.length) continue;
    const vehicleScopes = fact.value.scopeIds
      .map((id) => scopes.get(id))
      .filter(
        (scope) => scope && scope.value.scopeType !== 'CHANNEL',
      ) as ReconciledEntity<CommercialDocumentScope>[];
    const resolved = vehicleScopes.length
      ? vehicleScopes.map((scope) => resolveScope(scope).candidates).reduce(setIntersection)
      : new Set<string>();
    for (const channel of channels) {
      const key = normalized(channel);
      channelToVehicles.set(key, setUnion(channelToVehicles.get(key) ?? new Set(), resolved));
    }
  }
  const recipients = vehicleRecipients.map((recipient) => ({
    ...recipient,
    channels: [...channelToVehicles.entries()]
      .filter(([, ids]) => ids.has(recipient.recipientId))
      .map(([channel]) => channel)
      .sort(compare),
  }));
  const abstractRecipients: SemanticDocumentaryRecipient[] = [
    ...unique(foundation.scopes.flatMap((item) => item.value.selector.documentIds ?? [])).map(
      (label) => ({ recipientType: 'DOCUMENT' as const, label }),
    ),
    ...[...brandIndex.keys()].map((label) => ({ recipientType: 'BRAND_LINE' as const, label })),
    ...[...modelIndex.keys()].map((label) => ({ recipientType: 'MODEL' as const, label })),
    ...[...versionIndex.keys()].map((label) => ({ recipientType: 'VERSION_SET' as const, label })),
    ...[...channelToVehicles.keys()].map((label) => ({ recipientType: 'CHANNEL' as const, label })),
    ...foundation.composition.groups.map((group) => ({
      recipientType: 'GROUP' as const,
      label: group.reconciledId,
      sourceRef: group.reconciledId,
    })),
  ]
    .sort((left, right) =>
      compare(
        `${left.recipientType}\u0000${left.label}`,
        `${right.recipientType}\u0000${right.label}`,
      ),
    )
    .map((item, index) => ({
      recipientId: `recipient-context-${String(index + 1).padStart(4, '0')}`,
      ...item,
      channels: item.recipientType === 'CHANNEL' ? [item.label] : [],
      provenance: [],
    }));
  const allRecipients = [...recipients, ...abstractRecipients];

  const ruleApplicability: SemanticRuleApplicability[] = rules.map((rule) => {
    const fact = facts.get(rule.sourceFactRefs[0]!)!;
    const ruleScopes = rule.sourceScopeRefs.map((id) => scopes.get(id)!).filter(Boolean);
    const positiveScopes = ruleScopes.filter((scope) => scope.value.scopeType !== 'CHANNEL');
    const resolvedScopes = positiveScopes.map((scope) => resolveScope(scope));
    let candidates = resolvedScopes.length
      ? resolvedScopes.map((item) => item.candidates).reduce(setIntersection)
      : new Set(allVehicles);
    const excluded = setUnion(...resolvedScopes.map((item) => item.excluded));
    let unresolved = unique(resolvedScopes.flatMap((item) => item.unresolved));
    const channelScopes = ruleScopes.filter((scope) => scope.value.scopeType === 'CHANNEL');
    const channels = unique([
      ...(fact.value.channel ? [fact.value.channel] : []),
      ...channelScopes.flatMap((scope) => scope.value.selector.channels ?? []),
    ]);
    if (channels.length) {
      const channelSets: Set<string>[] = [];
      for (const channel of channels) {
        const matched = channelToVehicles.get(normalized(channel));
        if (matched?.size) channelSets.push(matched);
        else unresolved.push(channel);
      }
      if (channelSets.length) candidates = setIntersection(candidates, setUnion(...channelSets));
    }
    for (const scope of ruleScopes) {
      const channelExclusions = scope.value.exclusions.channels ?? [];
      for (const channel of channelExclusions) {
        const matched = channelToVehicles.get(normalized(channel));
        if (matched) matched.forEach((id) => excluded.add(id));
        else unresolved.push(channel);
      }
    }
    excluded.forEach((id) => candidates.delete(id));
    unresolved = unique(unresolved);
    if (unresolved.length)
      addIssue(
        'UNRESOLVED_SCOPE',
        'error',
        [rule.ruleId],
        unresolved,
        rule.provenance,
        'Documentary scope could not be resolved without inference.',
      );
    if (
      rule.applicability.includes('DOCUMENT') &&
      candidates.size < allVehicles.size - excluded.size
    )
      addIssue(
        'GENERAL_RULE_PARTIAL_COVERAGE',
        'error',
        [rule.ruleId],
        [...candidates],
        rule.provenance,
        'Document-wide rule does not cover every deterministically eligible recipient.',
      );
    return {
      ruleId: rule.ruleId,
      expectedRecipientIds: unique([...candidates, ...excluded]),
      resolvedRecipientIds: unique([...candidates]),
      excludedRecipientIds: unique([...excluded]),
      unresolvedRecipientRefs: unresolved,
      status: unresolved.length ? 'partial' : 'complete',
    };
  });

  for (const key of [...ambiguousAliases].sort(compare))
    addIssue(
      'AMBIGUOUS_ALIAS',
      'error',
      [],
      [key.split('\u0000')[1]!],
      (directives.aliases ?? [])
        .filter((item) => key.endsWith(`\u0000${normalized(item.alias)}`))
        .flatMap((item) => item.provenance),
      'Documentary alias has more than one explicit target.',
    );
  for (const context of [...(directives.contexts ?? [])].sort((a, b) =>
    compare(`${a.factRef}\u0000${a.contextRef}`, `${b.factRef}\u0000${b.contextRef}`),
  ))
    if (!context.explicitlyScoped || !context.scopeRefs.length)
      addIssue(
        'UNRESOLVED_CONTEXT',
        'warning',
        [factToRule.get(context.factRef) ?? context.factRef],
        [context.contextRef],
        context.provenance,
        'Documentary note or context has no explicit resolvable scope.',
      );

  const precedenceByPair = new Map<string, ExplicitDocumentaryPrecedence>();
  for (const directive of [...(directives.precedence ?? [])].sort((a, b) =>
    compare(
      `${a.earlierFactRef}\u0000${a.laterFactRef}`,
      `${b.earlierFactRef}\u0000${b.laterFactRef}`,
    ),
  ))
    precedenceByPair.set(
      `${factToRule.get(directive.earlierFactRef)}\u0000${factToRule.get(directive.laterFactRef)}`,
      directive,
    );
  const mutableRules = rules.map((rule) => ({ ...rule }));
  const conflicts: Omit<SemanticRuleConflict, 'conflictId'>[] = [];
  for (let leftIndex = 0; leftIndex < mutableRules.length; leftIndex += 1) {
    const left = mutableRules[leftIndex]!;
    const leftApplication = ruleApplicability[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < mutableRules.length; rightIndex += 1) {
      const right = mutableRules[rightIndex]!;
      if (
        left.factType !== right.factType ||
        valueKey(left.value) === valueKey(right.value) ||
        !datesOverlap(left.validity, right.validity)
      )
        continue;
      const recipientsInConflict = leftApplication.resolvedRecipientIds.filter((id) =>
        ruleApplicability[rightIndex]!.resolvedRecipientIds.includes(id),
      );
      if (!recipientsInConflict.length) continue;
      const forward = precedenceByPair.get(`${left.ruleId}\u0000${right.ruleId}`);
      const reverse = precedenceByPair.get(`${right.ruleId}\u0000${left.ruleId}`);
      const directive = forward ?? reverse;
      const resolved = directive && directive.relation !== 'SUPPLEMENTS';
      if (resolved) {
        const earlier = forward ? left : right;
        const later = forward ? right : left;
        const index = mutableRules.findIndex((item) => item.ruleId === earlier.ruleId);
        mutableRules[index] = { ...earlier, supersededByRuleId: later.ruleId };
      }
      conflicts.push({
        status: resolved ? 'resolved' : 'unresolved',
        ruleRefs: [left.ruleId, right.ruleId],
        recipientRefs: unique(recipientsInConflict),
        ...(resolved
          ? {
              resolution:
                directive!.relation === 'CORRECTS'
                  ? ('EXPLICIT_CORRECTION' as const)
                  : ('EXPLICIT_REPLACEMENT' as const),
            }
          : {}),
        provenance: provenance([
          ...(directive?.provenance ?? []),
          ...left.provenance,
          ...right.provenance,
        ]),
      });
      if (!resolved)
        addIssue(
          directive?.relation === 'SUPPLEMENTS'
            ? 'UNRESOLVED_PRECEDENCE'
            : 'OVERLAPPING_RULE_CONFLICT',
          'error',
          [left.ruleId, right.ruleId],
          recipientsInConflict,
          [...left.provenance, ...right.provenance],
          directive?.relation === 'SUPPLEMENTS'
            ? 'Supplement does not establish replacement precedence for incompatible rules.'
            : 'Overlapping incompatible documentary rules have no explicit precedence.',
        );
    }
  }
  const orderedConflicts = conflicts
    .sort((a, b) => compare(a.ruleRefs.join('\u0000'), b.ruleRefs.join('\u0000')))
    .map((conflict, index) => ({
      conflictId: `semantic-conflict-${String(index + 1).padStart(4, '0')}`,
      ...conflict,
    }));
  const semanticIssues = pendingIssues
    .sort((a, b) =>
      compare(
        `${a.code}\u0000${a.ruleRefs.join('\u0000')}\u0000${a.recipientRefs.join('\u0000')}`,
        `${b.code}\u0000${b.ruleRefs.join('\u0000')}\u0000${b.recipientRefs.join('\u0000')}`,
      ),
    )
    .map((item, index) => ({
      issueId: `semantic-issue-${String(index + 1).padStart(4, '0')}`,
      ...item,
    }));
  const recipientApplicability: SemanticRecipientApplicability[] = allRecipients.map(
    (recipient) => {
      const applicableRuleIds = ruleApplicability
        .filter((item) => item.resolvedRecipientIds.includes(recipient.recipientId))
        .map((item) => item.ruleId)
        .sort(compare);
      const excludedRuleIds = ruleApplicability
        .filter((item) => item.excludedRecipientIds.includes(recipient.recipientId))
        .map((item) => item.ruleId)
        .sort(compare);
      const unresolvedRuleIds = ruleApplicability
        .filter((item) => item.unresolvedRecipientRefs.length)
        .map((item) => item.ruleId)
        .sort(compare);
      return {
        recipientId: recipient.recipientId,
        applicableRuleIds,
        excludedRuleIds,
        unresolvedRuleIds,
        status: unresolvedRuleIds.length ? 'partial' : 'complete',
      };
    },
  );
  const fullyReconciledRuleCount = ruleApplicability.filter(
    (item) => item.status === 'complete',
  ).length;
  const fullyCoveredRecipientCount = recipientApplicability.filter(
    (item) =>
      recipients.some((recipient) => recipient.recipientId === item.recipientId) &&
      item.status === 'complete',
  ).length;
  const coverage = {
    status:
      fullyReconciledRuleCount === rules.length &&
      fullyCoveredRecipientCount === recipients.length &&
      !semanticIssues.length
        ? ('complete' as const)
        : ('partial' as const),
    ruleCount: rules.length,
    fullyReconciledRuleCount,
    recipientCount: recipients.length,
    fullyCoveredRecipientCount,
    unresolvedScopeCount: semanticIssues.filter((item) => item.code === 'UNRESOLVED_SCOPE').length,
  };
  const unresolvedConflicts = orderedConflicts.filter((item) => item.status === 'unresolved');
  const result: SemanticallyReconciledCommercialDocument = {
    schemaVersion: SEMANTIC_COMMERCIAL_DOCUMENT_VERSION,
    status: unresolvedConflicts.length
      ? 'conflicted'
      : coverage.status === 'partial'
        ? 'partial'
        : 'complete',
    rules: mutableRules,
    recipients: allRecipients,
    ruleApplicability,
    recipientApplicability,
    composition: {
      groups: foundation.composition.groups
        .map((group) => ({
          groupId: group.reconciledId,
          groupType: group.groupType,
          memberRuleIds: group.memberFactIds
            .map((factId) => factToRule.get(factId))
            .filter((ruleId): ruleId is string => Boolean(ruleId))
            .sort(compare),
          sharedRuleIds: group.sharedFactIds
            .map((factId) => factToRule.get(factId))
            .filter((ruleId): ruleId is string => Boolean(ruleId))
            .sort(compare),
          ...(group.parentGroupId ? { parentGroupId: group.parentGroupId } : {}),
          provenance: provenance(group.provenance),
        }))
        .sort((left, right) => compare(left.groupId, right.groupId)),
    },
    resolvedConflicts: orderedConflicts.filter((item) => item.status === 'resolved'),
    unresolvedConflicts,
    semanticIssues,
    coverage,
    provenance: provenance([
      ...foundation.vehicleIdentities.flatMap((item) => item.provenance),
      ...foundation.facts.flatMap((item) => item.provenance),
      ...foundation.scopes.flatMap((item) => item.provenance),
    ]),
  };
  validateSemanticallyReconciledCommercialDocument(result);
  return result;
}
