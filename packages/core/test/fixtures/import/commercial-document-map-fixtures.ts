import {
  COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION,
  type CommercialDocumentEntityHintKind,
  type CommercialDocumentMapContextEdge,
  type CommercialDocumentNoteKind,
  type CommercialDocumentSectionRole,
  type CommercialDocumentMapV1,
  type CommercialDocumentPageRole,
} from '../../../src/import/commercial-document-map';

interface SectionSpec {
  id: string;
  pages: readonly number[];
  role: CommercialDocumentSectionRole;
  hints?: readonly { kind: CommercialDocumentEntityHintKind; value: string }[];
}

interface TableSpec {
  id: string;
  pages: readonly number[];
  rows: number;
  sectionId: string;
  hints?: readonly { kind: CommercialDocumentEntityHintKind; value: string }[];
}

interface NoteSpec {
  id: string;
  page: number;
  kind: CommercialDocumentNoteKind;
  sectionIds?: readonly string[];
  tableIds?: readonly string[];
}

interface MapSpec {
  id: string;
  pageCount: number;
  pageRoles?: Readonly<Record<number, CommercialDocumentPageRole>>;
  sections: readonly SectionSpec[];
  tables: readonly TableSpec[];
  notes?: readonly NoteSpec[];
  extraContextEdges?: readonly CommercialDocumentMapContextEdge[];
}

const pageId = (number: number): string => `page-${String(number).padStart(3, '0')}`;
const bodyBlockId = (number: number): string =>
  `block-page-${String(number).padStart(3, '0')}-body`;
const tableBlockId = (tableId: string, number: number): string =>
  `block-${tableId.slice('table-'.length)}-page-${String(number).padStart(3, '0')}`;
const headerBlockId = (tableId: string): string => `block-${tableId.slice('table-'.length)}-header`;

