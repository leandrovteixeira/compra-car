import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import {
  COMMERCIAL_DOCUMENT_MAP_LIMITS,
  COMMERCIAL_EXTRACTION_UNIT_LIMITS,
  type CommercialDocumentMapRef,
  type CommercialDocumentMapV1,
  type CommercialExtractionUnitPlanV1,
} from './commercial-document-map';
import {
  commercialDocumentMapSchemaV1,
  commercialExtractionUnitPlanSchemaV1,
} from './commercial-document-map-schema';

export type CommercialDocumentMapViolationCategory =
  'schema' | 'referential' | 'semantic' | 'invariant';

export interface CommercialDocumentMapViolationDiagnostic {
  readonly path: string;
  readonly keyword: string;
  readonly category: CommercialDocumentMapViolationCategory;
  readonly missingProperty?: string;
}

export interface CommercialDocumentMapValidationDiagnostic {
  readonly totalViolations: number;
  readonly sampledViolations: readonly CommercialDocumentMapViolationDiagnostic[];
  readonly truncated: boolean;
  readonly keywordCounts: Readonly<Record<string, number>>;
  readonly categoryCounts: Readonly<Record<CommercialDocumentMapViolationCategory, number>>;
}

const COMMERCIAL_DOCUMENT_MAP_DIAGNOSTIC_SAMPLE_LIMIT = 30;

const collectStaticSchemaPropertyNames = (
  schema: unknown,
  names = new Set<string>(),
): Set<string> => {
  if (!schema || typeof schema !== 'object') return names;
  if (Array.isArray(schema)) {
    schema.forEach((item) => collectStaticSchemaPropertyNames(item, names));
    return names;
  }
  const object = schema as Record<string, unknown>;
  if (object.properties && typeof object.properties === 'object')
    Object.keys(object.properties).forEach((name) => names.add(name));
  Object.values(object).forEach((item) => collectStaticSchemaPropertyNames(item, names));
  return names;
};

const commercialDocumentMapStaticPropertyNames = collectStaticSchemaPropertyNames(
  commercialDocumentMapSchemaV1,
);

export class CommercialDocumentMapValidationError extends Error {
  readonly code = 'COMMERCIAL_DOCUMENT_MAP_INVALID' as const;
  readonly totalViolations: number;
  readonly diagnostics: readonly CommercialDocumentMapViolationDiagnostic[];
  readonly truncated: boolean;
  readonly keywordCounts: Readonly<Record<string, number>>;
  readonly categoryCounts: Readonly<Record<CommercialDocumentMapViolationCategory, number>>;
  readonly issues: readonly string[];

  constructor(diagnostic: CommercialDocumentMapValidationDiagnostic) {
    super(`CommercialDocumentMap/1 inválido (${diagnostic.totalViolations} violação(ões)).`);
    this.name = 'CommercialDocumentMapValidationError';
    this.totalViolations = diagnostic.totalViolations;
    this.diagnostics = diagnostic.sampledViolations;
    this.truncated = diagnostic.truncated;
    this.keywordCounts = diagnostic.keywordCounts;
    this.categoryCounts = diagnostic.categoryCounts;
    this.issues = diagnostic.sampledViolations.map(
      (violation) => `${violation.path}: ${violation.keyword}`,
    );
  }
}

export class CommercialExtractionUnitPlanValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`CommercialExtractionUnitPlan/1 inválido (${issues.length} violação(ões)).`);
    this.name = 'CommercialExtractionUnitPlanValidationError';
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateMapSchema: ValidateFunction = ajv.compile(commercialDocumentMapSchemaV1);
const validatePlanSchema: ValidateFunction = ajv.compile(commercialExtractionUnitPlanSchemaV1);
const bytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;
const planSchemaIssues = (errors: readonly ErrorObject[] | null | undefined): readonly string[] =>
  (errors ?? []).slice(0, 100).map((error) => `${error.instancePath || '/'}: ${error.keyword}`);
