import type {
  CommercialDocumentEvidence,
  CommercialDocumentExtractionV1,
  CommercialDocumentScopeSelector,
} from './commercial-document-extraction';

type IdMap = ReadonlyMap<string, string>;
const mapped = (map: IdMap, value: string | undefined): string | undefined =>
  value === undefined ? undefined : (map.get(value) ?? value);
const mappedList = (map: IdMap, values: readonly string[]): string[] =>
  values.map((value) => mapped(map, value)!);
const makeMap = (
  prefix: string,
  values: readonly string[],
  unitOrdinal: number,
): Map<string, string> =>
  new Map(
    values.map((value, index) => [
      value,
      `${prefix}-u${String(unitOrdinal).padStart(4, '0')}-${String(index + 1).padStart(4, '0')}`,
    ]),
  );

export function canonicalizeCommercialDocumentExtractionUnit(
  value: CommercialDocumentExtractionV1,
  unitOrdinal: number,
): CommercialDocumentExtractionV1 {
  const documents = makeMap(
    'document',
    value.documents.map((item) => item.documentId),
    unitOrdinal,
  );
  const blocks = makeMap(
    'block',
    value.blocks.map((item) => item.blockId),
    unitOrdinal,
  );
  const tables = makeMap(
    'table',
    value.tables.map((item) => item.tableId),
    unitOrdinal,
  );
  const columns = makeMap(
    'column',
    value.tables.flatMap((table) => table.columns.map((item) => item.columnId)),
    unitOrdinal,
  );
  const rows = makeMap(
    'row',
    value.tables.flatMap((table) => table.rows.map((item) => item.rowId)),
    unitOrdinal,
  );
  const vehicles = makeMap(
    'vehicle',
    value.vehicleIdentities.map((item) => item.vehicleIdentityId),
    unitOrdinal,
  );
  const facts = makeMap(
    'fact',
    value.facts.map((item) => item.factId),
    unitOrdinal,
  );
  const scopes = makeMap(
    'scope',
    value.scopes.map((item) => item.scopeId),
    unitOrdinal,
  );
  const groups = makeMap(
    'group',
    value.composition.groups.map((item) => item.groupId),
    unitOrdinal,
  );
  const relations = makeMap(
    'relation',
    value.composition.relationships.map((item) => item.relationId),
    unitOrdinal,
  );
  const units = makeMap(
    'unit',
    value.coverage.units.map((item) => item.unitId),
    unitOrdinal,
  );
  const gaps = makeMap(
    'gap',
    value.coverage.gaps.map((item) => item.gapId),
    unitOrdinal,
  );

  const evidence = (item: CommercialDocumentEvidence): CommercialDocumentEvidence => ({
    ...item,
    blockIds: mappedList(blocks, item.blockIds),
    ...(item.tableId ? { tableId: mapped(tables, item.tableId)! } : {}),
    ...(item.rowId ? { rowId: mapped(rows, item.rowId)! } : {}),
  });
  const selector = (item: CommercialDocumentScopeSelector): CommercialDocumentScopeSelector => ({
    ...item,
    ...(item.documentIds ? { documentIds: mappedList(documents, item.documentIds) } : {}),
    ...(item.vehicleIdentityIds
      ? { vehicleIdentityIds: mappedList(vehicles, item.vehicleIdentityIds) }
      : {}),
    ...(item.groupIds ? { groupIds: mappedList(groups, item.groupIds) } : {}),
  });

  const artifact: CommercialDocumentExtractionV1 = {
    ...structuredClone(value),
    documents: value.documents.map((document) => ({
      ...document,
      documentId: mapped(documents, document.documentId)!,
      competenceCandidates: document.competenceCandidates.map((item) => ({
        ...item,
        evidence: evidence(item.evidence),
      })),
      validityCandidates: document.validityCandidates.map((item) => ({
        ...item,
        evidence: evidence(item.evidence),
      })),
      notes: document.notes.map((item) => ({ ...item, evidence: evidence(item.evidence) })),
    })),
    blocks: value.blocks.map((block) => ({
      ...block,
      blockId: mapped(blocks, block.blockId)!,
      documentId: mapped(documents, block.documentId)!,
      ...(block.tableId ? { tableId: mapped(tables, block.tableId)! } : {}),
      ...(block.rowId ? { rowId: mapped(rows, block.rowId)! } : {}),
    })),
    tables: value.tables.map((table) => ({
      ...table,
      tableId: mapped(tables, table.tableId)!,
      documentId: mapped(documents, table.documentId)!,
      columns: table.columns.map((column) => ({
        ...column,
        columnId: mapped(columns, column.columnId)!,
      })),
      rows: table.rows.map((row) => ({
        ...row,
        rowId: mapped(rows, row.rowId)!,
        cells: row.cells.map((cell) => ({ ...cell, columnId: mapped(columns, cell.columnId)! })),
        sourceBlockIds: mappedList(blocks, row.sourceBlockIds),
      })),
      sourceBlockIds: mappedList(blocks, table.sourceBlockIds),
      footnoteBlockIds: mappedList(blocks, table.footnoteBlockIds),
      continuation: {
        ...table.continuation,
        inheritedHeaderBlockIds: mappedList(blocks, table.continuation.inheritedHeaderBlockIds),
        segments: table.continuation.segments.map((segment) => ({
          ...segment,
          sourceBlockIds: mappedList(blocks, segment.sourceBlockIds),
        })),
      },
    })),
    vehicleIdentities: value.vehicleIdentities.map((vehicle) => ({
      ...vehicle,
      vehicleIdentityId: mapped(vehicles, vehicle.vehicleIdentityId)!,
      evidence: evidence(vehicle.evidence),
    })),
    facts: value.facts.map((fact) => ({
      ...fact,
      factId: mapped(facts, fact.factId)!,
      scopeIds: mappedList(scopes, fact.scopeIds),
      evidence: evidence(fact.evidence),
    })),
    scopes: value.scopes.map((scope) => ({
      ...scope,
      scopeId: mapped(scopes, scope.scopeId)!,
      selector: selector(scope.selector),
      exclusions: selector(scope.exclusions),
      evidenceBlockIds: mappedList(blocks, scope.evidenceBlockIds),
    })),
    composition: {
      groups: value.composition.groups.map((group) => ({
        ...group,
        groupId: mapped(groups, group.groupId)!,
        memberFactIds: mappedList(facts, group.memberFactIds),
        sharedFactIds: mappedList(facts, group.sharedFactIds),
        scopeIds: mappedList(scopes, group.scopeIds),
        ...(group.parentGroupId ? { parentGroupId: mapped(groups, group.parentGroupId)! } : {}),
      })),
      relationships: value.composition.relationships.map((relation) => ({
        ...relation,
        relationId: mapped(relations, relation.relationId)!,
        factIds: mappedList(facts, relation.factIds),
        groupIds: mappedList(groups, relation.groupIds),
        scopeIds: mappedList(scopes, relation.scopeIds),
        evidenceBlockIds: mappedList(blocks, relation.evidenceBlockIds),
      })),
    },
    coverage: {
      ...value.coverage,
      units: value.coverage.units.map((unit) => ({
        ...unit,
        unitId: mapped(units, unit.unitId)!,
        sourceBlockIds: mappedList(blocks, unit.sourceBlockIds),
      })),
      gaps: value.coverage.gaps.map((gap) => ({
        ...gap,
        gapId: mapped(gaps, gap.gapId)!,
        ...(gap.unitId ? { unitId: mapped(units, gap.unitId)! } : {}),
        ...(gap.blockId ? { blockId: mapped(blocks, gap.blockId)! } : {}),
        ...(gap.tableId ? { tableId: mapped(tables, gap.tableId)! } : {}),
        ...(gap.rowId ? { rowId: mapped(rows, gap.rowId)! } : {}),
        ...(gap.scopeId ? { scopeId: mapped(scopes, gap.scopeId)! } : {}),
      })),
      incompleteBlockIds: mappedList(blocks, value.coverage.incompleteBlockIds),
      unresolvedTableRows: value.coverage.unresolvedTableRows.map((row) => ({
        tableId: mapped(tables, row.tableId)!,
        rowId: mapped(rows, row.rowId)!,
      })),
      unresolvedScopeIds: mappedList(scopes, value.coverage.unresolvedScopeIds),
    },
  };
  return artifact;
}