function buildMap(spec: MapSpec): CommercialDocumentMapV1 {
  const documentId = `document-${spec.id}`;
  const contentBlocks: Array<CommercialDocumentMapV1['contentBlocks'][number]> = [];
  for (let page = 1; page <= spec.pageCount; page += 1)
    contentBlocks.push({
      contentBlockId: bodyBlockId(page),
      documentId,
      pageId: pageId(page),
      blockKind: page === 1 ? 'HEADING' : 'BODY',
      label: page === 1 ? 'Synthetic document heading' : `Synthetic structural block ${page}`,
    });

  const entityHints: Array<CommercialDocumentMapV1['entityHints'][number]> = [];
  const hintIdsBySection = new Map<string, string[]>();
  const hintIdsByTable = new Map<string, string[]>();
  const addHints = (
    ownerId: string,
    ownerPages: readonly number[],
    hints: SectionSpec['hints'] | TableSpec['hints'],
    target: Map<string, string[]>,
  ): void => {
    const ids: string[] = [];
    for (const [index, hint] of (hints ?? []).entries()) {
      const entityHintId = `hint-${ownerId}-${index + 1}`;
      ids.push(entityHintId);
      entityHints.push({
        entityHintId,
        documentId,
        hintKind: hint.kind,
        value: hint.value,
        sourceBlockIds: [bodyBlockId(ownerPages[0]!)],
      });
    }
    target.set(ownerId, ids);
  };
  spec.sections.forEach((section) =>
    addHints(section.id, section.pages, section.hints, hintIdsBySection),
  );
  spec.tables.forEach((table) => addHints(table.id, table.pages, table.hints, hintIdsByTable));

  const contextEdges: CommercialDocumentMapContextEdge[] = [...(spec.extraContextEdges ?? [])];
  const tables = spec.tables.map((table) => {
    const headerId = headerBlockId(table.id);
    contentBlocks.push({
      contentBlockId: headerId,
      documentId,
      pageId: pageId(table.pages[0]!),
      blockKind: 'TABLE_REGION',
      label: 'Synthetic inherited table header',
    });
    const sourceBlockIds = [headerId];
    const segments = table.pages.map((page, index) => {
      const blockId = tableBlockId(table.id, page);
      sourceBlockIds.push(blockId);
      contentBlocks.push({
        contentBlockId: blockId,
        documentId,
        pageId: pageId(page),
        blockKind: 'TABLE_REGION',
        label: `Synthetic logical table segment ${index + 1}`,
      });
      if (index > 0) {
        contextEdges.push({
          contextEdgeId: `edge-${table.id.slice(6)}-continues-${index}`,
          relation: 'TABLE_CONTINUES',
          from: { refType: 'PAGE', refId: pageId(table.pages[index - 1]!) },
          to: { refType: 'PAGE', refId: pageId(page) },
          reason: 'The same synthetic logical table continues on the next page.',
        });
        contextEdges.push({
          contextEdgeId: `edge-${table.id.slice(6)}-header-${index}`,
          relation: 'INHERITS_HEADER',
          from: { refType: 'PAGE', refId: pageId(page) },
          to: { refType: 'CONTENT_BLOCK', refId: headerId },
          reason: 'The continuation segment inherits the first-page header.',
        });
      }
      const position =
        table.pages.length === 1
          ? 'WHOLE'
          : index === 0
            ? 'START'
            : index === table.pages.length - 1
              ? 'END'
              : 'CONTINUE';
      return {
        pageId: pageId(page),
        position,
        inheritedHeaderBlockIds: index === 0 ? [] : [headerId],
        sourceBlockIds: [blockId],
      } as const;
    });
    return {
      tableId: table.id,
      documentId,
      titleHint: 'Synthetic structured table',
      pageIds: table.pages.map(pageId),
      headerBlockIds: [headerId],
      segments,
      approximateRowCount: table.rows,
      columnHeaderLabels: ['Item hint', 'Year hint', 'Channel hint', 'Condition hint'],
      entityHintIds: hintIdsByTable.get(table.id) ?? [],
      footnoteNoteIds: (spec.notes ?? [])
        .filter((note) => note.kind === 'FOOTNOTE' && note.tableIds?.includes(table.id))
        .map((note) => note.id),
      contextEdgeIds: [],
      sourceBlockIds,
    };
  });

  const notes = (spec.notes ?? []).map((note) => {
    const blockId = `block-${note.id.slice('note-'.length)}`;
    contentBlocks.push({
      contentBlockId: blockId,
      documentId,
      pageId: pageId(note.page),
      blockKind: 'NOTE_REGION',
      label: `Synthetic ${note.kind.toLowerCase()} location`,
    });
    for (const tableId of note.tableIds ?? [])
      contextEdges.push({
        contextEdgeId: `edge-${note.id.slice(5)}-table-${tableId.slice(6)}`,
        relation: note.kind === 'FOOTNOTE' ? 'FOOTNOTE_APPLIES_TO_TABLE' : 'NOTE_GOVERNS_TABLE',
        from: { refType: 'NOTE', refId: note.id },
        to: { refType: 'TABLE', refId: tableId },
        reason: 'A synthetic note supplies required structural context to the table.',
      });
    for (const sectionId of note.sectionIds ?? [])
      contextEdges.push({
        contextEdgeId: `edge-${note.id.slice(5)}-section-${sectionId.slice(8)}`,
        relation: note.kind === 'DOCUMENT_WIDE' ? 'NOTE_GOVERNS_DOCUMENT' : 'NOTE_GOVERNS_SECTION',
        from: { refType: 'NOTE', refId: note.id },
        to: { refType: 'SECTION', refId: sectionId },
        reason: 'A later synthetic note may govern the referenced structural section.',
      });
    return {
      noteId: note.id,
      documentId,
      pageId: pageId(note.page),
      noteKind: note.kind,
      relevantForExtraction: true,
      sectionIds: [...(note.sectionIds ?? [])],
      tableIds: [...(note.tableIds ?? [])],
      sourceBlockIds: [blockId],
    };
  });

  const sections = spec.sections.map((section) => ({
    sectionId: section.id,
    documentId,
    titleHint: `Synthetic ${section.role.toLowerCase()} section`,
    semanticRole: section.role,
    pageIds: section.pages.map(pageId),
    entityHintIds: hintIdsBySection.get(section.id) ?? [],
    sourceBlockIds: section.pages.map(bodyBlockId),
  }));

  const pages = Array.from({ length: spec.pageCount }, (_, index) => {
    const number = index + 1;
    const id = pageId(number);
    const pageBlocks = contentBlocks
      .filter((block) => block.pageId === id)
      .map((block) => block.contentBlockId);
    const pageEdges = contextEdges
      .filter((edge) => {
        const refs = [edge.from, edge.to];
        return refs.some(
          (ref) =>
            (ref.refType === 'PAGE' && ref.refId === id) ||
            (ref.refType === 'CONTENT_BLOCK' && pageBlocks.includes(ref.refId)),
        );
      })
      .map((edge) => edge.contextEdgeId);
    return {
      pageId: id,
      documentId,
      pageNumber: number,
      role: spec.pageRoles?.[number] ?? 'commercial_content',
      sectionIds: spec.sections
        .filter((section) => section.pages.includes(number))
        .map((section) => section.id),
      tableIds: spec.tables
        .filter((table) => table.pages.includes(number))
        .map((table) => table.id),
      noteIds: (spec.notes ?? []).filter((note) => note.page === number).map((note) => note.id),
      entityHintIds: [
        ...new Set(
          entityHints
            .filter((hint) => hint.sourceBlockIds.some((blockId) => pageBlocks.includes(blockId)))
            .map((hint) => hint.entityHintId),
        ),
      ],
      contextEdgeIds: pageEdges,
      contentBlockIds: pageBlocks,
    };
  });
  const tableResults = tables.map((table) => ({
    ...table,
    contextEdgeIds: contextEdges
      .filter(
        (edge) =>
          (edge.from.refType === 'TABLE' && edge.from.refId === table.tableId) ||
          (edge.to.refType === 'TABLE' && edge.to.refId === table.tableId) ||
          table.pageIds.some(
            (id) =>
              (edge.from.refType === 'PAGE' && edge.from.refId === id) ||
              (edge.to.refType === 'PAGE' && edge.to.refId === id),
          ),
      )
      .map((edge) => edge.contextEdgeId),
  }));
  return {
    schemaVersion: COMMERCIAL_DOCUMENT_MAP_SCHEMA_VERSION,
    documentCount: 1,
    pageCount: spec.pageCount,
    documents: [
      {
        documentId,
        ordinal: 1,
        pageCount: spec.pageCount,
        documentKindCandidate: 'commercial_letter',
        titleHints: [{ value: 'Synthetic commercial document', sourceBlockIds: [bodyBlockId(1)] }],
        issuerHints: [],
        competenceHints: [],
        validityHints: [],
      },
    ],
    pages,
    contentBlocks,
    sections,
    tables: tableResults,
    notes,
    entityHints,
    contextEdges,
  };
}