const summarizeDiagnostics = (
  violations: readonly CommercialDocumentMapViolationDiagnostic[],
  sampleLimit = COMMERCIAL_DOCUMENT_MAP_DIAGNOSTIC_SAMPLE_LIMIT,
): CommercialDocumentMapValidationDiagnostic => {
  const keywordCounts: Record<string, number> = {};
  const categoryCounts: Record<CommercialDocumentMapViolationCategory, number> = {
    schema: 0,
    referential: 0,
    semantic: 0,
    invariant: 0,
  };
  for (const violation of violations) {
    keywordCounts[violation.keyword] = (keywordCounts[violation.keyword] ?? 0) + 1;
    categoryCounts[violation.category] += 1;
  }
  return {
    totalViolations: violations.length,
    sampledViolations: violations.slice(0, Math.max(0, sampleLimit)),
    truncated: violations.length > Math.max(0, sampleLimit),
    keywordCounts,
    categoryCounts,
  };
};

export function sanitizeCommercialDocumentMapAjvErrors(
  errors: readonly ErrorObject[] | null | undefined,
  sampleLimit = COMMERCIAL_DOCUMENT_MAP_DIAGNOSTIC_SAMPLE_LIMIT,
): CommercialDocumentMapValidationDiagnostic {
  return summarizeDiagnostics(
    (errors ?? []).map((error) => {
      const diagnostic: CommercialDocumentMapViolationDiagnostic = {
        path: error.instancePath || '/',
        keyword: error.keyword,
        category: 'schema',
      };
      const missingProperty = (error.params as { readonly missingProperty?: unknown })
        .missingProperty;
      return error.keyword === 'required' &&
        typeof missingProperty === 'string' &&
        commercialDocumentMapStaticPropertyNames.has(missingProperty)
        ? { ...diagnostic, missingProperty }
        : diagnostic;
    }),
    sampleLimit,
  );
}

const referentialInvariantKeywords = new Set([
  'crossDocumentRef',
  'inconsistentOwner',
  'missingPageBackReference',
  'unknownRef',
]);
const semanticInvariantKeywords = new Set([
  'continuationWithoutInheritedHeader',
  'expectedEnd',
  'expectedStart',
  'expectedWhole',
  'invalidContinuationPosition',
  'invalidContinuationRefs',
  'invalidHeaderRefs',
  'mustBeAscending',
  'nonContiguousPages',
  'outOfRange',
  'pagesMismatch',
]);
const sanitizeInvariantIssues = (
  issues: readonly string[],
): CommercialDocumentMapValidationDiagnostic =>
  summarizeDiagnostics(
    issues.map((issue) => {
      const separator = issue.indexOf(': ');
      const path = separator >= 0 ? issue.slice(0, separator) : '/';
      const detail = separator >= 0 ? issue.slice(separator + 2) : 'custom_invariant';
      const candidate = detail.split(':', 1)[0] ?? 'custom_invariant';
      const keyword = /^[A-Za-z][A-Za-z0-9]*$/u.test(candidate) ? candidate : 'custom_invariant';
      const category: CommercialDocumentMapViolationCategory = referentialInvariantKeywords.has(
        keyword,
      )
        ? 'referential'
        : semanticInvariantKeywords.has(keyword)
          ? 'semantic'
          : 'invariant';
      return { path, keyword, category };
    }),
  );
const duplicates = (path: string, values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const value of values) {
    if (seen.has(value)) issues.push(`${path}: duplicateId:${value}`);
    seen.add(value);
  }
  return issues;
};
const unknownRefs = (
  path: string,
  values: readonly string[],
  known: ReadonlySet<string>,
): string[] =>
  values.filter((value) => !known.has(value)).map((value) => `${path}: unknownRef:${value}`);
const sameValues = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

