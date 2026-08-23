import type {
  CommercialDocumentMapRef,
  CommercialDocumentMapRefType,
  CommercialDocumentMapV1,
} from './commercial-document-map';

export type CommercialDocumentMapCanonicalIdKind =
  'document' | 'page' | 'block' | 'section' | 'table' | 'note' | 'hint' | 'edge';

export type CommercialDocumentMapCanonicalizationFailureCategory =
  'duplicate_definition' | 'invalid_definition' | 'unknown_reference' | 'source_document_mismatch';

export interface CommercialDocumentMapCanonicalizationDiagnostic {
  readonly kind: CommercialDocumentMapCanonicalIdKind;
  readonly category: CommercialDocumentMapCanonicalizationFailureCategory;
  readonly path: string;
}

export class CommercialDocumentMapCanonicalizationError extends Error {
  readonly code = 'DOCUMENT_MAP_CANONICALIZATION_FAILED' as const;

  constructor(readonly diagnostics: readonly CommercialDocumentMapCanonicalizationDiagnostic[]) {
    super(`Document Map ID canonicalization failed (${diagnostics.length} violation(s)).`);
    this.name = 'CommercialDocumentMapCanonicalizationError';
  }
}

type IdMap = ReadonlyMap<string, string>;
type Maps = Readonly<Record<CommercialDocumentMapCanonicalIdKind, IdMap>>;

const canonicalOrdinal = (value: number): string => String(value).padStart(4, '0');

const makeOrdinalMap = (
  kind: CommercialDocumentMapCanonicalIdKind,
  definitions: readonly { readonly rawId: string; readonly path: string }[],
): Map<string, string> => {
  const result = new Map<string, string>();
  const duplicates: CommercialDocumentMapCanonicalizationDiagnostic[] = [];
  definitions.forEach((definition, index) => {
    if (typeof definition.rawId !== 'string' || definition.rawId.length === 0) {
      duplicates.push({ kind, category: 'invalid_definition', path: definition.path });
      return;
    }
    if (result.has(definition.rawId)) {
      duplicates.push({ kind, category: 'duplicate_definition', path: definition.path });
      return;
    }
    result.set(definition.rawId, `${kind}-${canonicalOrdinal(index + 1)}`);
  });
  if (duplicates.length) throw new CommercialDocumentMapCanonicalizationError(duplicates);
  return result;
};

const makeDocumentMap = (
  value: CommercialDocumentMapV1,
  sourceDocumentOrdinals: readonly number[],
): Map<string, string> => {
  const sourceOrdinals = new Set(sourceDocumentOrdinals);
  const mappedOrdinals = new Set<number>();
  const diagnostics: CommercialDocumentMapCanonicalizationDiagnostic[] = [];
  const result = new Map<string, string>();
  value.documents.forEach((document, index) => {
    const path = `/documents/${index}/documentId`;
    if (typeof document.documentId !== 'string' || document.documentId.length === 0) {
      diagnostics.push({ kind: 'document', category: 'invalid_definition', path });
      return;
    }
    if (result.has(document.documentId)) {
      diagnostics.push({ kind: 'document', category: 'duplicate_definition', path });
      return;
    }
    if (!sourceOrdinals.has(document.ordinal) || mappedOrdinals.has(document.ordinal)) {
      diagnostics.push({
        kind: 'document',
        category: 'source_document_mismatch',
        path: `/documents/${index}/ordinal`,
      });
      return;
    }
    mappedOrdinals.add(document.ordinal);
    result.set(document.documentId, `document-${canonicalOrdinal(document.ordinal)}`);
  });
  if (
    sourceOrdinals.size !== sourceDocumentOrdinals.length ||
    value.documents.length !== sourceDocumentOrdinals.length ||
    mappedOrdinals.size !== sourceOrdinals.size
  )
    diagnostics.push({
      kind: 'document',
      category: 'source_document_mismatch',
      path: '/documents',
    });
  if (diagnostics.length) throw new CommercialDocumentMapCanonicalizationError(diagnostics);
  return result;
};

const mapped = (
  maps: Maps,
  kind: CommercialDocumentMapCanonicalIdKind,
  value: string,
  path: string,
): string => {
  const result = maps[kind].get(value);
  if (result) return result;
  throw new CommercialDocumentMapCanonicalizationError([
    { kind, category: 'unknown_reference', path },
  ]);
};

const mappedList = (
  maps: Maps,
  kind: CommercialDocumentMapCanonicalIdKind,
  values: readonly string[],
  path: string,
): string[] => values.map((value, index) => mapped(maps, kind, value, `${path}/${index}`));

const refKind: Readonly<
  Record<CommercialDocumentMapRefType, CommercialDocumentMapCanonicalIdKind>
> = {
  PAGE: 'page',
  CONTENT_BLOCK: 'block',
  SECTION: 'section',
  TABLE: 'table',
  NOTE: 'note',
};