export const geelyLikeCommercialDocumentMapFixture = buildMap({
  id: 'geely-like',
  pageCount: 6,
  pageRoles: { 2: 'table_content', 4: 'table_content', 5: 'table_content', 6: 'general_rules' },
  sections: [
    {
      id: 'section-family-a',
      pages: [1, 2, 3],
      role: 'FAMILY',
      hints: [{ kind: 'FAMILY', value: 'Family Alpha' }],
    },
    {
      id: 'section-family-b',
      pages: [4, 5],
      role: 'FAMILY',
      hints: [{ kind: 'FAMILY', value: 'Family Beta' }],
    },
    { id: 'section-general-rules', pages: [6], role: 'GENERAL_RULES' },
  ],
  tables: [
    { id: 'table-family-a', pages: [2], rows: 2, sectionId: 'section-family-a' },
    { id: 'table-family-b', pages: [4, 5], rows: 2, sectionId: 'section-family-b' },
  ],
  notes: [
    {
      id: 'note-later-general-rule',
      page: 6,
      kind: 'GENERAL_RULE',
      sectionIds: ['section-family-a', 'section-family-b', 'section-general-rules'],
      tableIds: ['table-family-a', 'table-family-b'],
    },
  ],
});

export const gwmLikeCommercialDocumentMapFixture = buildMap({
  id: 'gwm-like',
  pageCount: 4,
  pageRoles: { 2: 'table_content', 3: 'table_content' },
  sections: [
    {
      id: 'section-main-table',
      pages: [1, 2, 3, 4],
      role: 'FAMILY',
      hints: [{ kind: 'FAMILY', value: 'Family Gamma' }],
    },
  ],
  tables: [{ id: 'table-main-13', pages: [2, 3], rows: 13, sectionId: 'section-main-table' }],
  notes: [{ id: 'note-main-footnote', page: 3, kind: 'FOOTNOTE', tableIds: ['table-main-13'] }],
});