export function validateCommercialDocumentMapInvariants(map: CommercialDocumentMapV1): void {
  const issues: string[] = [];
  const documents = new Map(map.documents.map((item) => [item.documentId, item]));
  const pages = new Map(map.pages.map((item) => [item.pageId, item]));
  const blocks = new Map(map.contentBlocks.map((item) => [item.contentBlockId, item]));
  const sections = new Map(map.sections.map((item) => [item.sectionId, item]));
  const tables = new Map(map.tables.map((item) => [item.tableId, item]));
  const notes = new Map(map.notes.map((item) => [item.noteId, item]));
  const hints = new Map(map.entityHints.map((item) => [item.entityHintId, item]));
  const edges = new Map(map.contextEdges.map((item) => [item.contextEdgeId, item]));
  const groups: readonly [string, readonly string[]][] = [
    ['/documents', map.documents.map((item) => item.documentId)],
    ['/pages', map.pages.map((item) => item.pageId)],
    ['/contentBlocks', map.contentBlocks.map((item) => item.contentBlockId)],
    ['/sections', map.sections.map((item) => item.sectionId)],
    ['/tables', map.tables.map((item) => item.tableId)],
    ['/notes', map.notes.map((item) => item.noteId)],
    ['/entityHints', map.entityHints.map((item) => item.entityHintId)],
    ['/contextEdges', map.contextEdges.map((item) => item.contextEdgeId)],
  ];
  for (const [path, values] of groups) issues.push(...duplicates(path, values));
  issues.push(
    ...duplicates(
      '/documents/ordinal',
      map.documents.map((item) => String(item.ordinal)),
    ),
  );
  if (map.documentCount !== map.documents.length) issues.push('/documentCount: inconsistent');
  if (map.pageCount !== map.pages.length) issues.push('/pageCount: inconsistent');

  const refSets: Record<CommercialDocumentMapRef['refType'], ReadonlySet<string>> = {
    PAGE: new Set(pages.keys()),
    CONTENT_BLOCK: new Set(blocks.keys()),
    SECTION: new Set(sections.keys()),
    TABLE: new Set(tables.keys()),
    NOTE: new Set(notes.keys()),
  };
  const refDocument = (ref: CommercialDocumentMapRef): string | undefined => {
    if (ref.refType === 'PAGE') return pages.get(ref.refId)?.documentId;
    if (ref.refType === 'CONTENT_BLOCK') return blocks.get(ref.refId)?.documentId;
    if (ref.refType === 'SECTION') return sections.get(ref.refId)?.documentId;
    if (ref.refType === 'TABLE') return tables.get(ref.refId)?.documentId;
    return notes.get(ref.refId)?.documentId;
  };
  const checkDocument = (path: string, documentId: string): void => {
    if (!documents.has(documentId)) issues.push(`${path}: unknownRef:${documentId}`);
  };
  const checkPageDocument = (path: string, pageId: string, documentId: string): void => {
    const page = pages.get(pageId);
    if (!page) issues.push(`${path}: unknownRef:${pageId}`);
    else if (page.documentId !== documentId) issues.push(`${path}: crossDocumentRef:${pageId}`);
  };

  map.documents.forEach((document, index) => {
    const documentPages = map.pages
      .filter((page) => page.documentId === document.documentId)
      .map((page) => page.pageNumber)
      .sort((left, right) => left - right);
    const expected = Array.from({ length: document.pageCount }, (_, pageIndex) => pageIndex + 1);
    if (!sameValues(documentPages.map(String), expected.map(String)))
      issues.push(`/documents/${index}/pageCount: nonContiguousPages`);
    for (const [hintIndex, hint] of [
      ...document.titleHints,
      ...document.issuerHints,
      ...document.competenceHints,
      ...document.validityHints,
    ].entries())
      issues.push(
        ...unknownRefs(
          `/documents/${index}/metadataHints/${hintIndex}/sourceBlockIds`,
          hint.sourceBlockIds,
          new Set(blocks.keys()),
        ),
      );
  });

  map.pages.forEach((page, index) => {
    const path = `/pages/${index}`;
    checkDocument(`${path}/documentId`, page.documentId);
    const document = documents.get(page.documentId);
    if (document && page.pageNumber > document.pageCount)
      issues.push(`${path}/pageNumber: outOfRange`);
    issues.push(...unknownRefs(`${path}/sectionIds`, page.sectionIds, new Set(sections.keys())));
    issues.push(...unknownRefs(`${path}/tableIds`, page.tableIds, new Set(tables.keys())));
    issues.push(...unknownRefs(`${path}/noteIds`, page.noteIds, new Set(notes.keys())));
    issues.push(...unknownRefs(`${path}/entityHintIds`, page.entityHintIds, new Set(hints.keys())));
    issues.push(
      ...unknownRefs(`${path}/contextEdgeIds`, page.contextEdgeIds, new Set(edges.keys())),
    );
    issues.push(
      ...unknownRefs(`${path}/contentBlockIds`, page.contentBlockIds, new Set(blocks.keys())),
    );
    for (const blockId of page.contentBlockIds) {
      const block = blocks.get(blockId);
      if (block && (block.pageId !== page.pageId || block.documentId !== page.documentId))
        issues.push(`${path}/contentBlockIds: inconsistentOwner:${blockId}`);
    }
  });

  map.contentBlocks.forEach((block, index) => {
    checkDocument(`/contentBlocks/${index}/documentId`, block.documentId);
    checkPageDocument(`/contentBlocks/${index}/pageId`, block.pageId, block.documentId);
    if (!pages.get(block.pageId)?.contentBlockIds.includes(block.contentBlockId))
      issues.push(`/contentBlocks/${index}: missingPageBackReference`);
  });

  map.sections.forEach((section, index) => {
    const path = `/sections/${index}`;
    checkDocument(`${path}/documentId`, section.documentId);
    section.pageIds.forEach((pageId) =>
      checkPageDocument(`${path}/pageIds`, pageId, section.documentId),
    );
    issues.push(
      ...unknownRefs(`${path}/entityHintIds`, section.entityHintIds, new Set(hints.keys())),
    );
    issues.push(
      ...unknownRefs(`${path}/sourceBlockIds`, section.sourceBlockIds, new Set(blocks.keys())),
    );
    const pageNumbers = section.pageIds.map((pageId) => pages.get(pageId)?.pageNumber ?? 0);
    if (!sameValues(pageNumbers.map(String), [...pageNumbers].sort((a, b) => a - b).map(String)))
      issues.push(`${path}/pageIds: mustBeAscending`);
    if (section.parentSectionId) {
      const parent = sections.get(section.parentSectionId);
      if (!parent) issues.push(`${path}/parentSectionId: unknownRef:${section.parentSectionId}`);
      else if (parent.documentId !== section.documentId)
        issues.push(`${path}/parentSectionId: crossDocumentRef`);
      if (section.parentSectionId === section.sectionId)
        issues.push(`${path}/parentSectionId: selfReference`);
    }
    for (const pageId of section.pageIds)
      if (!pages.get(pageId)?.sectionIds.includes(section.sectionId))
        issues.push(`${path}/pageIds: missingPageBackReference:${pageId}`);
  });
  for (const section of map.sections) {
    const visited = new Set([section.sectionId]);
    let parent = section.parentSectionId;
    while (parent) {
      if (visited.has(parent)) {
        issues.push('/sections: parentCycle');
        break;
      }
      visited.add(parent);
      parent = sections.get(parent)?.parentSectionId;
    }
  }

  map.tables.forEach((table, index) => {
    const path = `/tables/${index}`;
    checkDocument(`${path}/documentId`, table.documentId);
    table.pageIds.forEach((pageId) =>
      checkPageDocument(`${path}/pageIds`, pageId, table.documentId),
    );
    issues.push(
      ...unknownRefs(`${path}/headerBlockIds`, table.headerBlockIds, new Set(blocks.keys())),
    );
    issues.push(
      ...unknownRefs(`${path}/sourceBlockIds`, table.sourceBlockIds, new Set(blocks.keys())),
    );
    issues.push(
      ...unknownRefs(`${path}/entityHintIds`, table.entityHintIds, new Set(hints.keys())),
    );
    issues.push(
      ...unknownRefs(`${path}/footnoteNoteIds`, table.footnoteNoteIds, new Set(notes.keys())),
    );
    issues.push(
      ...unknownRefs(`${path}/contextEdgeIds`, table.contextEdgeIds, new Set(edges.keys())),
    );
    if (
      !sameValues(
        table.pageIds,
        table.segments.map((segment) => segment.pageId),
      )
    )
      issues.push(`${path}/segments: pagesMismatch`);
    const pageNumbers = table.pageIds.map((pageId) => pages.get(pageId)?.pageNumber ?? 0);
    if (!sameValues(pageNumbers.map(String), [...pageNumbers].sort((a, b) => a - b).map(String)))
      issues.push(`${path}/pageIds: mustBeAscending`);
    if (table.pageIds.length === 1 && table.segments[0]?.position !== 'WHOLE')
      issues.push(`${path}/segments/0/position: expectedWhole`);
    if (table.pageIds.length > 1) {
      if (table.segments[0]?.position !== 'START')
        issues.push(`${path}/segments/0/position: expectedStart`);
      if (table.segments.at(-1)?.position !== 'END') issues.push(`${path}/segments: expectedEnd`);
      if (table.segments.slice(1, -1).some((segment) => segment.position !== 'CONTINUE'))
        issues.push(`${path}/segments: invalidContinuationPosition`);
    }
    table.segments.forEach((segment, segmentIndex) => {
      issues.push(
        ...unknownRefs(
          `${path}/segments/${segmentIndex}/sourceBlockIds`,
          segment.sourceBlockIds,
          new Set(blocks.keys()),
        ),
        ...unknownRefs(
          `${path}/segments/${segmentIndex}/inheritedHeaderBlockIds`,
          segment.inheritedHeaderBlockIds,
          new Set(table.headerBlockIds),
        ),
      );
      if (segment.position === 'CONTINUE' && !segment.inheritedHeaderBlockIds.length)
        issues.push(`${path}/segments/${segmentIndex}: continuationWithoutInheritedHeader`);
    });
    for (const pageId of table.pageIds)
      if (!pages.get(pageId)?.tableIds.includes(table.tableId))
        issues.push(`${path}/pageIds: missingPageBackReference:${pageId}`);
  });

  map.notes.forEach((note, index) => {
    const path = `/notes/${index}`;
    checkDocument(`${path}/documentId`, note.documentId);
    checkPageDocument(`${path}/pageId`, note.pageId, note.documentId);
    issues.push(...unknownRefs(`${path}/sectionIds`, note.sectionIds, new Set(sections.keys())));
    issues.push(...unknownRefs(`${path}/tableIds`, note.tableIds, new Set(tables.keys())));
    issues.push(
      ...unknownRefs(`${path}/sourceBlockIds`, note.sourceBlockIds, new Set(blocks.keys())),
    );
    if (!pages.get(note.pageId)?.noteIds.includes(note.noteId))
      issues.push(`${path}: missingPageBackReference`);
  });
  map.entityHints.forEach((hint, index) => {
    checkDocument(`/entityHints/${index}/documentId`, hint.documentId);
    issues.push(
      ...unknownRefs(
        `/entityHints/${index}/sourceBlockIds`,
        hint.sourceBlockIds,
        new Set(blocks.keys()),
      ),
    );
  });

  map.contextEdges.forEach((edge, index) => {
    const path = `/contextEdges/${index}`;
    if (!refSets[edge.from.refType].has(edge.from.refId))
      issues.push(`${path}/from: unknownRef:${edge.from.refId}`);
    if (!refSets[edge.to.refType].has(edge.to.refId))
      issues.push(`${path}/to: unknownRef:${edge.to.refId}`);
    const fromDocument = refDocument(edge.from);
    const toDocument = refDocument(edge.to);
    if (fromDocument && toDocument && fromDocument !== toDocument)
      issues.push(`${path}: crossDocumentRef`);
    if (edge.from.refType === edge.to.refType && edge.from.refId === edge.to.refId)
      issues.push(`${path}: selfReference`);
    if (
      edge.relation === 'TABLE_CONTINUES' &&
      (edge.from.refType !== 'PAGE' || edge.to.refType !== 'PAGE')
    )
      issues.push(`${path}: invalidContinuationRefs`);
    if (
      edge.relation === 'INHERITS_HEADER' &&
      (edge.from.refType !== 'PAGE' || edge.to.refType !== 'CONTENT_BLOCK')
    )
      issues.push(`${path}: invalidHeaderRefs`);
  });

  if (issues.length)
    throw new CommercialDocumentMapValidationError(sanitizeInvariantIssues(issues));
}

