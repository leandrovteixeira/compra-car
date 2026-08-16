import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import {
  COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS,
  type CommercialDocumentEvidence,
  type CommercialDocumentExtractionV1,
  type CommercialDocumentScopeSelector,
} from './commercial-document-extraction';
import { commercialDocumentExtractionSchemaV1 } from './commercial-document-extraction-schema';

export class CommercialDocumentExtractionValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`CommercialDocumentExtraction/1 inválido (${issues.length} violação(ões)).`);
    this.name = 'CommercialDocumentExtractionValidationError';
  }
}

const serializedByteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
const safeSchemaErrors = (errors: readonly ErrorObject[] | null | undefined): readonly string[] =>
  (errors ?? []).slice(0, 50).map((error) => `${error.instancePath || '/'}: ${error.keyword}`);
const isIsoCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
ajv.addFormat('date', isIsoCalendarDate);
const validateSchema: ValidateFunction = ajv.compile(commercialDocumentExtractionSchemaV1);

const addDuplicates = (issues: string[], path: string, values: readonly string[]): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) issues.push(`${path}: duplicateId:${value}`);
    seen.add(value);
  }
};
const addUnknownRefs = (
  issues: string[],
  path: string,
  values: readonly string[] | undefined,
  known: ReadonlySet<string>,
): void => {
  for (const value of values ?? [])
    if (!known.has(value)) issues.push(`${path}: unknownRef:${value}`);
};
const equalSets = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((item) => right.includes(item));

