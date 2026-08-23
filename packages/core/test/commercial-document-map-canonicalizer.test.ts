import { describe, expect, it } from 'vitest';
import type { CommercialDocumentMapV1 } from '../src/import/commercial-document-map';
import {
  canonicalizeCommercialDocumentMapIds,
  CommercialDocumentMapCanonicalizationError,
} from '../src/import/commercial-document-map-canonicalizer';
import {
  CommercialDocumentMapValidationError,
  validateCommercialDocumentMap,
} from '../src/import/commercial-document-map-validator';
import { sanitizeProcessingError } from '../src/services/import-processing';
import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
  vwLikeCommercialDocumentMapFixture,
} from './fixtures/import/commercial-document-map-fixtures';

const replaceStrings = (value: unknown, replacements: ReadonlyMap<string, string>): unknown => {
  if (typeof value === 'string') return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, replacements));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceStrings(item, replacements)]),
  );
};

const transportLikeMap = (
  value: CommercialDocumentMapV1 = geelyLikeCommercialDocumentMapFixture,
  customize?: (replacements: Map<string, string>) => void,
): CommercialDocumentMapV1 => {
  const replacements = new Map<string, string>();
  value.documents.forEach((item, index) => replacements.set(item.documentId, `doc ${index + 1}`));
  value.pages.forEach((item, index) => replacements.set(item.pageId, `Page ${index + 1}`));
  value.contentBlocks.forEach((item, index) =>
    replacements.set(item.contentBlockId, `block_${index + 1}`),
  );
  value.sections.forEach((item, index) => replacements.set(item.sectionId, `section:${index + 1}`));
  value.tables.forEach((item, index) => replacements.set(item.tableId, `table-X${index + 1}`));
  value.notes.forEach((item, index) => replacements.set(item.noteId, `note ${index + 1}`));
  value.entityHints.forEach((item, index) =>
    replacements.set(item.entityHintId, `hint#${index + 1}`),
  );
  value.contextEdges.forEach((item, index) =>
    replacements.set(item.contextEdgeId, `edge/${index + 1}`),
  );
  customize?.(replacements);
  return replaceStrings(value, replacements) as CommercialDocumentMapV1;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const fixtures = [
  ['Geely-like', geelyLikeCommercialDocumentMapFixture],
  ['GWM-like multipage', gwmLikeCommercialDocumentMapFixture],
  ['Fiat-like', fiatLikeCommercialDocumentMapFixture],
  ['VW-like partitioned', vwLikeCommercialDocumentMapFixture],
] as const;

describe('CommercialDocumentMap ID canonicalization', () => {
  it('eliminates transport-like pattern failures and preserves every reference invariant', () => {
    const raw = transportLikeMap(fiatLikeCommercialDocumentMapFixture);
    try {
      validateCommercialDocumentMap(raw);
      throw new Error('Expected raw transport IDs to fail canonical validation.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentMapValidationError);
      expect(error).toMatchObject({ categoryCounts: { schema: expect.any(Number) } });
      expect(
        (error as CommercialDocumentMapValidationError).keywordCounts.pattern,
      ).toBeGreaterThanOrEqual(358);
    }

    const canonical = canonicalizeCommercialDocumentMapIds(raw, {
      sourceDocumentOrdinals: [1],
    });
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
    expect(canonical.documents[0]?.documentId).toBe('document-0001');
    expect(canonical.pages[0]?.pageId).toBe('page-0001');
    expect(canonical.contentBlocks[0]?.contentBlockId).toBe('block-0001');
    expect(canonical.sections[0]?.sectionId).toBe('section-0001');
    expect(canonical.tables[0]?.tableId).toBe('table-0001');
    expect(canonical.notes[0]?.noteId).toBe('note-0001');
    expect(canonical.entityHints[0]?.entityHintId).toBe('hint-0001');
    expect(canonical.contextEdges[0]?.contextEdgeId).toBe('edge-0001');
  });

  it('rejects duplicate raw definitions of the same kind without exposing the raw ID', () => {
    const raw = transportLikeMap();
    const duplicate = structuredClone(raw);
    (duplicate.pages[1] as { pageId: string }).pageId = duplicate.pages[0]!.pageId;
    try {
      canonicalizeCommercialDocumentMapIds(duplicate);
      throw new Error('Expected duplicate canonicalization failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(CommercialDocumentMapCanonicalizationError);
      expect(error).toMatchObject({
        code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
        diagnostics: [{ kind: 'page', category: 'duplicate_definition', path: '/pages/1/pageId' }],
      });
      expect(JSON.stringify(error)).not.toContain(duplicate.pages[0]!.pageId);
      expect(sanitizeProcessingError(error)).toEqual({
        code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
        message: 'O pipeline segmentado falhou. Consulte o correlation ID.',
      });
    }
  });

  it('allows the same raw ID across kinds because references carry an explicit kind', () => {
    const pageId = geelyLikeCommercialDocumentMapFixture.pages[0]!.pageId;
    const blockId = geelyLikeCommercialDocumentMapFixture.contentBlocks[0]!.contentBlockId;
    const raw = transportLikeMap(geelyLikeCommercialDocumentMapFixture, (replacements) => {
      replacements.set(pageId, 'id1');
      replacements.set(blockId, 'id1');
    });
    const canonical = canonicalizeCommercialDocumentMapIds(raw);
    expect(canonical.pages[0]?.pageId).toBe('page-0001');
    expect(canonical.contentBlocks[0]?.contentBlockId).toBe('block-0001');
    expect(canonical.documents[0]?.titleHints[0]?.sourceBlockIds).toEqual(['block-0001']);
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
  });

  it('does not fabricate a missing definition or an unknown reference', () => {
    const missing = structuredClone(transportLikeMap());
    (missing.pages[0] as unknown as { pageId?: string }).pageId = undefined;
    expect(() => canonicalizeCommercialDocumentMapIds(missing)).toThrowError(
      expect.objectContaining({
        code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
        diagnostics: [expect.objectContaining({ category: 'invalid_definition' })],
      }),
    );

    const dangling = structuredClone(transportLikeMap());
    (dangling.pages[0] as unknown as { sectionIds: string[] }).sectionIds = ['section missing'];
    expect(() => canonicalizeCommercialDocumentMapIds(dangling)).toThrowError(
      expect.objectContaining({
        code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
        diagnostics: [
          {
            kind: 'section',
            category: 'unknown_reference',
            path: '/pages/0/sectionIds/0',
          },
        ],
      }),
    );
  });

  it.each(['titleHints', 'issuerHints', 'competenceHints', 'validityHints'] as const)(
    'rejects a dangling block ref from document.%s with an exact safe path',
    (hintKind) => {
      const input = structuredClone(transportLikeMap());
      (input.documents[0] as unknown as Record<typeof hintKind, unknown>)[hintKind] = [
        { value: 'not returned by diagnostics', sourceBlockIds: ['block missing'] },
      ];

      expect(() => canonicalizeCommercialDocumentMapIds(input)).toThrowError(
        expect.objectContaining({
          code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
          diagnostics: [
            {
              kind: 'block',
              category: 'unknown_reference',
              path: `/documents/0/${hintKind}/0/sourceBlockIds/0`,
            },
          ],
        }),
      );
    },
  );

  it('allows metadata hints to be absent as empty collections', () => {
    const input = structuredClone(transportLikeMap());
    const document = input.documents[0] as unknown as {
      titleHints: unknown[];
      issuerHints: unknown[];
      competenceHints: unknown[];
      validityHints: unknown[];
    };
    document.titleHints = [];
    document.issuerHints = [];
    document.competenceHints = [];
    document.validityHints = [];

    const canonical = canonicalizeCommercialDocumentMapIds(input);

    expect(canonical.documents[0]).toMatchObject({
      titleHints: [],
      issuerHints: [],
      competenceHints: [],
      validityHints: [],
    });
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
  });

  it('resolves a metadata block definition indexed after the document hint', () => {
    const input = structuredClone(transportLikeMap());
    const document = input.documents[0]!;
    const page = input.pages[0]!;
    const rawBlockId = 'late block definition';
    (document.titleHints[0] as unknown as { sourceBlockIds: string[] }).sourceBlockIds = [
      rawBlockId,
    ];
    (page as unknown as { contentBlockIds: string[] }).contentBlockIds.push(rawBlockId);
    (input.contentBlocks as unknown as Array<(typeof input.contentBlocks)[number]>).push({
      contentBlockId: rawBlockId,
      documentId: document.documentId,
      pageId: page.pageId,
      blockKind: 'HEADING',
    });

    const canonical = canonicalizeCommercialDocumentMapIds(input);

    expect(canonical.documents[0]?.titleHints[0]?.sourceBlockIds).toEqual([
      canonical.contentBlocks.at(-1)?.contentBlockId,
    ]);
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
  });

  it('closes a section-to-page back-reference omitted from the page projection', () => {
    const input = structuredClone(geelyLikeCommercialDocumentMapFixture);
    const section = input.sections[0]!;
    const pageId = section.pageIds[0]!;
    const page = input.pages.find((item) => item.pageId === pageId)!;
    (page as unknown as { sectionIds: string[] }).sectionIds = page.sectionIds.filter(
      (sectionId) => sectionId !== section.sectionId,
    );

    expect(() => validateCommercialDocumentMap(input)).toThrowError(
      expect.objectContaining({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            path: '/sections/0/pageIds',
            keyword: 'missingPageBackReference',
            category: 'referential',
          }),
        ]),
      }),
    );

    const canonical = canonicalizeCommercialDocumentMapIds(input);

    expect(canonical.pages.find((item) => item.pageId === 'page-0001')?.sectionIds).toContain(
      'section-0001',
    );
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
  });

  it('unifies a page-to-section membership omitted from the section projection', () => {
    const input = structuredClone(geelyLikeCommercialDocumentMapFixture);
    const section = input.sections[0]!;
    const pageId = section.pageIds[0]!;
    (section as unknown as { pageIds: string[] }).pageIds = section.pageIds.filter(
      (id) => id !== pageId,
    );

    const canonical = canonicalizeCommercialDocumentMapIds(input);

    expect(canonical.sections[0]?.pageIds).toContain('page-0001');
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
  });

  it('deduplicates page-section membership without mutating frozen input and is idempotent', () => {
    const input = structuredClone(geelyLikeCommercialDocumentMapFixture);
    const section = input.sections[0]!;
    const pageId = section.pageIds[0]!;
    const page = input.pages.find((item) => item.pageId === pageId)!;
    (section as unknown as { pageIds: string[] }).pageIds = [pageId, pageId];
    (page as unknown as { sectionIds: string[] }).sectionIds = [
      section.sectionId,
      section.sectionId,
    ];
    const frozen = deepFreeze(input);
    const before = JSON.stringify(frozen);

    const first = canonicalizeCommercialDocumentMapIds(frozen);
    const repeated = canonicalizeCommercialDocumentMapIds(frozen);
    const idempotent = canonicalizeCommercialDocumentMapIds(first);

    expect(first.sections[0]?.pageIds).toEqual(['page-0001', 'page-0002', 'page-0003']);
    expect(new Set(first.sections[0]!.pageIds).size).toBe(first.sections[0]!.pageIds.length);
    expect(first.pages[0]?.sectionIds).toEqual(['section-0001']);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(first));
    expect(idempotent).toEqual(first);
    expect(() => validateCommercialDocumentMap(first)).not.toThrow();
  });

  it('keeps dangling page references invalid instead of closing a fabricated membership', () => {
    const input = structuredClone(transportLikeMap());
    (input.sections[0] as unknown as { pageIds: string[] }).pageIds = ['page missing'];

    expect(() => canonicalizeCommercialDocumentMapIds(input)).toThrowError(
      expect.objectContaining({
        code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
        diagnostics: [
          {
            kind: 'page',
            category: 'unknown_reference',
            path: '/sections/0/pageIds/0',
          },
        ],
      }),
    );
  });

  it('is pure and byte-deterministic for a deeply frozen transport payload', () => {
    const raw = deepFreeze(transportLikeMap(fiatLikeCommercialDocumentMapFixture));
    const before = JSON.stringify(raw);
    const first = canonicalizeCommercialDocumentMapIds(raw);
    const second = canonicalizeCommercialDocumentMapIds(raw);
    expect(JSON.stringify(raw)).toBe(before);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(second).toEqual(first);
  });

  it.each(fixtures)('is idempotent and canonically valid for the %s fixture', (_name, fixture) => {
    const first = canonicalizeCommercialDocumentMapIds(fixture);
    const second = canonicalizeCommercialDocumentMapIds(first);
    expect(second).toEqual(first);
    expect(() => validateCommercialDocumentMap(second)).not.toThrow();
  });

  it('binds document IDs to the server-owned source ordinal', () => {
    const raw = transportLikeMap();
    expect(() =>
      canonicalizeCommercialDocumentMapIds(raw, { sourceDocumentOrdinals: [2] }),
    ).toThrowError(
      expect.objectContaining({
        code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ category: 'source_document_mismatch' }),
        ]),
      }),
    );
  });
});