export function validateCommercialDocumentMap(
  payload: unknown,
): asserts payload is CommercialDocumentMapV1 {
  if (bytes(payload) > COMMERCIAL_DOCUMENT_MAP_LIMITS.maxPayloadBytes)
    throw new CommercialDocumentMapValidationError(
      summarizeDiagnostics([{ path: '/', keyword: 'maxPayloadBytes', category: 'schema' }]),
    );
  if (!validateMapSchema(payload))
    throw new CommercialDocumentMapValidationError(
      sanitizeCommercialDocumentMapAjvErrors(validateMapSchema.errors),
    );
  validateCommercialDocumentMapInvariants(payload as CommercialDocumentMapV1);
}

export function validateCommercialExtractionUnitPlan(
  plan: unknown,
  map: CommercialDocumentMapV1,
): asserts plan is CommercialExtractionUnitPlanV1 {
  if (!validatePlanSchema(plan))
    throw new CommercialExtractionUnitPlanValidationError(
      planSchemaIssues(validatePlanSchema.errors),
    );
  const typed = plan as CommercialExtractionUnitPlanV1;
  const issues: string[] = [];
  const documentIds = new Set(map.documents.map((item) => item.documentId));
  const pageIds = new Set(map.pages.map((item) => item.pageId));
  const blockIds = new Set(map.contentBlocks.map((item) => item.contentBlockId));
  const sectionIds = new Set(map.sections.map((item) => item.sectionId));
  const tableIds = new Set(map.tables.map((item) => item.tableId));
  const noteIds = new Set(map.notes.map((item) => item.noteId));
  const hintIds = new Set(map.entityHints.map((item) => item.entityHintId));
  issues.push(
    ...duplicates(
      '/units',
      typed.units.map((unit) => unit.unitId),
    ),
  );
  typed.units.forEach((unit, index) => {
    const path = `/units/${index}`;
    if (unit.ordinal !== index + 1) issues.push(`${path}/ordinal: nonDeterministicOrder`);
    if (!documentIds.has(unit.documentId)) issues.push(`${path}/documentId: unknownRef`);
    issues.push(
      ...unknownRefs(`${path}/primaryPageIds`, unit.primaryPageIds, pageIds),
      ...unknownRefs(`${path}/contextPageIds`, unit.contextPageIds, pageIds),
      ...unknownRefs(`${path}/primaryContentBlockIds`, unit.primaryContentBlockIds, blockIds),
      ...unknownRefs(`${path}/contextContentBlockIds`, unit.contextContentBlockIds, blockIds),
      ...unknownRefs(`${path}/sectionIds`, unit.sectionIds, sectionIds),
      ...unknownRefs(`${path}/tableIds`, unit.tableIds, tableIds),
      ...unknownRefs(`${path}/noteIds`, unit.noteIds, noteIds),
      ...unknownRefs(`${path}/entityHintIds`, unit.entityHintIds, hintIds),
    );
    if (unit.primaryPageIds.some((pageId) => unit.contextPageIds.includes(pageId)))
      issues.push(`${path}: primaryAndContextPageOverlap`);
    if (
      unit.primaryContentBlockIds.some((blockId) => unit.contextContentBlockIds.includes(blockId))
    )
      issues.push(`${path}: primaryAndContextBlockOverlap`);
    for (const pageId of unit.contextPageIds)
      if (
        !unit.overlaps.some(
          (overlap) =>
            overlap.refType === 'PAGE' &&
            overlap.refId === pageId &&
            overlap.usage === 'CONTEXT_ONLY',
        )
      )
        issues.push(`${path}/contextPageIds: unmarkedContextOverlap:${pageId}`);
    for (const blockId of unit.contextContentBlockIds)
      if (
        !unit.overlaps.some(
          (overlap) =>
            overlap.refType === 'CONTENT_BLOCK' &&
            overlap.refId === blockId &&
            overlap.usage === 'CONTEXT_ONLY',
        )
      )
        issues.push(`${path}/contextContentBlockIds: unmarkedContextOverlap:${blockId}`);
    unit.overlaps.forEach((overlap, overlapIndex) => {
      const known =
        overlap.refType === 'PAGE'
          ? pageIds
          : overlap.refType === 'CONTENT_BLOCK'
            ? blockIds
            : noteIds;
      if (!known.has(overlap.refId))
        issues.push(`${path}/overlaps/${overlapIndex}/refId: unknownRef:${overlap.refId}`);
    });
    if ((unit.partition === undefined) !== (unit.logicalTableId === undefined))
      issues.push(`${path}: partitionAndLogicalTableMustCoexist`);
    if (
      unit.expectedTableRows !== undefined &&
      unit.expectedTableRows > COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxApproximateRowsPerUnit
    )
      issues.push(`${path}/expectedTableRows: aboveLimit`);
  });
  const partitionGroups = new Map<string, CommercialExtractionUnitPlanV1['units'][number][]>();
  for (const unit of typed.units) {
    if (!unit.logicalTableId) continue;
    const group = partitionGroups.get(unit.logicalTableId) ?? [];
    group.push(unit);
    partitionGroups.set(unit.logicalTableId, group);
  }
  for (const [tableId, group] of partitionGroups) {
    const declaredCount = group[0]?.partition?.count;
    if (
      declaredCount !== group.length ||
      group.some((unit) => unit.partition?.count !== declaredCount) ||
      !sameValues(
        group.map((unit) => String(unit.partition?.index)),
        Array.from({ length: group.length }, (_, index) => String(index + 1)),
      )
    )
      issues.push(`/units: inconsistentPartitions:${tableId}`);
  }
  const expectedCoverage = {
    assignedPageIds: sortedUnique(
      typed.units.flatMap((unit) => [...unit.primaryPageIds, ...unit.contextPageIds]),
    ),
    assignedSectionIds: sortedUnique(typed.units.flatMap((unit) => unit.sectionIds)),
    assignedTableIds: sortedUnique(typed.units.flatMap((unit) => unit.tableIds)),
    reachableNoteIds: sortedUnique(typed.units.flatMap((unit) => unit.noteIds)),
    assignedPrimaryContentBlockIds: sortedUnique(
      typed.units.flatMap((unit) => unit.primaryContentBlockIds),
    ),
  };
  for (const [key, value] of Object.entries(expectedCoverage))
    if (!sameValues(typed.coverage[key as keyof typeof expectedCoverage], value))
      issues.push(`/coverage/${key}: inconsistentWithUnits`);
  const expectedOrphans = {
    orphanPageIds: sortedUnique(
      map.pages
        .map((item) => item.pageId)
        .filter((id) => !expectedCoverage.assignedPageIds.includes(id)),
    ),
    orphanSectionIds: sortedUnique(
      map.sections
        .map((item) => item.sectionId)
        .filter((id) => !expectedCoverage.assignedSectionIds.includes(id)),
    ),
    orphanTableIds: sortedUnique(
      map.tables
        .map((item) => item.tableId)
        .filter((id) => !expectedCoverage.assignedTableIds.includes(id)),
    ),
    unreachableNoteIds: sortedUnique(
      map.notes
        .filter(
          (item) =>
            item.relevantForExtraction && !expectedCoverage.reachableNoteIds.includes(item.noteId),
        )
        .map((item) => item.noteId),
    ),
    orphanContentBlockIds: sortedUnique(
      map.contentBlocks
        .map((item) => item.contentBlockId)
        .filter((id) => !expectedCoverage.assignedPrimaryContentBlockIds.includes(id)),
    ),
  };
  for (const [key, value] of Object.entries(expectedOrphans))
    if (!sameValues(typed.coverage[key as keyof typeof expectedOrphans], value))
      issues.push(`/coverage/${key}: inconsistentWithMap`);
  const complete = Object.values(expectedOrphans).every((items) => items.length === 0);
  if (typed.coverage.allPagesClassified !== complete)
    issues.push('/coverage/allPagesClassified: inconsistent');
  if (issues.length) throw new CommercialExtractionUnitPlanValidationError(issues);
}