const mappedRef = (maps: Maps, ref: CommercialDocumentMapRef, path: string) => ({
  ...ref,
  refId: mapped(maps, refKind[ref.refType], ref.refId, `${path}/refId`),
});

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const normalizePageSectionMembership = (
  value: CommercialDocumentMapV1,
): CommercialDocumentMapV1 => {
  const pageSections = new Map(value.pages.map((page) => [page.pageId, new Set(page.sectionIds)]));
  const sectionPages = new Map(
    value.sections.map((section) => [section.sectionId, new Set(section.pageIds)]),
  );
  for (const page of value.pages)
    for (const sectionId of page.sectionIds) sectionPages.get(sectionId)?.add(page.pageId);
  for (const section of value.sections)
    for (const pageId of section.pageIds) pageSections.get(pageId)?.add(section.sectionId);

  const sectionOrder = new Map(value.sections.map((section, index) => [section.sectionId, index]));
  const documentOrder = new Map(
    value.documents.map((document) => [document.documentId, document.ordinal]),
  );
  const pages = new Map(value.pages.map((page, index) => [page.pageId, { page, index }]));
  const comparePages = (leftId: string, rightId: string): number => {
    const left = pages.get(leftId)!;
    const right = pages.get(rightId)!;
    return (
      (documentOrder.get(left.page.documentId) ?? 0) -
        (documentOrder.get(right.page.documentId) ?? 0) ||
      left.page.pageNumber - right.page.pageNumber ||
      left.index - right.index ||
      compareText(leftId, rightId)
    );
  };

  return {
    ...value,
    pages: value.pages.map((page) => ({
      ...page,
      sectionIds: [...pageSections.get(page.pageId)!].sort(
        (left, right) =>
          (sectionOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (sectionOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || compareText(left, right),
      ),
    })),
    sections: value.sections.map((section) => ({
      ...section,
      pageIds: [...sectionPages.get(section.sectionId)!].sort(comparePages),
    })),
  };
};

export function canonicalizeCommercialDocumentMapIds(
  value: CommercialDocumentMapV1,
  options: { readonly sourceDocumentOrdinals?: readonly number[] } = {},
): CommercialDocumentMapV1 {
  const maps: Maps = {
    document: makeDocumentMap(
      value,
      options.sourceDocumentOrdinals ?? value.documents.map((document) => document.ordinal),
    ),
    page: makeOrdinalMap(
      'page',
      value.pages.map((page, index) => ({ rawId: page.pageId, path: `/pages/${index}/pageId` })),
    ),
    block: makeOrdinalMap(
      'block',
      value.contentBlocks.map((block, index) => ({
        rawId: block.contentBlockId,
        path: `/contentBlocks/${index}/contentBlockId`,
      })),
    ),
    section: makeOrdinalMap(
      'section',
      value.sections.map((section, index) => ({
        rawId: section.sectionId,
        path: `/sections/${index}/sectionId`,
      })),
    ),
    table: makeOrdinalMap(
      'table',
      value.tables.map((table, index) => ({
        rawId: table.tableId,
        path: `/tables/${index}/tableId`,
      })),
    ),
    note: makeOrdinalMap(
      'note',
      value.notes.map((note, index) => ({ rawId: note.noteId, path: `/notes/${index}/noteId` })),
    ),
    hint: makeOrdinalMap(
      'hint',
      value.entityHints.map((hint, index) => ({
        rawId: hint.entityHintId,
        path: `/entityHints/${index}/entityHintId`,
      })),
    ),
    edge: makeOrdinalMap(
      'edge',
      value.contextEdges.map((edge, index) => ({
        rawId: edge.contextEdgeId,
        path: `/contextEdges/${index}/contextEdgeId`,
      })),
    ),
  };

  const metadataHints = (
    hints: CommercialDocumentMapV1['documents'][number]['titleHints'],
    path: string,
  ) =>
    hints.map((hint, index) => ({
      ...hint,
      sourceBlockIds: mappedList(
        maps,
        'block',
        hint.sourceBlockIds,
        `${path}/${index}/sourceBlockIds`,
      ),
    }));

  const canonical: CommercialDocumentMapV1 = {
    ...structuredClone(value),
    documents: value.documents.map((document, index) => ({
      ...document,
      documentId: mapped(maps, 'document', document.documentId, `/documents/${index}/documentId`),
      titleHints: metadataHints(document.titleHints, `/documents/${index}/titleHints`),
      issuerHints: metadataHints(document.issuerHints, `/documents/${index}/issuerHints`),
      competenceHints: metadataHints(
        document.competenceHints,
        `/documents/${index}/competenceHints`,
      ),
      validityHints: metadataHints(document.validityHints, `/documents/${index}/validityHints`),
    })),
    pages: value.pages.map((page, index) => {
      const path = `/pages/${index}`;
      return {
        ...page,
        pageId: mapped(maps, 'page', page.pageId, `${path}/pageId`),
        documentId: mapped(maps, 'document', page.documentId, `${path}/documentId`),
        sectionIds: mappedList(maps, 'section', page.sectionIds, `${path}/sectionIds`),
        tableIds: mappedList(maps, 'table', page.tableIds, `${path}/tableIds`),
        noteIds: mappedList(maps, 'note', page.noteIds, `${path}/noteIds`),
        entityHintIds: mappedList(maps, 'hint', page.entityHintIds, `${path}/entityHintIds`),
        contextEdgeIds: mappedList(maps, 'edge', page.contextEdgeIds, `${path}/contextEdgeIds`),
        contentBlockIds: mappedList(maps, 'block', page.contentBlockIds, `${path}/contentBlockIds`),
      };
    }),
    contentBlocks: value.contentBlocks.map((block, index) => {
      const path = `/contentBlocks/${index}`;
      return {
        ...block,
        contentBlockId: mapped(maps, 'block', block.contentBlockId, `${path}/contentBlockId`),
        documentId: mapped(maps, 'document', block.documentId, `${path}/documentId`),
        pageId: mapped(maps, 'page', block.pageId, `${path}/pageId`),
      };
    }),
    sections: value.sections.map((section, index) => {
      const path = `/sections/${index}`;
      return {
        ...section,
        sectionId: mapped(maps, 'section', section.sectionId, `${path}/sectionId`),
        documentId: mapped(maps, 'document', section.documentId, `${path}/documentId`),
        pageIds: mappedList(maps, 'page', section.pageIds, `${path}/pageIds`),
        ...(section.parentSectionId
          ? {
              parentSectionId: mapped(
                maps,
                'section',
                section.parentSectionId,
                `${path}/parentSectionId`,
              ),
            }
          : {}),
        entityHintIds: mappedList(maps, 'hint', section.entityHintIds, `${path}/entityHintIds`),
        sourceBlockIds: mappedList(maps, 'block', section.sourceBlockIds, `${path}/sourceBlockIds`),
      };
    }),
    tables: value.tables.map((table, index) => {
      const path = `/tables/${index}`;
      return {
        ...table,
        tableId: mapped(maps, 'table', table.tableId, `${path}/tableId`),
        documentId: mapped(maps, 'document', table.documentId, `${path}/documentId`),
        pageIds: mappedList(maps, 'page', table.pageIds, `${path}/pageIds`),
        headerBlockIds: mappedList(maps, 'block', table.headerBlockIds, `${path}/headerBlockIds`),
        segments: table.segments.map((segment, segmentIndex) => {
          const segmentPath = `${path}/segments/${segmentIndex}`;
          return {
            ...segment,
            pageId: mapped(maps, 'page', segment.pageId, `${segmentPath}/pageId`),
            inheritedHeaderBlockIds: mappedList(
              maps,
              'block',
              segment.inheritedHeaderBlockIds,
              `${segmentPath}/inheritedHeaderBlockIds`,
            ),
            sourceBlockIds: mappedList(
              maps,
              'block',
              segment.sourceBlockIds,
              `${segmentPath}/sourceBlockIds`,
            ),
          };
        }),
        entityHintIds: mappedList(maps, 'hint', table.entityHintIds, `${path}/entityHintIds`),
        footnoteNoteIds: mappedList(maps, 'note', table.footnoteNoteIds, `${path}/footnoteNoteIds`),
        contextEdgeIds: mappedList(maps, 'edge', table.contextEdgeIds, `${path}/contextEdgeIds`),
        sourceBlockIds: mappedList(maps, 'block', table.sourceBlockIds, `${path}/sourceBlockIds`),
      };
    }),
    notes: value.notes.map((note, index) => {
      const path = `/notes/${index}`;
      return {
        ...note,
        noteId: mapped(maps, 'note', note.noteId, `${path}/noteId`),
        documentId: mapped(maps, 'document', note.documentId, `${path}/documentId`),
        pageId: mapped(maps, 'page', note.pageId, `${path}/pageId`),
        sectionIds: mappedList(maps, 'section', note.sectionIds, `${path}/sectionIds`),
        tableIds: mappedList(maps, 'table', note.tableIds, `${path}/tableIds`),
        sourceBlockIds: mappedList(maps, 'block', note.sourceBlockIds, `${path}/sourceBlockIds`),
      };
    }),
    entityHints: value.entityHints.map((hint, index) => {
      const path = `/entityHints/${index}`;
      return {
        ...hint,
        entityHintId: mapped(maps, 'hint', hint.entityHintId, `${path}/entityHintId`),
        documentId: mapped(maps, 'document', hint.documentId, `${path}/documentId`),
        sourceBlockIds: mappedList(maps, 'block', hint.sourceBlockIds, `${path}/sourceBlockIds`),
      };
    }),
    contextEdges: value.contextEdges.map((edge, index) => {
      const path = `/contextEdges/${index}`;
      return {
        ...edge,
        contextEdgeId: mapped(maps, 'edge', edge.contextEdgeId, `${path}/contextEdgeId`),
        from: mappedRef(maps, edge.from, `${path}/from`),
        to: mappedRef(maps, edge.to, `${path}/to`),
      };
    }),
  };
  return normalizePageSectionMembership(canonical);
}
