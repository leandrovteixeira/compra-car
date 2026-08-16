import {
  COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION,
  COMMERCIAL_EXTRACTION_UNIT_LIMITS,
  COMMERCIAL_EXTRACTION_UNIT_PLAN_SCHEMA_VERSION,
  type CommercialDocumentMapRef,
  type CommercialDocumentMapV1,
  type CommercialExtractionUnit,
  type CommercialExtractionUnitOverlap,
  type CommercialExtractionUnitPlanV1,
  type CommercialExtractionUnitType,
} from './commercial-document-map';

interface MutableUnit {
  unitType: CommercialExtractionUnitType;
  documentId: string;
  primaryPageIds: string[];
  contextPageIds: string[];
  primaryContentBlockIds: string[];
  contextContentBlockIds: string[];
  sectionIds: string[];
  tableIds: string[];
  noteIds: string[];
  entityHintIds: string[];
  expectedTableRows?: number;
  logicalTableId?: string;
  partition?: { index: number; count: number };
  reason: string;
  overlaps: CommercialExtractionUnitOverlap[];
  sortPage: number;
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];
const sortedUnique = (values: readonly string[]): string[] => unique(values).sort();
const chunks = <T>(values: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
};
const contiguousPageGroups = <T extends { pageNumber: number }>(values: readonly T[]): T[][] => {
  const groups: T[][] = [];
  for (const value of values) {
    const current = groups.at(-1);
    if (!current?.length || value.pageNumber !== current.at(-1)!.pageNumber + 1)
      groups.push([value]);
    else current.push(value);
  }
  return groups;
};
const distribute = <T>(values: readonly T[], count: number): T[][] =>
  Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * values.length) / count);
    const end = Math.floor(((index + 1) * values.length) / count);
    return values.slice(start, Math.max(start + 1, end));
  });
const unitPriority: Record<CommercialExtractionUnitType, number> = {
  TABLE: 1,
  FAMILY: 2,
  CHANNEL: 2,
  SECTION: 2,
  PAGE_RANGE_FALLBACK: 3,
};

