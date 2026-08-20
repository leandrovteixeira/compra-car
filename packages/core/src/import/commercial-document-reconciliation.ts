import type {
  CommercialDocumentCompositionGroup,
  CommercialDocumentCompositionRelation,
  CommercialDocumentEvidence,
  CommercialDocumentExtractionV1,
  CommercialDocumentFact,
  CommercialDocumentScope,
  CommercialDocumentVehicleIdentity,
} from './commercial-document-extraction';
import { validateCommercialDocumentExtraction } from './commercial-document-extraction-validator';
import type {
  CommercialDocumentMapV1,
  CommercialExtractionUnit,
  CommercialExtractionUnitPlanV1,
} from './commercial-document-map';
import {
  validateCommercialDocumentMap,
  validateCommercialExtractionUnitPlan,
} from './commercial-document-map-validator';

export const COMMERCIAL_DOCUMENT_RECONCILIATION_VERSION =
  'CommercialDocumentReconciliationResult/1' as const;

export type CommercialDocumentReconciliationIssueCode =
  | 'MISSING_UNIT_ARTIFACT'
  | 'UNPLANNED_ARTIFACT'
  | 'DUPLICATE_UNIT_ARTIFACT'
  | 'INVALID_ARTIFACT'
  | 'INCONSISTENT_UNIT_ORDINAL'
  | 'MISSING_TABLE_PARTITION'
  | 'DUPLICATE_TABLE_PARTITION'
  | 'TABLE_CONTINUITY_UNPROVEN'
  | 'IDENTITY_CONFLICT'
  | 'FACT_CONFLICT'
  | 'SCOPE_CONFLICT'
  | 'DANGLING_REFERENCE'
  | 'COVERAGE_MISMATCH';

export interface CommercialDocumentReconciliationArtifactInput {
  readonly unitId: string;
  readonly ordinal: number;
  readonly artifact: unknown;
}

export interface CommercialDocumentReconciliationSourceRef {
  readonly artifactId: string;
  readonly unitId: string;
  readonly unitOrdinal: number;
  readonly sourceId: string;
  readonly evidence?: CommercialDocumentEvidence;
  readonly documentId?: string;
  readonly documentPage?: number;
  readonly blockKey?: string;
}