const fiatFamilyHints = Array.from({ length: 12 }, (_, index) => ({
  kind: 'FAMILY' as const,
  value: `Family ${index + 1}`,
}));
export const fiatLikeCommercialDocumentMapFixture = buildMap({
  id: 'fiat-like',
  pageCount: 17,
  pageRoles: Object.fromEntries([
    ...Array.from({ length: 12 }, (_, index) => [index + 2, 'table_content']),
    [14, 'financing'],
    [15, 'financing'],
    [16, 'commercial_content'],
    [17, 'general_rules'],
  ]) as Readonly<Record<number, CommercialDocumentPageRole>>,
  sections: [
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `section-family-group-${index + 1}`,
      pages: [index * 2 + 2, index * 2 + 3],
      role: 'FAMILY' as const,
      hints: fiatFamilyHints.slice(index * 2, index * 2 + 2),
    })),
    { id: 'section-financing', pages: [14, 15], role: 'FINANCING' as const },
    {
      id: 'section-direct-channel',
      pages: [16],
      role: 'CHANNEL' as const,
      hints: [{ kind: 'CHANNEL' as const, value: 'Direct channel' }],
    },
    { id: 'section-floor-plan', pages: [17], role: 'GENERAL_RULES' as const },
  ],
  tables: Array.from({ length: 6 }, (_, index) => ({
    id: `table-family-group-${index + 1}`,
    pages: [index * 2 + 2, index * 2 + 3],
    rows: index === 5 ? 15 : 17,
    sectionId: `section-family-group-${index + 1}`,
    hints: fiatFamilyHints.slice(index * 2, index * 2 + 2),
  })),
  notes: [
    { id: 'note-financing', page: 15, kind: 'SECTION_WIDE', sectionIds: ['section-financing'] },
    {
      id: 'note-direct-channel',
      page: 16,
      kind: 'ELIGIBILITY',
      sectionIds: ['section-direct-channel'],
    },
    {
      id: 'note-floor-plan',
      page: 17,
      kind: 'DOCUMENT_WIDE',
      sectionIds: [
        ...Array.from({ length: 6 }, (_, index) => `section-family-group-${index + 1}`),
        'section-financing',
        'section-direct-channel',
        'section-floor-plan',
      ],
    },
  ],
});

export const volvoLikeCommercialDocumentMapFixture = buildMap({
  id: 'volvo-like',
  pageCount: 8,
  pageRoles: {
    2: 'table_content',
    3: 'table_content',
    5: 'table_content',
    6: 'table_content',
    7: 'eligibility',
  },
  sections: [
    {
      id: 'section-retail-channel',
      pages: [1, 2, 3, 4],
      role: 'CHANNEL',
      hints: [{ kind: 'CHANNEL', value: 'Retail channel' }],
    },
    {
      id: 'section-direct-channel',
      pages: [5, 6, 7],
      role: 'CHANNEL',
      hints: [{ kind: 'CHANNEL', value: 'Direct channel' }],
    },
    { id: 'section-shared-notes', pages: [8], role: 'GENERAL_RULES' },
  ],
  tables: [
    {
      id: 'table-retail',
      pages: [2, 3],
      rows: 10,
      sectionId: 'section-retail-channel',
      hints: [{ kind: 'CHANNEL', value: 'Retail channel' }],
    },
    {
      id: 'table-direct',
      pages: [5, 6],
      rows: 10,
      sectionId: 'section-direct-channel',
      hints: [{ kind: 'CHANNEL', value: 'Direct channel' }],
    },
  ],
  notes: [
    {
      id: 'note-direct-eligibility',
      page: 7,
      kind: 'ELIGIBILITY',
      sectionIds: ['section-direct-channel'],
      tableIds: ['table-direct'],
    },
    {
      id: 'note-shared',
      page: 8,
      kind: 'DOCUMENT_WIDE',
      sectionIds: ['section-retail-channel', 'section-direct-channel', 'section-shared-notes'],
    },
  ],
});

export const vwLikeCommercialDocumentMapFixture = buildMap({
  id: 'vw-like',
  pageCount: 48,
  pageRoles: Object.fromEntries(
    Array.from({ length: 36 }, (_, index) => [index + 2, 'table_content']),
  ) as Readonly<Record<number, CommercialDocumentPageRole>>,
  sections: [
    {
      id: 'section-dense-a',
      pages: Array.from({ length: 18 }, (_, index) => index + 2),
      role: 'FAMILY',
      hints: [{ kind: 'FAMILY', value: 'Dense family A' }],
    },
    {
      id: 'section-dense-b',
      pages: Array.from({ length: 18 }, (_, index) => index + 20),
      role: 'FAMILY',
      hints: [{ kind: 'FAMILY', value: 'Dense family B' }],
    },
    {
      id: 'section-unstructured-annex',
      pages: Array.from({ length: 5 }, (_, index) => index + 44),
      role: 'ANNEX',
    },
  ],
  tables: [
    {
      id: 'table-dense-a',
      pages: Array.from({ length: 18 }, (_, index) => index + 2),
      rows: 240,
      sectionId: 'section-dense-a',
    },
    {
      id: 'table-dense-b',
      pages: Array.from({ length: 18 }, (_, index) => index + 20),
      rows: 180,
      sectionId: 'section-dense-b',
    },
  ],
  notes: [
    {
      id: 'note-dense-shared',
      page: 48,
      kind: 'DOCUMENT_WIDE',
      sectionIds: ['section-dense-a', 'section-dense-b', 'section-unstructured-annex'],
    },
  ],
});