export function createCommercialExtractionUnitPlan(
  map: CommercialDocumentMapV1,
): CommercialExtractionUnitPlanV1 {
  const pages = new Map(map.pages.map((item) => [item.pageId, item]));
  const blocks = new Map(map.contentBlocks.map((item) => [item.contentBlockId, item]));
  const notes = new Map(map.notes.map((item) => [item.noteId, item]));
  const sections = new Map(map.sections.map((item) => [item.sectionId, item]));
  const tables = new Map(map.tables.map((item) => [item.tableId, item]));
  const documentOrdinal = new Map(map.documents.map((item) => [item.documentId, item.ordinal]));
  const pageOrder = (pageId: string): number =>
    pages.get(pageId)?.pageNumber ?? Number.MAX_SAFE_INTEGER;
  const orderedPageIds = (ids: readonly string[]): string[] =>
    unique(ids).sort((left, right) => pageOrder(left) - pageOrder(right));
  const assignedBlocks = new Set<string>();
  const units: MutableUnit[] = [];

  const makeBase = (
    unitType: CommercialExtractionUnitType,
    documentId: string,
    primaryPageIds: readonly string[],
    primaryContentBlockIds: readonly string[],
    reason: string,
  ): MutableUnit => ({
    unitType,
    documentId,
    primaryPageIds: orderedPageIds(primaryPageIds),
    contextPageIds: [],
    primaryContentBlockIds: sortedUnique(primaryContentBlockIds),
    contextContentBlockIds: [],
    sectionIds: [],
    tableIds: [],
    noteIds: [],
    entityHintIds: [],
    reason,
    overlaps: [],
    sortPage: Math.min(...primaryPageIds.map(pageOrder)),
  });

  const orderedTables = [...map.tables].sort((left, right) => {
    const documentDifference =
      (documentOrdinal.get(left.documentId) ?? 0) - (documentOrdinal.get(right.documentId) ?? 0);
    return (
      documentDifference ||
      pageOrder(left.pageIds[0]!) - pageOrder(right.pageIds[0]!) ||
      left.tableId.localeCompare(right.tableId)
    );
  });
  for (const table of orderedTables) {
    const rowPartitions = Math.max(
      1,
      Math.ceil(
        (table.approximateRowCount ?? 0) /
          COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxApproximateRowsPerUnit,
      ),
    );
    const pagePartitions = Math.ceil(
      table.pageIds.length / COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxPagesPerUnit,
    );
    const partitionCount = Math.max(rowPartitions, pagePartitions);
    const partitionPages = distribute(table.pageIds, partitionCount);
    for (let partitionIndex = 0; partitionIndex < partitionCount; partitionIndex += 1) {
      const primaryPageIds = partitionPages[partitionIndex]!;
      const segmentBlocks = table.segments
        .filter((segment) => primaryPageIds.includes(segment.pageId))
        .flatMap((segment) => segment.sourceBlockIds);
      const primaryContentBlockIds = sortedUnique([
        ...segmentBlocks,
        ...(primaryPageIds.includes(table.pageIds[0]!) ? table.headerBlockIds : []),
      ]);
      primaryContentBlockIds.forEach((blockId) => assignedBlocks.add(blockId));
      const unit = makeBase(
        'TABLE',
        table.documentId,
        primaryPageIds,
        primaryContentBlockIds,
        partitionCount === 1
          ? 'Logical table with required structural context.'
          : 'Bounded partition of one logical table.',
      );
      unit.tableIds = [table.tableId];
      unit.sectionIds = sortedUnique(
        primaryPageIds.flatMap((pageId) => pages.get(pageId)?.sectionIds ?? []),
      );
      unit.entityHintIds = sortedUnique([
        ...table.entityHintIds,
        ...primaryPageIds.flatMap((pageId) => pages.get(pageId)?.entityHintIds ?? []),
        ...unit.sectionIds.flatMap((sectionId) => sections.get(sectionId)?.entityHintIds ?? []),
      ]);
      if (table.approximateRowCount !== undefined) {
        const start = Math.floor((partitionIndex * table.approximateRowCount) / partitionCount);
        const end = Math.floor(((partitionIndex + 1) * table.approximateRowCount) / partitionCount);
        unit.expectedTableRows = end - start;
      }
      if (partitionCount > 1) {
        unit.logicalTableId = table.tableId;
        unit.partition = { index: partitionIndex + 1, count: partitionCount };
        for (const pageId of primaryPageIds)
          if (
            partitionPages.some(
              (other, index) => index !== partitionIndex && other.includes(pageId),
            )
          )
            unit.overlaps.push({
              refType: 'PAGE',
              refId: pageId,
              usage: 'PARTITION_PRIMARY',
              reason: 'TABLE_PARTITION',
            });
      }
      units.push(unit);
    }
  }

  const orderedSections = [...map.sections].sort((left, right) => {
    const documentDifference =
      (documentOrdinal.get(left.documentId) ?? 0) - (documentOrdinal.get(right.documentId) ?? 0);
    return (
      documentDifference ||
      pageOrder(left.pageIds[0]!) - pageOrder(right.pageIds[0]!) ||
      left.sectionId.localeCompare(right.sectionId)
    );
  });
  for (const section of orderedSections) {
    const unassigned = section.sourceBlockIds.filter((blockId) => !assignedBlocks.has(blockId));
    if (!unassigned.length) {
      const owner = units.find(
        (unit) =>
          unit.documentId === section.documentId &&
          unit.primaryPageIds.some((pageId) => section.pageIds.includes(pageId)),
      );
      if (owner) owner.sectionIds = sortedUnique([...owner.sectionIds, section.sectionId]);
      continue;
    }
    const pagesWithContent = orderedPageIds(
      unassigned
        .map((blockId) => blocks.get(blockId)?.pageId)
        .filter((pageId): pageId is string => Boolean(pageId)),
    );
    for (const pageChunk of chunks(
      pagesWithContent,
      COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxPagesPerUnit,
    )) {
      const blockChunk = unassigned.filter((blockId) =>
        pageChunk.includes(blocks.get(blockId)?.pageId ?? ''),
      );
      blockChunk.forEach((blockId) => assignedBlocks.add(blockId));
      const type: CommercialExtractionUnitType =
        section.semanticRole === 'FAMILY' || section.semanticRole === 'MODEL'
          ? 'FAMILY'
          : section.semanticRole === 'CHANNEL'
            ? 'CHANNEL'
            : 'SECTION';
      const unit = makeBase(
        type,
        section.documentId,
        pageChunk,
        blockChunk,
        'Coherent mapped section not owned by a logical table.',
      );
      unit.sectionIds = [section.sectionId];
      unit.entityHintIds = sortedUnique([
        ...section.entityHintIds,
        ...pageChunk.flatMap((pageId) => pages.get(pageId)?.entityHintIds ?? []),
      ]);
      units.push(unit);
    }
  }

  for (const document of [...map.documents].sort((left, right) => left.ordinal - right.ordinal)) {
    const documentPages = map.pages
      .filter((page) => page.documentId === document.documentId)
      .sort((left, right) => left.pageNumber - right.pageNumber);
    const fallbackPages = documentPages.filter(
      (page) =>
        page.contentBlockIds.some((blockId) => !assignedBlocks.has(blockId)) ||
        !units.some((unit) => unit.primaryPageIds.includes(page.pageId)),
    );
    const fallbackChunks = contiguousPageGroups(fallbackPages).flatMap((group) =>
      chunks(group, COMMERCIAL_EXTRACTION_UNIT_LIMITS.fallbackPagesPerUnit),
    );
    for (const pageChunk of fallbackChunks) {
      const pageIds = pageChunk.map((page) => page.pageId);
      const blockIds = pageChunk.flatMap((page) =>
        page.contentBlockIds.filter((blockId) => !assignedBlocks.has(blockId)),
      );
      if (!blockIds.length) {
        const representative = pageChunk.flatMap((page) => page.contentBlockIds).slice(0, 1);
        blockIds.push(...representative);
      }
      blockIds.forEach((blockId) => assignedBlocks.add(blockId));
      const unit = makeBase(
        'PAGE_RANGE_FALLBACK',
        document.documentId,
        pageIds,
        blockIds,
        'Bounded fallback for structurally unassigned content.',
      );
      unit.sectionIds = sortedUnique(pageChunk.flatMap((page) => page.sectionIds));
      unit.entityHintIds = sortedUnique(pageChunk.flatMap((page) => page.entityHintIds));
      units.push(unit);
    }
  }

  const addOverlap = (
    unit: MutableUnit,
    refType: CommercialExtractionUnitOverlap['refType'],
    refId: string,
    reason: CommercialExtractionUnitOverlap['reason'],
  ): void => {
    if (
      !unit.overlaps.some(
        (item) => item.refType === refType && item.refId === refId && item.usage === 'CONTEXT_ONLY',
      )
    )
      unit.overlaps.push({ refType, refId, usage: 'CONTEXT_ONLY', reason });
  };
  const addContextBlock = (
    unit: MutableUnit,
    blockId: string,
    reason: CommercialExtractionUnitOverlap['reason'],
  ): void => {
    if (unit.primaryContentBlockIds.includes(blockId)) return;
    unit.contextContentBlockIds.push(blockId);
    addOverlap(unit, 'CONTENT_BLOCK', blockId, reason);
    const pageId = blocks.get(blockId)?.pageId;
    if (pageId && !unit.primaryPageIds.includes(pageId)) {
      unit.contextPageIds.push(pageId);
      addOverlap(unit, 'PAGE', pageId, reason);
    }
  };
  const addNote = (
    unit: MutableUnit,
    noteId: string,
    reason: CommercialExtractionUnitOverlap['reason'],
  ): void => {
    const note = notes.get(noteId);
    if (!note || note.documentId !== unit.documentId) return;
    unit.noteIds.push(noteId);
    addOverlap(unit, 'NOTE', noteId, reason);
    note.sourceBlockIds.forEach((blockId) => addContextBlock(unit, blockId, reason));
  };
  const matches = (unit: MutableUnit, ref: CommercialDocumentMapRef): boolean => {
    if (ref.refType === 'PAGE') return unit.primaryPageIds.includes(ref.refId);
    if (ref.refType === 'CONTENT_BLOCK') return unit.primaryContentBlockIds.includes(ref.refId);
    if (ref.refType === 'SECTION') return unit.sectionIds.includes(ref.refId);
    if (ref.refType === 'TABLE') return unit.tableIds.includes(ref.refId);
    return unit.noteIds.includes(ref.refId);
  };
  const addRefContext = (unit: MutableUnit, ref: CommercialDocumentMapRef): void => {
    if (ref.refType === 'PAGE' && !unit.primaryPageIds.includes(ref.refId)) {
      unit.contextPageIds.push(ref.refId);
      addOverlap(unit, 'PAGE', ref.refId, 'CONTEXT_EDGE');
    } else if (ref.refType === 'CONTENT_BLOCK') addContextBlock(unit, ref.refId, 'CONTEXT_EDGE');
    else if (ref.refType === 'NOTE') addNote(unit, ref.refId, 'CONTEXT_EDGE');
  };

  for (const unit of units) {
    const directNotes = map.notes.filter(
      (note) =>
        note.documentId === unit.documentId &&
        (note.noteKind === 'DOCUMENT_WIDE' ||
          note.sectionIds.some((sectionId) => unit.sectionIds.includes(sectionId)) ||
          note.tableIds.some((tableId) => unit.tableIds.includes(tableId)) ||
          note.sourceBlockIds.some((blockId) => unit.primaryContentBlockIds.includes(blockId))),
    );
    directNotes.forEach((note) =>
      addNote(
        unit,
        note.noteId,
        note.noteKind === 'DOCUMENT_WIDE' ? 'DOCUMENT_RULE' : 'SHARED_NOTE',
      ),
    );
    for (const tableId of unit.tableIds) {
      const table = tables.get(tableId);
      table?.footnoteNoteIds.forEach((noteId) => addNote(unit, noteId, 'SHARED_NOTE'));
      if (unit.partition && unit.partition.index > 1)
        table?.headerBlockIds.forEach((blockId) =>
          addContextBlock(unit, blockId, 'INHERITED_HEADER'),
        );
    }
    for (const edge of map.contextEdges) {
      if (edge.relation === 'INHERITS_HEADER') {
        if (matches(unit, edge.from)) addRefContext(unit, edge.to);
      } else if (
        edge.relation === 'FOOTNOTE_APPLIES_TO_TABLE' ||
        edge.relation === 'NOTE_GOVERNS_SECTION' ||
        edge.relation === 'NOTE_GOVERNS_TABLE' ||
        edge.relation === 'NOTE_GOVERNS_DOCUMENT'
      ) {
        if (matches(unit, edge.to)) addRefContext(unit, edge.from);
      } else {
        if (matches(unit, edge.from)) addRefContext(unit, edge.to);
        if (matches(unit, edge.to)) addRefContext(unit, edge.from);
      }
    }
    unit.noteIds = sortedUnique(unit.noteIds);
    unit.contextContentBlockIds = sortedUnique(unit.contextContentBlockIds);
    unit.contextPageIds = orderedPageIds(
      unit.contextPageIds.filter((pageId) => !unit.primaryPageIds.includes(pageId)),
    );
    if (unit.contextPageIds.length > COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxContextPagesPerUnit)
      throw new Error('COMMERCIAL_EXTRACTION_UNIT_CONTEXT_LIMIT_EXCEEDED');
    unit.sectionIds = sortedUnique(unit.sectionIds);
    unit.tableIds = sortedUnique(unit.tableIds);
    unit.entityHintIds = sortedUnique(unit.entityHintIds);
    unit.overlaps = unit.overlaps.filter(
      (overlap, index, all) =>
        all.findIndex(
          (item) =>
            item.refType === overlap.refType &&
            item.refId === overlap.refId &&
            item.usage === overlap.usage &&
            item.reason === overlap.reason,
        ) === index,
    );
  }

  units.sort((left, right) => {
    const documentDifference =
      (documentOrdinal.get(left.documentId) ?? 0) - (documentOrdinal.get(right.documentId) ?? 0);
    return (
      documentDifference ||
      unitPriority[left.unitType] - unitPriority[right.unitType] ||
      left.sortPage - right.sortPage ||
      left.reason.localeCompare(right.reason)
    );
  });
  if (units.length > COMMERCIAL_EXTRACTION_UNIT_LIMITS.maxUnits)
    throw new Error('COMMERCIAL_EXTRACTION_UNIT_LIMIT_EXCEEDED');
  const finalized: CommercialExtractionUnit[] = units.map((unit, index) => ({
    unitId: `unit-${String(index + 1).padStart(4, '0')}-${unit.unitType.toLowerCase().replaceAll('_', '-')}`,
    unitType: unit.unitType,
    ordinal: index + 1,
    documentId: unit.documentId,
    primaryPageIds: unit.primaryPageIds,
    contextPageIds: unit.contextPageIds,
    primaryContentBlockIds: unit.primaryContentBlockIds,
    contextContentBlockIds: unit.contextContentBlockIds,
    sectionIds: unit.sectionIds,
    tableIds: unit.tableIds,
    noteIds: unit.noteIds,
    entityHintIds: unit.entityHintIds,
    ...(unit.expectedTableRows === undefined ? {} : { expectedTableRows: unit.expectedTableRows }),
    ...(unit.logicalTableId === undefined ? {} : { logicalTableId: unit.logicalTableId }),
    ...(unit.partition === undefined ? {} : { partition: unit.partition }),
    reason: unit.reason,
    overlaps: unit.overlaps,
  }));
  const assignedPageIds = sortedUnique(
    finalized.flatMap((unit) => [...unit.primaryPageIds, ...unit.contextPageIds]),
  );
  const assignedSectionIds = sortedUnique(finalized.flatMap((unit) => unit.sectionIds));
  const assignedTableIds = sortedUnique(finalized.flatMap((unit) => unit.tableIds));
  const reachableNoteIds = sortedUnique(finalized.flatMap((unit) => unit.noteIds));
  const assignedPrimaryContentBlockIds = sortedUnique(
    finalized.flatMap((unit) => unit.primaryContentBlockIds),
  );
  const orphanPageIds = sortedUnique(
    map.pages.map((item) => item.pageId).filter((id) => !assignedPageIds.includes(id)),
  );
  const orphanSectionIds = sortedUnique(
    map.sections.map((item) => item.sectionId).filter((id) => !assignedSectionIds.includes(id)),
  );
  const orphanTableIds = sortedUnique(
    map.tables.map((item) => item.tableId).filter((id) => !assignedTableIds.includes(id)),
  );
  const unreachableNoteIds = sortedUnique(
    map.notes
      .filter((item) => item.relevantForExtraction && !reachableNoteIds.includes(item.noteId))
      .map((item) => item.noteId),
  );
  const orphanContentBlockIds = sortedUnique(
    map.contentBlocks
      .map((item) => item.contentBlockId)
      .filter((id) => !assignedPrimaryContentBlockIds.includes(id)),
  );
  return {
    schemaVersion: COMMERCIAL_EXTRACTION_UNIT_PLAN_SCHEMA_VERSION,
    sourceMapSchemaVersion: COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION,
    units: finalized,
    coverage: {
      allPagesClassified:
        !orphanPageIds.length &&
        !orphanSectionIds.length &&
        !orphanTableIds.length &&
        !unreachableNoteIds.length &&
        !orphanContentBlockIds.length,
      assignedPageIds,
      assignedSectionIds,
      assignedTableIds,
      reachableNoteIds,
      assignedPrimaryContentBlockIds,
      orphanPageIds,
      orphanSectionIds,
      orphanTableIds,
      unreachableNoteIds,
      orphanContentBlockIds,
    },
  };
}