export interface ReconciledEntity<T> {
  readonly reconciledId: string;
  readonly value: T;
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface ReconciledCompositionGroup {
  readonly reconciledId: string;
  readonly groupType: CommercialDocumentCompositionGroup['groupType'];
  readonly memberFactIds: readonly string[];
  readonly sharedFactIds: readonly string[];
  readonly scopeIds: readonly string[];
  readonly parentGroupId?: string;
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface ReconciledCompositionRelation {
  readonly reconciledId: string;
  readonly relationType: CommercialDocumentCompositionRelation['relationType'];
  readonly factIds: readonly string[];
  readonly groupIds: readonly string[];
  readonly scopeIds: readonly string[];
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
}

export interface CommercialDocumentReconciliationIssue {
  readonly issueId: string;
  readonly code: CommercialDocumentReconciliationIssueCode;
  readonly severity: 'warning' | 'error';
  readonly affectedRefs: readonly string[];
  readonly provenance: readonly CommercialDocumentReconciliationSourceRef[];
  readonly message: string;
}

export interface CommercialDocumentReconciliationCoverage {
  readonly status: 'complete' | 'partial';
  readonly plannedUnitCount: number;
  readonly validArtifactCount: number;
  readonly coveredUnitIds: readonly string[];
  readonly missingUnitIds: readonly string[];
  readonly unplannedUnitIds: readonly string[];
  readonly logicalTables: readonly {
    logicalTableId: string;
    expectedPartitionCount: number;
    availablePartitionIndexes: readonly number[];
    inheritedHeaderBlockIds: readonly string[];
    structurallyContinuous: boolean;
  }[];
}

export interface CommercialDocumentReconciliationResult {
  readonly schemaVersion: typeof COMMERCIAL_DOCUMENT_RECONCILIATION_VERSION;
  readonly status: 'complete' | 'partial' | 'conflicted';
  readonly sourceArtifacts: readonly {
    artifactId: string;
    unitId: string;
    ordinal: number;
    valid: boolean;
  }[];
  readonly vehicleIdentities: readonly ReconciledEntity<CommercialDocumentVehicleIdentity>[];
  readonly facts: readonly ReconciledEntity<CommercialDocumentFact>[];
  readonly scopes: readonly ReconciledEntity<CommercialDocumentScope>[];
  readonly composition: {
    readonly groups: readonly ReconciledCompositionGroup[];
    readonly relationships: readonly ReconciledCompositionRelation[];
  };
  readonly coverage: CommercialDocumentReconciliationCoverage;
  readonly duplicates: readonly {
    duplicateType: 'IDENTITY' | 'FACT' | 'SCOPE' | 'GROUP' | 'RELATIONSHIP';
    reconciledId: string;
    sourceRefs: readonly CommercialDocumentReconciliationSourceRef[];
  }[];
  readonly conflicts: readonly CommercialDocumentReconciliationIssue[];
  readonly unresolvedAmbiguities: readonly string[];
  readonly issues: readonly CommercialDocumentReconciliationIssue[];
}

export interface ReconcileCommercialDocumentExtractionsInput {
  readonly documentMap: CommercialDocumentMapV1;
  readonly unitPlan: CommercialExtractionUnitPlanV1;
  readonly artifacts: readonly CommercialDocumentReconciliationArtifactInput[];
}

const compare = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort(compare);
const normalizeText = (value: string): string =>
  value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort(compare)
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(typeof value === 'string' ? normalizeText(value) : value);
};
const without = <T extends object>(value: T, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const evidenceKey = (value: CommercialDocumentEvidence): string => canonical(value);
const provenanceKey = (value: CommercialDocumentReconciliationSourceRef): string =>
  `${value.artifactId}\u0000${value.sourceId}\u0000${value.evidence ? evidenceKey(value.evidence) : ''}`;
const sortProvenance = (
  values: readonly CommercialDocumentReconciliationSourceRef[],
): CommercialDocumentReconciliationSourceRef[] =>
  [...new Map(values.map((value) => [provenanceKey(value), value])).values()].sort((left, right) =>
    compare(provenanceKey(left), provenanceKey(right)),
  );

type ValidSource = CommercialDocumentReconciliationArtifactInput & {
  readonly artifactId: string;
  readonly artifact: CommercialDocumentExtractionV1;
  readonly unit: CommercialExtractionUnit;
};
type Bucket<T> = { value: T; provenance: CommercialDocumentReconciliationSourceRef[] };

const sourceRef = (
  source: ValidSource,
  sourceId: string,
  evidence?: CommercialDocumentEvidence,
): CommercialDocumentReconciliationSourceRef => {
  const block = evidence?.blockIds
    .map((blockId) => source.artifact.blocks.find((item) => item.blockId === blockId))
    .find(Boolean);
  return {
    artifactId: source.artifactId,
    unitId: source.unitId,
    unitOrdinal: source.ordinal,
    sourceId,
    ...(evidence ? { evidence: structuredClone(evidence) } : {}),
    ...(block
      ? { documentId: block.documentId, documentPage: block.page, blockKey: block.blockId }
      : {}),
  };
};

const issueFactory = () => {
  const pending: Omit<CommercialDocumentReconciliationIssue, 'issueId'>[] = [];
  const add = (
    code: CommercialDocumentReconciliationIssueCode,
    severity: 'warning' | 'error',
    affectedRefs: readonly string[],
    provenance: readonly CommercialDocumentReconciliationSourceRef[],
    message: string,
  ): void => {
    pending.push({
      code,
      severity,
      affectedRefs: sortedUnique(affectedRefs),
      provenance: sortProvenance(provenance),
      message,
    });
  };
  const finish = (): CommercialDocumentReconciliationIssue[] =>
    pending
      .sort((left, right) =>
        compare(
          `${left.code}\u0000${left.affectedRefs.join('\u0000')}\u0000${left.message}`,
          `${right.code}\u0000${right.affectedRefs.join('\u0000')}\u0000${right.message}`,
        ),
      )
      .map((issue, index) => ({
        issueId: `reconciliation-issue-${String(index + 1).padStart(4, '0')}`,
        ...issue,
      }));
  return { add, finish };
};

const findTransportDanglingReferences = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') return [];
  const artifact = value as Partial<CommercialDocumentExtractionV1>;
  if (!Array.isArray(artifact.facts) || !Array.isArray(artifact.scopes)) return [];
  const scopeIds = new Set(
    artifact.scopes
      .map((scope) => scope?.scopeId)
      .filter((id): id is string => typeof id === 'string'),
  );
  return sortedUnique(
    artifact.facts.flatMap((fact) =>
      Array.isArray(fact?.scopeIds)
        ? fact.scopeIds.filter(
            (id: unknown): id is string => typeof id === 'string' && !scopeIds.has(id),
          )
        : [],
    ),
  );
};

export function validateCommercialDocumentReconciliationResult(
  value: CommercialDocumentReconciliationResult,
): void {
  if (value.schemaVersion !== COMMERCIAL_DOCUMENT_RECONCILIATION_VERSION)
    throw new Error('COMMERCIAL_DOCUMENT_RECONCILIATION_INVALID_VERSION');
  const ids = [
    ...value.vehicleIdentities.map((item) => item.reconciledId),
    ...value.facts.map((item) => item.reconciledId),
    ...value.scopes.map((item) => item.reconciledId),
    ...value.composition.groups.map((item) => item.reconciledId),
    ...value.composition.relationships.map((item) => item.reconciledId),
    ...value.issues.map((item) => item.issueId),
  ];
  if (new Set(ids).size !== ids.length)
    throw new Error('COMMERCIAL_DOCUMENT_RECONCILIATION_DUPLICATE_ID');
}

export function reconcileCommercialDocumentExtractions(
  input: ReconcileCommercialDocumentExtractionsInput,
): CommercialDocumentReconciliationResult {
  validateCommercialDocumentMap(input.documentMap);
  validateCommercialExtractionUnitPlan(input.unitPlan, input.documentMap);
  const issue = issueFactory();
  const planned = new Map(input.unitPlan.units.map((unit) => [unit.unitId, unit]));
  const orderedInputs = [...input.artifacts].sort(
    (left, right) => left.ordinal - right.ordinal || compare(left.unitId, right.unitId),
  );
  const occurrences = new Map<string, number>();
  const validSources: ValidSource[] = [];
  const sourceArtifacts: CommercialDocumentReconciliationResult['sourceArtifacts'][number][] = [];

  for (const inputArtifact of orderedInputs) {
    const occurrence = (occurrences.get(inputArtifact.unitId) ?? 0) + 1;
    occurrences.set(inputArtifact.unitId, occurrence);
    const artifactId = `${inputArtifact.unitId}-artifact-${String(occurrence).padStart(2, '0')}`;
    const unit = planned.get(inputArtifact.unitId);
    if (!unit)
      issue.add(
        'UNPLANNED_ARTIFACT',
        'error',
        [inputArtifact.unitId, artifactId],
        [],
        'Artifact references an unplanned extraction unit.',
      );
    if (occurrence > 1)
      issue.add(
        'DUPLICATE_UNIT_ARTIFACT',
        'error',
        [inputArtifact.unitId, artifactId],
        [],
        'More than one artifact references the same extraction unit.',
      );
    if (occurrence > 1 && unit?.logicalTableId && unit.partition)
      issue.add(
        'DUPLICATE_TABLE_PARTITION',
        'error',
        [unit.logicalTableId, String(unit.partition.index), artifactId],
        [],
        'Logical table partition has more than one source artifact.',
      );
    if (unit && unit.ordinal !== inputArtifact.ordinal)
      issue.add(
        'INCONSISTENT_UNIT_ORDINAL',
        'error',
        [inputArtifact.unitId, artifactId],
        [],
        'Artifact ordinal differs from the planned unit ordinal.',
      );
    let valid = false;
    try {
      validateCommercialDocumentExtraction(inputArtifact.artifact);
      valid = Boolean(unit && unit.ordinal === inputArtifact.ordinal && occurrence === 1);
    } catch {
      issue.add(
        'INVALID_ARTIFACT',
        'error',
        [inputArtifact.unitId, artifactId],
        [],
        'Artifact does not satisfy CommercialDocumentExtraction/1 invariants.',
      );
      const dangling = findTransportDanglingReferences(inputArtifact.artifact);
      if (dangling.length)
        issue.add(
          'DANGLING_REFERENCE',
          'error',
          [artifactId, ...dangling],
          [],
          'Source artifact contains a reference without a source target.',
        );
    }
    sourceArtifacts.push({
      artifactId,
      unitId: inputArtifact.unitId,
      ordinal: inputArtifact.ordinal,
      valid,
    });
    if (valid)
      validSources.push({
        ...inputArtifact,
        artifactId,
        artifact: inputArtifact.artifact as CommercialDocumentExtractionV1,
        unit: unit!,
      });
  }

  const coveredUnitIds = sortedUnique(validSources.map((source) => source.unitId));
  const missingUnitIds = input.unitPlan.units
    .map((unit) => unit.unitId)
    .filter((unitId) => !coveredUnitIds.includes(unitId))
    .sort(compare);
  for (const unitId of missingUnitIds)
    issue.add(
      'MISSING_UNIT_ARTIFACT',
      'error',
      [unitId],
      [],
      'Planned extraction unit has no single valid artifact.',
    );

  const merge = <T>(
    prefix: string,
    entries: readonly { key: string; value: T; ref: CommercialDocumentReconciliationSourceRef }[],
  ): {
    items: ReconciledEntity<T>[];
    idBySource: Map<string, string>;
    duplicates: CommercialDocumentReconciliationResult['duplicates'][number][];
  } => {
    const buckets = new Map<string, Bucket<T>>();
    for (const entry of entries) {
      const bucket = buckets.get(entry.key);
      if (bucket) bucket.provenance.push(entry.ref);
      else buckets.set(entry.key, { value: structuredClone(entry.value), provenance: [entry.ref] });
    }
    const idBySource = new Map<string, string>();
    const duplicates: CommercialDocumentReconciliationResult['duplicates'][number][] = [];
    const items = [...buckets.entries()]
      .sort(([left], [right]) => compare(left, right))
      .map(([, bucket], index) => {
        const reconciledId = `${prefix}-${String(index + 1).padStart(4, '0')}`;
        const provenance = sortProvenance(bucket.provenance);
        provenance.forEach((ref) =>
          idBySource.set(`${ref.artifactId}\u0000${ref.sourceId}`, reconciledId),
        );
        if (provenance.length > 1)
          duplicates.push({
            duplicateType: prefix === 'vehicle' ? 'IDENTITY' : prefix === 'fact' ? 'FACT' : 'SCOPE',
            reconciledId,
            sourceRefs: provenance,
          });
        return { reconciledId, value: bucket.value, provenance };
      });
    return { items, idBySource, duplicates };
  };

  const identityEntries = validSources.flatMap((source) =>
    source.artifact.vehicleIdentities.map((value) => ({
      key: canonical(without(value, ['vehicleIdentityId', 'evidence', 'confidence'])),
      value,
      ref: sourceRef(source, value.vehicleIdentityId, value.evidence),
    })),
  );
  const identities = merge('vehicle', identityEntries);
  const remapVehicleIds = (
    source: ValidSource,
    ids: readonly string[] | undefined,
  ): string[] | undefined =>
    ids
      ?.map((id) => identities.idBySource.get(`${source.artifactId}\u0000${id}`) ?? id)
      .sort(compare);
  const scopeEntries = validSources.flatMap((source) =>
    source.artifact.scopes.map((original) => {
      const mapSelector = (selector: CommercialDocumentScope['selector']) => ({
        ...structuredClone(selector),
        ...(selector.vehicleIdentityIds
          ? { vehicleIdentityIds: remapVehicleIds(source, selector.vehicleIdentityIds) }
          : {}),
      });
      const value = {
        ...structuredClone(original),
        selector: mapSelector(original.selector),
        exclusions: mapSelector(original.exclusions),
      };
      return {
        key: canonical(without(value, ['scopeId', 'evidenceBlockIds'])),
        value,
        ref: sourceRef(source, original.scopeId, { blockIds: original.evidenceBlockIds }),
      };
    }),
  );
  const scopes = merge('scope', scopeEntries);
  const remapScopeIds = (source: ValidSource, ids: readonly string[]): string[] =>
    sortedUnique(ids.map((id) => scopes.idBySource.get(`${source.artifactId}\u0000${id}`) ?? id));
  const factEntries = validSources.flatMap((source) =>
    source.artifact.facts.map((original) => {
      const value = {
        ...structuredClone(original),
        scopeIds: remapScopeIds(source, original.scopeIds),
      };
      return {
        key: canonical(without(value, ['factId', 'evidence', 'confidence'])),
        value,
        ref: sourceRef(source, original.factId, original.evidence),
      };
    }),
  );
  const facts = merge('fact', factEntries);

  const detectConflicts = <T>(
    items: readonly ReconciledEntity<T>[],
    context: (item: T) => string,
    code: 'IDENTITY_CONFLICT' | 'FACT_CONFLICT' | 'SCOPE_CONFLICT',
    message: string,
  ): void => {
    const contexts = new Map<string, ReconciledEntity<T>[]>();
    for (const item of items) {
      const bucket = contexts.get(context(item.value)) ?? [];
      bucket.push(item);
      contexts.set(context(item.value), bucket);
    }
    for (const bucket of contexts.values())
      if (bucket.length > 1)
        issue.add(
          code,
          'error',
          bucket.map((item) => item.reconciledId),
          bucket.flatMap((item) => item.provenance),
          message,
        );
  };
  detectConflicts(
    identities.items,
    (value) => canonical({ brand: value.brand, model: value.model, version: value.version }),
    'IDENTITY_CONFLICT',
    'Documentary identities share brand/model/version but contain incompatible asserted fields.',
  );
  detectConflicts(
    facts.items,
    (value) =>
      canonical({
        factType: value.factType,
        channel: value.channel,
        validity: value.validity,
        scopeIds: value.scopeIds,
      }),
    'FACT_CONFLICT',
    'Documentary facts assert incompatible values for the same typed context.',
  );
  detectConflicts(
    scopes.items,
    (value) => canonical({ scopeType: value.scopeType, selector: value.selector }),
    'SCOPE_CONFLICT',
    'Documentary scopes share the same selector but assert incompatible exclusions or review state.',
  );

  const groupRecords: Array<{
    key: string;
    source: ValidSource;
    group: CommercialDocumentCompositionGroup;
    mapped: Omit<ReconciledCompositionGroup, 'reconciledId' | 'provenance'>;
    ref: CommercialDocumentReconciliationSourceRef;
  }> = [];
  for (const source of validSources)
    for (const group of source.artifact.composition.groups) {
      const mapFact = (id: string): string =>
        facts.idBySource.get(`${source.artifactId}\u0000${id}`) ?? id;
      const mapped = {
        groupType: group.groupType,
        memberFactIds: sortedUnique(group.memberFactIds.map(mapFact)),
        sharedFactIds: sortedUnique(group.sharedFactIds.map(mapFact)),
        scopeIds: remapScopeIds(source, group.scopeIds),
        ...(group.parentGroupId ? { parentGroupId: group.parentGroupId } : {}),
      };
      groupRecords.push({
        key: canonical(mapped),
        source,
        group,
        mapped,
        ref: sourceRef(source, group.groupId),
      });
    }
  const groupBuckets = new Map<string, typeof groupRecords>();
  for (const record of groupRecords)
    groupBuckets.set(record.key, [...(groupBuckets.get(record.key) ?? []), record]);
  const groupIdBySource = new Map<string, string>();
  const groupsWithLocalParents: ReconciledCompositionGroup[] = [...groupBuckets.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, records], index) => {
      const reconciledId = `group-${String(index + 1).padStart(4, '0')}`;
      records.forEach((record) =>
        groupIdBySource.set(
          `${record.source.artifactId}\u0000${record.group.groupId}`,
          reconciledId,
        ),
      );
      return {
        reconciledId,
        ...records[0]!.mapped,
        provenance: sortProvenance(records.map((record) => record.ref)),
      };
    });
  const groups = groupsWithLocalParents.map((group) => {
    if (!group.parentGroupId) return group;
    const owner = group.provenance[0];
    const parentGroupId = owner
      ? (groupIdBySource.get(`${owner.artifactId}\u0000${group.parentGroupId}`) ??
        group.parentGroupId)
      : group.parentGroupId;
    return { ...group, parentGroupId };
  });
  const relationships = validSources.flatMap((source) =>
    source.artifact.composition.relationships.map((relation) => {
      const mapped = {
        relationType: relation.relationType,
        factIds: sortedUnique(
          relation.factIds.map(
            (id) => facts.idBySource.get(`${source.artifactId}\u0000${id}`) ?? id,
          ),
        ),
        groupIds: sortedUnique(
          relation.groupIds.map(
            (id) => groupIdBySource.get(`${source.artifactId}\u0000${id}`) ?? id,
          ),
        ),
        scopeIds: remapScopeIds(source, relation.scopeIds),
      };
      return {
        key: canonical(mapped),
        mapped,
        ref: sourceRef(source, relation.relationId, { blockIds: relation.evidenceBlockIds }),
      };
    }),
  );
  const relationBuckets = new Map<string, typeof relationships>();
  for (const record of relationships)
    relationBuckets.set(record.key, [...(relationBuckets.get(record.key) ?? []), record]);
  const reconciledRelationships: ReconciledCompositionRelation[] = [...relationBuckets.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([, records], index) => ({
      reconciledId: `relation-${String(index + 1).padStart(4, '0')}`,
      ...records[0]!.mapped,
      provenance: sortProvenance(records.map((record) => record.ref)),
    }));

  const known = new Set([
    ...identities.items.map((item) => item.reconciledId),
    ...facts.items.map((item) => item.reconciledId),
    ...scopes.items.map((item) => item.reconciledId),
    ...groups.map((item) => item.reconciledId),
  ]);
  const referenceSets = [
    ...scopes.items.map((item) => ({
      owner: item.reconciledId,
      refs: [
        ...(item.value.selector.vehicleIdentityIds ?? []),
        ...(item.value.exclusions.vehicleIdentityIds ?? []),
      ],
      provenance: item.provenance,
    })),
    ...facts.items.map((item) => ({
      owner: item.reconciledId,
      refs: item.value.scopeIds,
      provenance: item.provenance,
    })),
    ...groups.map((item) => ({
      owner: item.reconciledId,
      refs: [
        ...item.memberFactIds,
        ...item.sharedFactIds,
        ...item.scopeIds,
        ...(item.parentGroupId ? [item.parentGroupId] : []),
      ],
      provenance: item.provenance,
    })),
    ...reconciledRelationships.map((item) => ({
      owner: item.reconciledId,
      refs: [...item.factIds, ...item.groupIds, ...item.scopeIds],
      provenance: item.provenance,
    })),
  ];
  for (const item of referenceSets) {
    const dangling = item.refs.filter((ref) => !known.has(ref));
    if (dangling.length)
      issue.add(
        'DANGLING_REFERENCE',
        'error',
        [item.owner, ...dangling],
        item.provenance,
        'Reconciled entity contains a reference without a reconciled target.',
      );
  }

  const partitionGroups = new Map<string, CommercialExtractionUnit[]>();
  for (const unit of input.unitPlan.units)
    if (unit.logicalTableId && unit.partition)
      partitionGroups.set(unit.logicalTableId, [
        ...(partitionGroups.get(unit.logicalTableId) ?? []),
        unit,
      ]);
  const logicalTables = [...partitionGroups.entries()]
    .sort(([a], [b]) => compare(a, b))
    .map(([logicalTableId, units]) => {
      const expectedPartitionCount = Math.max(...units.map((unit) => unit.partition!.count));
      const available = validSources.filter(
        (source) => source.unit.logicalTableId === logicalTableId,
      );
      const indexes = available.map((source) => source.unit.partition!.index);
      const availablePartitionIndexes = sortedUnique(indexes.map(String)).map(Number);
      const missing = Array.from(
        { length: expectedPartitionCount },
        (_, index) => index + 1,
      ).filter((index) => !indexes.includes(index));
      for (const index of missing)
        issue.add(
          'MISSING_TABLE_PARTITION',
          'error',
          [logicalTableId, String(index)],
          [],
          'Logical table has a missing planned partition artifact.',
        );
      for (const index of availablePartitionIndexes)
        if (indexes.filter((item) => item === index).length > 1)
          issue.add(
            'DUPLICATE_TABLE_PARTITION',
            'error',
            [logicalTableId, String(index)],
            [],
            'Logical table has a duplicate partition artifact.',
          );
      const table = input.documentMap.tables.find((item) => item.tableId === logicalTableId);
      const inheritedHeaderBlockIds = sortedUnique(
        table?.segments.flatMap((segment) => segment.inheritedHeaderBlockIds) ?? [],
      );
      const structurallyContinuous =
        missing.length === 0 &&
        new Set(indexes).size === expectedPartitionCount &&
        expectedPartitionCount === units.length;
      if (!structurallyContinuous && available.length)
        issue.add(
          'TABLE_CONTINUITY_UNPROVEN',
          'warning',
          [logicalTableId],
          [],
          'Logical table partitions were preserved but not concatenated because structural continuity is unproven.',
        );
      return {
        logicalTableId,
        expectedPartitionCount,
        availablePartitionIndexes,
        inheritedHeaderBlockIds,
        structurallyContinuous,
      };
    });

  if (validSources.some((source) => source.artifact.coverage.status !== 'complete'))
    issue.add(
      'COVERAGE_MISMATCH',
      'warning',
      validSources
        .filter((source) => source.artifact.coverage.status !== 'complete')
        .map((source) => source.artifactId),
      [],
      'One or more valid artifacts declare non-complete extraction coverage.',
    );
  const issues = issue.finish();
  const conflictCodes = new Set<CommercialDocumentReconciliationIssueCode>([
    'IDENTITY_CONFLICT',
    'FACT_CONFLICT',
    'SCOPE_CONFLICT',
  ]);
  const conflicts = issues.filter((item) => conflictCodes.has(item.code));
  const unresolvedAmbiguities = sortedUnique([
    ...identities.items
      .filter((item) => item.value.confidence.ambiguous || item.value.confidence.requiresReview)
      .map((item) => item.reconciledId),
    ...facts.items
      .filter((item) => item.value.confidence.ambiguous || item.value.confidence.requiresReview)
      .map((item) => item.reconciledId),
    ...scopes.items
      .filter((item) => item.value.ambiguous || item.value.requiresReview)
      .map((item) => item.reconciledId),
  ]);
  const coverage: CommercialDocumentReconciliationCoverage = {
    status:
      missingUnitIds.length ||
      issues.some((item) =>
        [
          'UNPLANNED_ARTIFACT',
          'DUPLICATE_UNIT_ARTIFACT',
          'INVALID_ARTIFACT',
          'COVERAGE_MISMATCH',
          'MISSING_TABLE_PARTITION',
        ].includes(item.code),
      )
        ? 'partial'
        : 'complete',
    plannedUnitCount: input.unitPlan.units.length,
    validArtifactCount: validSources.length,
    coveredUnitIds,
    missingUnitIds,
    unplannedUnitIds: sortedUnique(
      orderedInputs.filter((item) => !planned.has(item.unitId)).map((item) => item.unitId),
    ),
    logicalTables,
  };
  const compositionDuplicates: CommercialDocumentReconciliationResult['duplicates'][number][] = [
    ...groups
      .filter((item) => item.provenance.length > 1)
      .map((item) => ({
        duplicateType: 'GROUP' as const,
        reconciledId: item.reconciledId,
        sourceRefs: item.provenance,
      })),
    ...reconciledRelationships
      .filter((item) => item.provenance.length > 1)
      .map((item) => ({
        duplicateType: 'RELATIONSHIP' as const,
        reconciledId: item.reconciledId,
        sourceRefs: item.provenance,
      })),
  ];
  const duplicates = [
    ...identities.duplicates,
    ...facts.duplicates,
    ...scopes.duplicates,
    ...compositionDuplicates,
  ].sort((left, right) =>
    compare(
      `${left.duplicateType}\u0000${left.reconciledId}`,
      `${right.duplicateType}\u0000${right.reconciledId}`,
    ),
  );
  const result: CommercialDocumentReconciliationResult = {
    schemaVersion: COMMERCIAL_DOCUMENT_RECONCILIATION_VERSION,
    status: conflicts.length
      ? 'conflicted'
      : coverage.status === 'partial' || unresolvedAmbiguities.length || issues.length
        ? 'partial'
        : 'complete',
    sourceArtifacts,
    vehicleIdentities: identities.items,
    facts: facts.items,
    scopes: scopes.items,
    composition: { groups, relationships: reconciledRelationships },
    coverage,
    duplicates,
    conflicts,
    unresolvedAmbiguities,
    issues,
  };
  validateCommercialDocumentReconciliationResult(result);
  return result;
}