export function validateCommercialDocumentExtractionInvariants(
  artifact: CommercialDocumentExtractionV1,
): void {
  const issues: string[] = [];
  const documentIds = new Set(artifact.documents.map((item) => item.documentId));
  const blockIds = new Set(artifact.blocks.map((item) => item.blockId));
  const tableIds = new Set(artifact.tables.map((item) => item.tableId));
  const vehicleIds = new Set(artifact.vehicleIdentities.map((item) => item.vehicleIdentityId));
  const factIds = new Set(artifact.facts.map((item) => item.factId));
  const scopeIds = new Set(artifact.scopes.map((item) => item.scopeId));
  const groupIds = new Set(artifact.composition.groups.map((item) => item.groupId));
  const unitIds = new Set(artifact.coverage.units.map((item) => item.unitId));
  const rowsByTable = new Map<string, Set<string>>();
  const allRowIds = new Set<string>();
  const allColumnIds: string[] = [];

  const idGroups: readonly [string, readonly string[]][] = [
    ['/documents', artifact.documents.map((item) => item.documentId)],
    ['/blocks', artifact.blocks.map((item) => item.blockId)],
    ['/tables', artifact.tables.map((item) => item.tableId)],
    ['/vehicleIdentities', artifact.vehicleIdentities.map((item) => item.vehicleIdentityId)],
    ['/facts', artifact.facts.map((item) => item.factId)],
    ['/scopes', artifact.scopes.map((item) => item.scopeId)],
    ['/composition/groups', artifact.composition.groups.map((item) => item.groupId)],
    [
      '/composition/relationships',
      artifact.composition.relationships.map((item) => item.relationId),
    ],
    ['/coverage/units', artifact.coverage.units.map((item) => item.unitId)],
    ['/coverage/gaps', artifact.coverage.gaps.map((item) => item.gapId)],
  ];
  for (const [path, ids] of idGroups) addDuplicates(issues, path, ids);

  const documentPages = new Map(
    artifact.documents.map((item) => [item.documentId, item.pageCount]),
  );
  const validateEvidence = (evidence: CommercialDocumentEvidence, path: string): void => {
    addUnknownRefs(issues, `${path}/blockIds`, evidence.blockIds, blockIds);
    if (evidence.tableId && !tableIds.has(evidence.tableId))
      issues.push(`${path}/tableId: unknownRef:${evidence.tableId}`);
    if (evidence.rowId) {
      if (!evidence.tableId) issues.push(`${path}/rowId: tableIdRequired`);
      else if (!rowsByTable.get(evidence.tableId)?.has(evidence.rowId))
        issues.push(`${path}/rowId: unknownRef:${evidence.rowId}`);
    }
  };

  artifact.tables.forEach((table, tableIndex) => {
    const path = `/tables/${tableIndex}`;
    const pageCount = documentPages.get(table.documentId);
    if (!pageCount) issues.push(`${path}/documentId: unknownRef:${table.documentId}`);
    const rowIds = table.rows.map((row) => row.rowId);
    rowsByTable.set(table.tableId, new Set(rowIds));
    addDuplicates(issues, `${path}/rows`, rowIds);
    for (const rowId of rowIds) {
      if (allRowIds.has(rowId)) issues.push(`${path}/rows: duplicateGlobalRowId:${rowId}`);
      allRowIds.add(rowId);
    }
    const columnIds = table.columns.map((column) => column.columnId);
    allColumnIds.push(...columnIds);
    addDuplicates(issues, `${path}/columns`, columnIds);
    addUnknownRefs(issues, `${path}/sourceBlockIds`, table.sourceBlockIds, blockIds);
    addUnknownRefs(issues, `${path}/footnoteBlockIds`, table.footnoteBlockIds, blockIds);
    addUnknownRefs(
      issues,
      `${path}/continuation/inheritedHeaderBlockIds`,
      table.continuation.inheritedHeaderBlockIds,
      blockIds,
    );
    const pages = [...table.pages].sort((left, right) => left - right);
    if (pages.some((page, index) => page !== table.pages[index]))
      issues.push(`${path}/pages: mustBeAscending`);
    for (const page of table.pages)
      if (pageCount && page > pageCount) issues.push(`${path}/pages: pageOutOfRange:${page}`);
    const segmentPages = table.continuation.segments.map((segment) => segment.page);
    if (!equalSets(table.pages.map(String), segmentPages.map(String)))
      issues.push(`${path}/continuation/segments: pagesMismatch`);
    if (table.continuation.continuedAcrossPages !== table.pages.length > 1)
      issues.push(`${path}/continuation/continuedAcrossPages: inconsistent`);
    table.continuation.segments.forEach((segment, segmentIndex) => {
      addUnknownRefs(
        issues,
        `${path}/continuation/segments/${segmentIndex}/sourceBlockIds`,
        segment.sourceBlockIds,
        blockIds,
      );
      if (
        segment.inheritsHeadersFromPage !== undefined &&
        (!table.pages.includes(segment.inheritsHeadersFromPage) ||
          segment.inheritsHeadersFromPage >= segment.page)
      )
        issues.push(
          `${path}/continuation/segments/${segmentIndex}/inheritsHeadersFromPage: invalid`,
        );
    });
    table.rows.forEach((row, rowIndex) => {
      if (!table.pages.includes(row.page)) issues.push(`${path}/rows/${rowIndex}/page: notInTable`);
      addUnknownRefs(
        issues,
        `${path}/rows/${rowIndex}/sourceBlockIds`,
        row.sourceBlockIds,
        blockIds,
      );
      const cellColumns = row.cells.map((cell) => cell.columnId);
      addDuplicates(issues, `${path}/rows/${rowIndex}/cells`, cellColumns);
      addUnknownRefs(issues, `${path}/rows/${rowIndex}/cells`, cellColumns, new Set(columnIds));
    });
  });
  addDuplicates(issues, '/tables/*/columns', allColumnIds);

  artifact.blocks.forEach((block, index) => {
    const path = `/blocks/${index}`;
    const pageCount = documentPages.get(block.documentId);
    if (!pageCount) issues.push(`${path}/documentId: unknownRef:${block.documentId}`);
    else if (block.page > pageCount) issues.push(`${path}/page: pageOutOfRange`);
    if (block.tableId && !tableIds.has(block.tableId))
      issues.push(`${path}/tableId: unknownRef:${block.tableId}`);
    if (block.rowId) {
      if (!block.tableId) issues.push(`${path}/rowId: tableIdRequired`);
      else if (!rowsByTable.get(block.tableId)?.has(block.rowId))
        issues.push(`${path}/rowId: unknownRef:${block.rowId}`);
    }
  });

  artifact.documents.forEach((document, index) => {
    const path = `/documents/${index}`;
    const candidates = [
      ...document.competenceCandidates,
      ...document.validityCandidates,
      ...document.notes,
    ];
    candidates.forEach((candidate, candidateIndex) =>
      validateEvidence(candidate.evidence, `${path}/candidates/${candidateIndex}/evidence`),
    );
    document.validityCandidates.forEach((candidate, candidateIndex) => {
      if (candidate.startsOn && candidate.endsOn && candidate.startsOn > candidate.endsOn)
        issues.push(`${path}/validityCandidates/${candidateIndex}: invalidDateRange`);
    });
  });

  artifact.vehicleIdentities.forEach((vehicle, index) => {
    validateEvidence(vehicle.evidence, `/vehicleIdentities/${index}/evidence`);
    if ((vehicle.productionYear === undefined) !== (vehicle.modelYear === undefined))
      issues.push(`/vehicleIdentities/${index}: incompleteYearPair`);
  });

  artifact.facts.forEach((fact, index) => {
    const path = `/facts/${index}`;
    validateEvidence(fact.evidence, `${path}/evidence`);
    addUnknownRefs(issues, `${path}/scopeIds`, fact.scopeIds, scopeIds);
    if (
      fact.validity?.startsOn &&
      fact.validity.endsOn &&
      fact.validity.startsOn > fact.validity.endsOn
    )
      issues.push(`${path}/validity: invalidDateRange`);
    if (fact.value.kind === 'percentage' && Number(fact.value.percentage) > 100)
      issues.push(`${path}/value/percentage: above100`);
  });

  const selectorRefs = (selector: CommercialDocumentScopeSelector, path: string): void => {
    addUnknownRefs(issues, `${path}/documentIds`, selector.documentIds, documentIds);
    addUnknownRefs(issues, `${path}/vehicleIdentityIds`, selector.vehicleIdentityIds, vehicleIds);
    addUnknownRefs(issues, `${path}/groupIds`, selector.groupIds, groupIds);
  };
  artifact.scopes.forEach((scope, index) => {
    const path = `/scopes/${index}`;
    selectorRefs(scope.selector, `${path}/selector`);
    selectorRefs(scope.exclusions, `${path}/exclusions`);
    addUnknownRefs(issues, `${path}/evidenceBlockIds`, scope.evidenceBlockIds, blockIds);
    const requiredSelector: Record<typeof scope.scopeType, readonly string[] | undefined> = {
      DOCUMENT: scope.selector.documentIds,
      BRAND_LINE: scope.selector.brandLines,
      MODEL: scope.selector.models,
      VERSION_SET: scope.selector.versions?.length
        ? scope.selector.versions
        : scope.selector.vehicleIdentityIds,
      VEHICLE: scope.selector.vehicleIdentityIds,
      CHANNEL: scope.selector.channels,
      GROUP: scope.selector.groupIds,
    };
    if (!requiredSelector[scope.scopeType]?.length)
      issues.push(`${path}/selector: missingTargetFor${scope.scopeType}`);
    if (scope.ambiguous && !scope.requiresReview)
      issues.push(`${path}/requiresReview: requiredWhenAmbiguous`);
  });

  artifact.composition.groups.forEach((group, index) => {
    const path = `/composition/groups/${index}`;
    addUnknownRefs(issues, `${path}/memberFactIds`, group.memberFactIds, factIds);
    addUnknownRefs(issues, `${path}/sharedFactIds`, group.sharedFactIds, factIds);
    addUnknownRefs(issues, `${path}/scopeIds`, group.scopeIds, scopeIds);
    if (group.memberFactIds.some((factId) => group.sharedFactIds.includes(factId)))
      issues.push(`${path}: memberAndSharedFactOverlap`);
    if (group.parentGroupId) {
      if (!groupIds.has(group.parentGroupId))
        issues.push(`${path}/parentGroupId: unknownRef:${group.parentGroupId}`);
      if (group.parentGroupId === group.groupId)
        issues.push(`${path}/parentGroupId: selfReference`);
    }
  });
  for (const group of artifact.composition.groups) {
    const visited = new Set<string>([group.groupId]);
    let parent = group.parentGroupId;
    while (parent) {
      if (visited.has(parent)) {
        issues.push(`/composition/groups: parentCycle:${group.groupId}`);
        break;
      }
      visited.add(parent);
      parent = artifact.composition.groups.find((item) => item.groupId === parent)?.parentGroupId;
    }
  }

  artifact.composition.relationships.forEach((relation, index) => {
    const path = `/composition/relationships/${index}`;
    addUnknownRefs(issues, `${path}/factIds`, relation.factIds, factIds);
    addUnknownRefs(issues, `${path}/groupIds`, relation.groupIds, groupIds);
    addUnknownRefs(issues, `${path}/scopeIds`, relation.scopeIds, scopeIds);
    addUnknownRefs(issues, `${path}/evidenceBlockIds`, relation.evidenceBlockIds, blockIds);
    if (
      ['APPLIES_TOGETHER', 'MUTUALLY_EXCLUSIVE'].includes(relation.relationType) &&
      relation.factIds.length + relation.groupIds.length < 2
    )
      issues.push(`${path}: relationNeedsTwoSubjects`);
  });

  const coverage = artifact.coverage;
  if (coverage.expectedUnitCount !== coverage.units.length)
    issues.push('/coverage/expectedUnitCount: inconsistentWithUnits');
  const completedUnits = coverage.units.filter((unit) => unit.status === 'complete').length;
  if (coverage.completedUnitCount !== completedUnits)
    issues.push('/coverage/completedUnitCount: inconsistentWithUnits');
  if (coverage.extractedVehicleCount !== artifact.vehicleIdentities.length)
    issues.push('/coverage/extractedVehicleCount: inconsistentWithVehicleIdentities');
  if (
    coverage.expectedVehicleCount !== undefined &&
    coverage.extractedVehicleCount > coverage.expectedVehicleCount
  )
    issues.push('/coverage/extractedVehicleCount: aboveExpected');
  coverage.units.forEach((unit, index) => {
    addUnknownRefs(
      issues,
      `/coverage/units/${index}/sourceBlockIds`,
      unit.sourceBlockIds,
      blockIds,
    );
    if (
      unit.expectedItemCount !== undefined &&
      unit.status === 'complete' &&
      unit.extractedItemCount !== unit.expectedItemCount
    )
      issues.push(`/coverage/units/${index}: completedCountMismatch`);
  });
  coverage.gaps.forEach((gap, index) => {
    const path = `/coverage/gaps/${index}`;
    if (gap.unitId && !unitIds.has(gap.unitId))
      issues.push(`${path}/unitId: unknownRef:${gap.unitId}`);
    if (gap.blockId && !blockIds.has(gap.blockId))
      issues.push(`${path}/blockId: unknownRef:${gap.blockId}`);
    if (gap.tableId && !tableIds.has(gap.tableId))
      issues.push(`${path}/tableId: unknownRef:${gap.tableId}`);
    if (gap.scopeId && !scopeIds.has(gap.scopeId))
      issues.push(`${path}/scopeId: unknownRef:${gap.scopeId}`);
    if (gap.rowId && (!gap.tableId || !rowsByTable.get(gap.tableId)?.has(gap.rowId)))
      issues.push(`${path}/rowId: unknownRef:${gap.rowId}`);
  });
  addUnknownRefs(issues, '/coverage/incompleteBlockIds', coverage.incompleteBlockIds, blockIds);
  addUnknownRefs(issues, '/coverage/unresolvedScopeIds', coverage.unresolvedScopeIds, scopeIds);
  coverage.unresolvedTableRows.forEach((row, index) => {
    if (!rowsByTable.get(row.tableId)?.has(row.rowId))
      issues.push(`/coverage/unresolvedTableRows/${index}: unknownRef`);
  });
  if (coverage.status === 'complete') {
    if (
      coverage.completedUnitCount !== coverage.expectedUnitCount ||
      coverage.gaps.length ||
      coverage.incompleteBlockIds.length ||
      coverage.unresolvedTableRows.length ||
      coverage.unresolvedScopeIds.length ||
      (coverage.expectedVehicleCount !== undefined &&
        coverage.expectedVehicleCount !== coverage.extractedVehicleCount) ||
      !equalSets(coverage.expectedFamilies, coverage.extractedFamilies)
    )
      issues.push('/coverage/status: incompleteDataMarkedComplete');
  }
  if (
    coverage.status === 'partial' &&
    coverage.completedUnitCount === coverage.expectedUnitCount &&
    !coverage.gaps.length &&
    !coverage.incompleteBlockIds.length &&
    !coverage.unresolvedTableRows.length &&
    !coverage.unresolvedScopeIds.length
  )
    issues.push('/coverage/status: partialWithoutGap');
  if (
    coverage.status === 'ambiguous' &&
    !coverage.gaps.some((gap) => gap.gapType === 'AMBIGUITY') &&
    !coverage.units.some((unit) => unit.status === 'ambiguous') &&
    !coverage.unresolvedScopeIds.length
  )
    issues.push('/coverage/status: ambiguousWithoutEvidence');

  if (issues.length) throw new CommercialDocumentExtractionValidationError(issues);
}

export function validateCommercialDocumentExtraction(
  payload: unknown,
): asserts payload is CommercialDocumentExtractionV1 {
  if (serializedByteLength(payload) > COMMERCIAL_DOCUMENT_EXTRACTION_LIMITS.maxPayloadBytes)
    throw new CommercialDocumentExtractionValidationError(['/: maxPayloadBytes']);
  if (!validateSchema(payload))
    throw new CommercialDocumentExtractionValidationError(safeSchemaErrors(validateSchema.errors));
  validateCommercialDocumentExtractionInvariants(payload as CommercialDocumentExtractionV1);
}
