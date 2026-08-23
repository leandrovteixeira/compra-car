import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { commercialDocumentMapSchemaV1 } from '@compra-car/core/commercial-document-map-schema';
import { validateCommercialDocumentMap } from '@compra-car/core/commercial-document-map-validator';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import { validateCommercialDocumentExtraction } from '@compra-car/core/commercial-document-extraction-validator';
import { canonicalizeCommercialDocumentExtractionUnit } from '@compra-car/core/commercial-document-extraction-canonicalizer';
import { canonicalizeCommercialDocumentMapIds } from '@compra-car/core/commercial-document-map-canonicalizer';

import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
  vwLikeCommercialDocumentMapFixture,
} from '../../../packages/core/test/fixtures/import/commercial-document-map-fixtures';
import {
  geelyLikeCommercialDocumentExtractionFixture,
  gwmLikeCommercialDocumentExtractionFixture,
} from '../../../packages/core/test/fixtures/import/commercial-document-extraction-fixtures';
import {
  openAITransportDocumentExtractionSchema,
  openAITransportDocumentMapSchema,
  validateDocumentMapTransportSchema,
  validateExtractionTransportSchema,
} from '../src/server/segmented-import-runtime';
import {
  createOpenAIStructuredOutputProjection,
  projectCanonicalValueForOpenAITransport,
  reconstructCanonicalValueFromOpenAITransport,
} from '../src/server/openai-structured-output-schema';

type JsonObject = Record<string, unknown>;

const forbiddenKeywords = new Set([
  '$id',
  '$schema',
  'allOf',
  'contains',
  'else',
  'if',
  'maxLength',
  'minLength',
  'minProperties',
  'not',
  'oneOf',
  'patternProperties',
  'propertyNames',
  'then',
  'unevaluatedProperties',
  'uniqueItems',
]);

function scanForbiddenSchemaKeywords(value: unknown, path = '$'): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const schema = value as JsonObject;
  const paths = Object.keys(schema)
    .filter((key) => forbiddenKeywords.has(key) || key.startsWith('dependent'))
    .map((key) => `${path}.${key}`);
  const properties = schema.properties as JsonObject | undefined;
  for (const [name, property] of Object.entries(properties ?? {}))
    paths.push(...scanForbiddenSchemaKeywords(property, `${path}.properties.${name}`));
  const definitions = schema.$defs as JsonObject | undefined;
  for (const [name, definition] of Object.entries(definitions ?? {}))
    paths.push(...scanForbiddenSchemaKeywords(definition, `${path}.$defs.${name}`));
  if (schema.items) paths.push(...scanForbiddenSchemaKeywords(schema.items, `${path}.items`));
  for (const keyword of ['anyOf', 'allOf', 'oneOf'] as const)
    if (Array.isArray(schema[keyword]))
      schema[keyword].forEach((branch, index) =>
        paths.push(...scanForbiddenSchemaKeywords(branch, `${path}.${keyword}[${index}]`)),
      );
  for (const keyword of ['not', 'if', 'then', 'else'] as const)
    if (schema[keyword])
      paths.push(...scanForbiddenSchemaKeywords(schema[keyword], `${path}.${keyword}`));
  return paths.sort();
}

function scanSchemaPatterns(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(scanSchemaPatterns);
  const schema = value as JsonObject;
  return [
    ...(typeof schema.pattern === 'string' ? [schema.pattern] : []),
    ...Object.values(schema).flatMap(scanSchemaPatterns),
  ];
}

function assertStrictObjects(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach(assertStrictObjects);
    return;
  }
  const schema = value as JsonObject;
  if (schema.type === 'object' && schema.properties) {
    expect(schema.additionalProperties).toBe(false);
    expect(new Set(schema.required as string[])).toEqual(
      new Set(Object.keys(schema.properties as JsonObject)),
    );
  }
  Object.values(schema).forEach(assertStrictObjects);
}

function resolveLocalSchema(schema: JsonObject, root: JsonObject): JsonObject {
  if (typeof schema.$ref !== 'string') return schema;
  const definition = /^#\/\$defs\/([^/]+)$/u.exec(schema.$ref)?.[1];
  if (!definition) throw new Error(`Unsupported test schema ref: ${schema.$ref}`);
  return (root.$defs as JsonObject)[definition] as JsonObject;
}

function requiredArrayProperties(
  value: JsonObject,
  root = value,
  path = '$',
): Array<{ path: string; minItems: number }> {
  const schema = resolveLocalSchema(value, root);
  if (schema.type === 'array')
    return schema.items
      ? requiredArrayProperties(schema.items as JsonObject, root, `${path}[]`)
      : [];
  if (schema.type !== 'object' || !schema.properties) return [];
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  return Object.entries(schema.properties as JsonObject).flatMap(([name, property]) => {
    const propertySchema = resolveLocalSchema(property as JsonObject, root);
    const propertyPath = `${path}.${name}`;
    return [
      ...(required.has(name) && propertySchema.type === 'array'
        ? [
            {
              path: propertyPath,
              minItems: typeof propertySchema.minItems === 'number' ? propertySchema.minItems : 0,
            },
          ]
        : []),
      ...requiredArrayProperties(property as JsonObject, root, propertyPath),
    ];
  });
}

describe('segmented OpenAI structured schema projection', () => {
  it.each([
    ['Document Map', commercialDocumentMapSchemaV1, openAITransportDocumentMapSchema],
    [
      'Unit Extraction',
      commercialDocumentExtractionSchemaV1,
      openAITransportDocumentExtractionSchema,
    ],
  ] as const)(
    '%s uses a deterministic transport projection without mutating canonical schema',
    (_name, canonical, transport) => {
      const canonicalBefore = JSON.stringify(canonical);
      expect(
        scanForbiddenSchemaKeywords(canonical).some((path) => path.endsWith('.uniqueItems')),
      ).toBe(true);
      expect(scanForbiddenSchemaKeywords(transport)).toEqual([]);
      expect(JSON.stringify(createOpenAIStructuredOutputProjection(canonical))).toBe(
        JSON.stringify(transport),
      );
      expect(JSON.stringify(canonical)).toBe(canonicalBefore);
      assertStrictObjects(transport);
    },
  );

  it('removes the exact rejected Document Map sourceBlockIds uniqueItems keyword', () => {
    expect(
      scanForbiddenSchemaKeywords(commercialDocumentMapSchemaV1).some((path) =>
        /properties\.sourceBlockIds\.uniqueItems$/u.test(path),
      ),
    ).toBe(true);
    expect(JSON.stringify(openAITransportDocumentMapSchema)).not.toContain('"uniqueItems"');
  });

  it('removes every canonical local-ID pattern from both transport schemas', () => {
    const canonicalMapPatterns = scanSchemaPatterns(commercialDocumentMapSchemaV1);
    const transportMapPatterns = scanSchemaPatterns(openAITransportDocumentMapSchema);
    const canonicalExtractionPatterns = scanSchemaPatterns(commercialDocumentExtractionSchemaV1);
    const transportExtractionPatterns = scanSchemaPatterns(openAITransportDocumentExtractionSchema);
    const isLocalIdPattern = (pattern: string): boolean =>
      pattern.includes('-[a-z0-9][a-z0-9._-]{0,');

    expect(canonicalMapPatterns.filter(isLocalIdPattern).length).toBeGreaterThan(0);
    expect(transportMapPatterns).toEqual([]);
    expect(canonicalExtractionPatterns.filter(isLocalIdPattern).length).toBeGreaterThan(0);
    expect(transportExtractionPatterns.filter(isLocalIdPattern)).toEqual([]);
  });

  it('uses each provider transport schema object as the AJV validator source of truth', () => {
    expect(validateDocumentMapTransportSchema.schema).toBe(openAITransportDocumentMapSchema);
    expect(validateExtractionTransportSchema.schema).toBe(openAITransportDocumentExtractionSchema);
  });

  it('shows why an empty table cell passes wire validation but fails the canonical boundary', () => {
    const canonicalCell = (commercialDocumentExtractionSchemaV1.$defs as JsonObject)
      .tableCell as JsonObject;
    const transportCell = (openAITransportDocumentExtractionSchema.$defs as JsonObject)
      .tableCell as JsonObject;
    expect((canonicalCell.properties as JsonObject).text).toEqual({
      type: 'string',
      minLength: 1,
      maxLength: 2_000,
    });
    expect((transportCell.properties as JsonObject).text).toEqual({ type: 'string' });

    const artifact = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    (artifact.tables[0]!.rows[0]!.cells[0] as { text: string }).text = '';
    const transport = projectCanonicalValueForOpenAITransport(
      artifact,
      commercialDocumentExtractionSchemaV1,
    );
    expect(validateExtractionTransportSchema(transport)).toBe(true);
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      transport,
      commercialDocumentExtractionSchemaV1,
    );
    expect(() => validateCommercialDocumentExtraction(reconstructed)).toThrowError(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            path: '/tables/0/rows/0/cells/0/text',
            keyword: 'minLength',
          }),
        ],
      }),
    );
  });

  it('inventories every required Document Map collection that legitimately permits []', () => {
    const emptyRequiredCollections = requiredArrayProperties(
      openAITransportDocumentMapSchema as JsonObject,
    )
      .filter(({ minItems }) => minItems === 0)
      .map(({ path }) => path)
      .sort();

    expect(emptyRequiredCollections).toEqual(
      [
        '$.contextEdges',
        '$.documents[].competenceHints',
        '$.documents[].issuerHints',
        '$.documents[].titleHints',
        '$.documents[].validityHints',
        '$.entityHints',
        '$.notes',
        '$.notes[].sectionIds',
        '$.notes[].tableIds',
        '$.pages[].contextEdgeIds',
        '$.pages[].entityHintIds',
        '$.pages[].noteIds',
        '$.pages[].sectionIds',
        '$.pages[].tableIds',
        '$.sections',
        '$.sections[].entityHintIds',
        '$.tables',
        '$.tables[].columnHeaderLabels',
        '$.tables[].contextEdgeIds',
        '$.tables[].entityHintIds',
        '$.tables[].footnoteNoteIds',
        '$.tables[].segments[].inheritedHeaderBlockIds',
      ].sort(),
    );
  });

  it('preserves the issuerHints empty, required and provenance boundaries', () => {
    const empty = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentMapFixture,
      commercialDocumentMapSchemaV1,
    ) as typeof geelyLikeCommercialDocumentMapFixture;
    expect(empty.documents[0]!.issuerHints).toEqual([]);
    expect(validateDocumentMapTransportSchema(empty)).toBe(true);

    const missing = structuredClone(empty);
    delete (missing.documents[0] as unknown as { issuerHints?: unknown }).issuerHints;
    expect(validateDocumentMapTransportSchema(missing)).toBe(false);
    expect(validateDocumentMapTransportSchema.errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/documents/0',
        keyword: 'required',
        params: { missingProperty: 'issuerHints' },
      }),
    );

    const valid = structuredClone(empty);
    (valid.documents[0] as unknown as { issuerHints: unknown[] }).issuerHints = [
      {
        value: 'Supported issuer candidate',
        sourceBlockIds: [valid.contentBlocks[0]!.contentBlockId],
      },
    ];
    expect(validateDocumentMapTransportSchema(valid)).toBe(true);
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      valid,
      commercialDocumentMapSchemaV1,
    );
    const canonical = canonicalizeCommercialDocumentMapIds(reconstructed as never, {
      sourceDocumentOrdinals: [1],
    });
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();

    const dangling = structuredClone(valid);
    (
      dangling.documents[0]!.issuerHints[0] as unknown as {
        sourceBlockIds: string[];
      }
    ).sourceBlockIds = ['Unmaterialized issuer provenance'];
    expect(validateDocumentMapTransportSchema(dangling)).toBe(true);
    const danglingReconstructed = reconstructCanonicalValueFromOpenAITransport(
      dangling,
      commercialDocumentMapSchemaV1,
    );
    expect(() =>
      canonicalizeCommercialDocumentMapIds(danglingReconstructed as never, {
        sourceDocumentOrdinals: [1],
      }),
    ).toThrowError(expect.objectContaining({ code: 'DOCUMENT_MAP_CANONICALIZATION_FAILED' }));
  });

  it('preserves the complete required headerBlockIds array contract on the wire', () => {
    const canonicalTable = (commercialDocumentMapSchemaV1.$defs as JsonObject).table as JsonObject;
    const transportTable = (openAITransportDocumentMapSchema.$defs as JsonObject)
      .table as JsonObject;
    const canonicalField = (canonicalTable.properties as JsonObject).headerBlockIds as JsonObject;
    const transportField = (transportTable.properties as JsonObject).headerBlockIds as JsonObject;

    expect(canonicalTable.required).toContain('headerBlockIds');
    expect(transportTable.required).toContain('headerBlockIds');
    expect(canonicalField).toEqual({
      type: 'array',
      minItems: 1,
      maxItems: 500,
      uniqueItems: true,
      items: {
        type: 'string',
        pattern: '^block-[a-z0-9][a-z0-9._-]{0,79}$',
      },
    });
    expect(transportField).toEqual({
      type: 'array',
      minItems: 1,
      maxItems: 500,
      items: { type: 'string' },
    });
  });

  it('never turns nullable array-item sentinels into an empty canonical array', () => {
    const arraySchema = {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: { type: 'string' },
    } as const;
    const transportSchema = createOpenAIStructuredOutputProjection(arraySchema);
    const validateTransport = new Ajv2020({ strict: true }).compile(transportSchema);

    expect(reconstructCanonicalValueFromOpenAITransport(['block-x'], arraySchema)).toEqual([
      'block-x',
    ]);
    expect(reconstructCanonicalValueFromOpenAITransport([null], arraySchema)).toEqual([null]);
    expect(reconstructCanonicalValueFromOpenAITransport(['block-x', null], arraySchema)).toEqual([
      'block-x',
      null,
    ]);
    expect(reconstructCanonicalValueFromOpenAITransport([], arraySchema)).toEqual([]);
    expect(transportSchema).toEqual(arraySchema);
    expect(validateTransport(['block-x'])).toBe(true);
    expect(validateTransport([null])).toBe(false);
    expect(validateTransport(['block-x', null])).toBe(false);
    expect(validateTransport([])).toBe(false);
  });

  it('uses property-level null only for an absent optional array', () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['requiredHeaders'],
      properties: {
        requiredHeaders: { type: 'array', minItems: 1, items: { type: 'string' } },
        optionalHeaders: { type: 'array', minItems: 1, items: { type: 'string' } },
      },
    } as const;
    const projected = createOpenAIStructuredOutputProjection(schema);
    const validateTransport = new Ajv2020({ strict: true }).compile(projected);
    const wire = { requiredHeaders: ['block-x'], optionalHeaders: null };

    expect(validateTransport(wire)).toBe(true);
    expect(validateTransport({ requiredHeaders: [], optionalHeaders: null })).toBe(false);
    expect(validateTransport({ requiredHeaders: ['block-x'], optionalHeaders: [] })).toBe(false);
    expect(reconstructCanonicalValueFromOpenAITransport(wire, schema)).toEqual({
      requiredHeaders: ['block-x'],
    });
  });

  it('round-trips valid table header variants through transport, reconstruction and canonicalization', () => {
    const oneHeader = structuredClone(geelyLikeCommercialDocumentMapFixture);
    const multipleHeaders = structuredClone(geelyLikeCommercialDocumentMapFixture);
    const secondHeader = multipleHeaders.tables[0]!.sourceBlockIds.find(
      (blockId) => blockId !== multipleHeaders.tables[0]!.headerBlockIds[0],
    )!;
    (multipleHeaders.tables[0] as unknown as { headerBlockIds: string[] }).headerBlockIds.push(
      secondHeader,
    );
    const absentOptionalMetadata = structuredClone(geelyLikeCommercialDocumentMapFixture);
    delete (absentOptionalMetadata.tables[0] as unknown as { titleHint?: string }).titleHint;
    delete (absentOptionalMetadata.tables[0] as unknown as { approximateRowCount?: number })
      .approximateRowCount;

    for (const fixture of [
      oneHeader,
      multipleHeaders,
      absentOptionalMetadata,
      structuredClone(gwmLikeCommercialDocumentMapFixture),
    ]) {
      const transport = projectCanonicalValueForOpenAITransport(
        fixture,
        commercialDocumentMapSchemaV1,
      );
      const validateTransport = new Ajv2020({ strict: true }).compile(
        openAITransportDocumentMapSchema,
      );
      expect(validateTransport(transport)).toBe(true);
      const reconstructed = reconstructCanonicalValueFromOpenAITransport(
        transport,
        commercialDocumentMapSchemaV1,
      );
      const canonical = canonicalizeCommercialDocumentMapIds(reconstructed as never, {
        sourceDocumentOrdinals: [1],
      });
      expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
    }
  });

  it('rejects empty, malformed and missing table headers without relaxing canonical minItems', () => {
    const empty = structuredClone(geelyLikeCommercialDocumentMapFixture);
    (empty.tables[0] as unknown as { headerBlockIds: string[] }).headerBlockIds = [];
    const emptyTransport = projectCanonicalValueForOpenAITransport(
      empty,
      commercialDocumentMapSchemaV1,
    );
    const validateTransport = new Ajv2020({ allErrors: true, strict: true }).compile(
      openAITransportDocumentMapSchema,
    );
    expect(validateTransport(emptyTransport)).toBe(false);
    expect(validateTransport.errors).toContainEqual(
      expect.objectContaining({ instancePath: '/tables/0/headerBlockIds', keyword: 'minItems' }),
    );
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      emptyTransport,
      commercialDocumentMapSchemaV1,
    );
    expect((reconstructed as typeof empty).tables[0]!.headerBlockIds).toEqual([]);
    const canonical = canonicalizeCommercialDocumentMapIds(reconstructed as never, {
      sourceDocumentOrdinals: [1],
    });
    expect(() => validateCommercialDocumentMap(canonical)).toThrowError(
      expect.objectContaining({ keywordCounts: { minItems: 1 } }),
    );

    const missing = structuredClone(geelyLikeCommercialDocumentMapFixture);
    delete (missing.tables[0] as unknown as { headerBlockIds?: string[] }).headerBlockIds;
    expect(() => validateCommercialDocumentMap(missing)).toThrowError(
      expect.objectContaining({ keywordCounts: { required: 1 } }),
    );
    expect(validateTransport(missing)).toBe(false);
    expect(validateTransport.errors).toContainEqual(
      expect.objectContaining({ instancePath: '/tables/0', keyword: 'required' }),
    );

    const malformed = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentMapFixture,
      commercialDocumentMapSchemaV1,
    ) as typeof geelyLikeCommercialDocumentMapFixture;
    (malformed.tables[0] as unknown as { headerBlockIds: unknown }).headerBlockIds = 'block-x';
    expect(validateTransport(malformed)).toBe(false);
    expect(validateTransport.errors).toContainEqual(
      expect.objectContaining({ instancePath: '/tables/0/headerBlockIds', keyword: 'type' }),
    );
  });

  it('keeps duplicate rejection in both canonical validators after transport reconstruction', () => {
    const map = structuredClone(geelyLikeCommercialDocumentMapFixture);
    const mapIds = map.documents[0]!.titleHints[0]!.sourceBlockIds;
    (
      map.documents[0]!.titleHints[0] as unknown as {
        sourceBlockIds: string[];
      }
    ).sourceBlockIds = [mapIds[0]!, mapIds[0]!];
    expect(() => validateCommercialDocumentMap(map)).toThrow();

    const extraction = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    const page = extraction.tables[0]!.pages[0]!;
    (extraction.tables[0] as unknown as { pages: number[] }).pages = [page, page];
    expect(() => validateCommercialDocumentExtraction(extraction)).toThrow();
  });

  it('accepts a duplicate on the wire and rejects it after canonical reconstruction', () => {
    const transport = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentMapFixture,
      commercialDocumentMapSchemaV1,
    ) as typeof geelyLikeCommercialDocumentMapFixture;
    const duplicated = structuredClone(transport);
    const sourceBlockId = duplicated.documents[0]!.titleHints[0]!.sourceBlockIds[0]!;
    (
      duplicated.documents[0]!.titleHints[0] as unknown as { sourceBlockIds: string[] }
    ).sourceBlockIds = [sourceBlockId, sourceBlockId];
    const validateTransport = new Ajv2020({ strict: true }).compile(
      openAITransportDocumentMapSchema,
    );
    expect(validateTransport(duplicated)).toBe(true);
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      duplicated,
      commercialDocumentMapSchemaV1,
    );
    expect(() => validateCommercialDocumentMap(reconstructed)).toThrow();
  });

  it('accepts model-owned local IDs on the wire and validates them after server canonicalization', () => {
    const idMap = new Map<string, string>();
    let nextId = 0;
    const localId =
      /^(?:document|block|table|column|row|vehicle|fact|scope|group|relation|unit|gap)-/u;
    const replaceIds = (value: unknown): unknown => {
      if (typeof value === 'string' && localId.test(value)) {
        if (!idMap.has(value)) idMap.set(value, `Model Local ID ${++nextId}`);
        return idMap.get(value)!;
      }
      if (Array.isArray(value)) return value.map(replaceIds);
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value as JsonObject).map(([key, item]) => [key, replaceIds(item)]),
        );
      return value;
    };
    const transportLike = replaceIds(
      projectCanonicalValueForOpenAITransport(
        geelyLikeCommercialDocumentExtractionFixture,
        commercialDocumentExtractionSchemaV1,
      ),
    );
    const validateTransport = new Ajv2020({ strict: true, validateFormats: false }).compile(
      openAITransportDocumentExtractionSchema,
    );
    expect(validateTransport(transportLike)).toBe(true);
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      transportLike,
      commercialDocumentExtractionSchemaV1,
    );
    expect(() => validateCommercialDocumentExtraction(reconstructed)).toThrow();
    const canonical = canonicalizeCommercialDocumentExtractionUnit(reconstructed as never, 1);
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
    expect(canonical.documents[0]!.documentId).toMatch(/^document-u0001-/u);
  });

  it('keeps the canonical source excerpt bound while accepting and bounding an overlong wire value', () => {
    const canonicalSourceBlock = (commercialDocumentExtractionSchemaV1.$defs as JsonObject)
      .sourceBlock as JsonObject;
    const transportSourceBlock = (openAITransportDocumentExtractionSchema.$defs as JsonObject)
      .sourceBlock as JsonObject;
    const canonicalExcerpt = (canonicalSourceBlock.properties as JsonObject).excerpt as JsonObject;
    const transportExcerpt = (transportSourceBlock.properties as JsonObject).excerpt as JsonObject;
    expect(canonicalExcerpt).toMatchObject({ type: 'string', minLength: 1, maxLength: 1_000 });
    expect(transportExcerpt).toEqual({ type: 'string' });

    const transport = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    (transport.blocks[0] as { excerpt: string }).excerpt = 'X'.repeat(1_001);
    expect(validateExtractionTransportSchema(transport)).toBe(true);

    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      transport,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    expect(reconstructed.blocks[0]!.excerpt).toHaveLength(1_001);
    expect(() => validateCommercialDocumentExtraction(reconstructed)).toThrow();

    const canonical = canonicalizeCommercialDocumentExtractionUnit(reconstructed, 1);
    expect(canonical.blocks[0]!.excerpt).toBe('X'.repeat(1_000));
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
  });

  it('accepts every Document Map model-local ID on the wire and canonicalizes it server-side', () => {
    const idMap = new Map<string, string>();
    let nextId = 0;
    const localId = /^(?:document|page|block|section|table|note|hint|edge)-/u;
    const replaceIds = (value: unknown): unknown => {
      if (typeof value === 'string' && localId.test(value)) {
        if (!idMap.has(value)) idMap.set(value, `Model Local ID ${++nextId}`);
        return idMap.get(value)!;
      }
      if (Array.isArray(value)) return value.map(replaceIds);
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value as JsonObject).map(([key, item]) => [key, replaceIds(item)]),
        );
      return value;
    };
    const transport = replaceIds(
      projectCanonicalValueForOpenAITransport(
        geelyLikeCommercialDocumentMapFixture,
        commercialDocumentMapSchemaV1,
      ),
    );

    expect(validateDocumentMapTransportSchema(transport)).toBe(true);
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      transport,
      commercialDocumentMapSchemaV1,
    );
    expect(() => validateCommercialDocumentMap(reconstructed)).toThrow();
    const canonical = canonicalizeCommercialDocumentMapIds(reconstructed as never, {
      sourceDocumentOrdinals: [1],
    });
    expect(() => validateCommercialDocumentMap(canonical)).not.toThrow();
    expect(canonical.pages[0]!.pageId).toMatch(/^page-/u);
    expect(canonical.contextEdges[0]!.contextEdgeId).toMatch(/^edge-/u);
  });

  it('validates raw Unit Extraction wire required and preserved constraints', () => {
    const transport = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    const missing = structuredClone(transport) as unknown as { documents?: unknown };
    delete missing.documents;
    expect(validateExtractionTransportSchema(missing)).toBe(false);
    expect(validateExtractionTransportSchema.errors).toContainEqual(
      expect.objectContaining({ instancePath: '', keyword: 'required' }),
    );

    const empty = structuredClone(transport);
    (empty as unknown as { documents: unknown[] }).documents = [];
    expect(validateExtractionTransportSchema(empty)).toBe(false);
    expect(validateExtractionTransportSchema.errors).toContainEqual(
      expect.objectContaining({ instancePath: '/documents', keyword: 'minItems' }),
    );
  });

  it('distinguishes empty composition collections from invalid placeholder elements', () => {
    const emptyCollections = projectCanonicalValueForOpenAITransport(
      gwmLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof gwmLikeCommercialDocumentExtractionFixture;
    expect(emptyCollections.composition).toEqual({ groups: [], relationships: [] });
    expect(validateExtractionTransportSchema(emptyCollections)).toBe(true);

    const emptyGroup = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    (
      emptyGroup.composition.groups[0] as unknown as {
        memberFactIds: string[];
      }
    ).memberFactIds = [];
    expect(validateExtractionTransportSchema(emptyGroup)).toBe(false);
    expect(validateExtractionTransportSchema.errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/composition/groups/0/memberFactIds',
        keyword: 'minItems',
      }),
    );

    const oneMemberGroup = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    (
      oneMemberGroup.composition.groups[0] as unknown as {
        memberFactIds: string[];
      }
    ).memberFactIds = oneMemberGroup.composition.groups[0]!.memberFactIds.slice(0, 1);
    expect(validateExtractionTransportSchema(oneMemberGroup)).toBe(false);
    expect(validateExtractionTransportSchema.errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/composition/groups/0/memberFactIds',
        keyword: 'minItems',
      }),
    );

    const emptyRelationship = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    (
      emptyRelationship.composition.relationships[0] as unknown as {
        factIds: string[];
      }
    ).factIds = [];
    expect(validateExtractionTransportSchema(emptyRelationship)).toBe(false);
    expect(validateExtractionTransportSchema.errors).toContainEqual(
      expect.objectContaining({
        instancePath: '/composition/relationships/0/factIds',
        keyword: 'minItems',
      }),
    );

    const realComposition = projectCanonicalValueForOpenAITransport(
      geelyLikeCommercialDocumentExtractionFixture,
      commercialDocumentExtractionSchemaV1,
    ) as typeof geelyLikeCommercialDocumentExtractionFixture;
    expect(realComposition.composition.groups[0]!.memberFactIds.length).toBeGreaterThanOrEqual(2);
    expect(
      realComposition.composition.relationships.some((relationship) => relationship.factIds.length),
    ).toBe(true);
    expect(validateExtractionTransportSchema(realComposition)).toBe(true);

    const nested = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
    (
      nested.composition.groups[1] as unknown as {
        parentGroupId?: string;
      }
    ).parentGroupId = nested.composition.groups[0]!.groupId;
    const nestedTransport = projectCanonicalValueForOpenAITransport(
      nested,
      commercialDocumentExtractionSchemaV1,
    );
    expect(validateExtractionTransportSchema(nestedTransport)).toBe(true);
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      nestedTransport,
      commercialDocumentExtractionSchemaV1,
    );
    expect(() => validateCommercialDocumentExtraction(reconstructed)).not.toThrow();
  });

  it('enforces relationship fact cardinality independently from optional group subjects', () => {
    const relationshipCase = (
      relationType: 'APPLIES_TOGETHER' | 'GENERAL_RULE',
      factIds: string[],
      groupIds: string[],
    ) => {
      const value = structuredClone(geelyLikeCommercialDocumentExtractionFixture);
      const relation = value.composition.relationships[0]! as unknown as {
        relationType: 'APPLIES_TOGETHER' | 'GENERAL_RULE';
        factIds: string[];
        groupIds: string[];
      };
      relation.relationType = relationType;
      relation.factIds = factIds;
      relation.groupIds = groupIds;
      return projectCanonicalValueForOpenAITransport(value, commercialDocumentExtractionSchemaV1);
    };
    const factId = geelyLikeCommercialDocumentExtractionFixture.facts[0]!.factId;
    const groupId = geelyLikeCommercialDocumentExtractionFixture.composition.groups[0]!.groupId;

    for (const invalid of [
      relationshipCase('GENERAL_RULE', [], []),
      relationshipCase('GENERAL_RULE', [], [groupId]),
    ]) {
      expect(validateExtractionTransportSchema(invalid)).toBe(false);
      expect(validateExtractionTransportSchema.errors).toContainEqual(
        expect.objectContaining({
          instancePath: '/composition/relationships/0/factIds',
          keyword: 'minItems',
        }),
      );
    }

    const factOnly = relationshipCase('GENERAL_RULE', [factId], []);
    expect(validateExtractionTransportSchema(factOnly)).toBe(true);
    expect(() =>
      validateCommercialDocumentExtraction(
        reconstructCanonicalValueFromOpenAITransport(
          factOnly,
          commercialDocumentExtractionSchemaV1,
        ),
      ),
    ).not.toThrow();

    const factAndGroup = relationshipCase('APPLIES_TOGETHER', [factId], [groupId]);
    expect(validateExtractionTransportSchema(factAndGroup)).toBe(true);
    expect(() =>
      validateCommercialDocumentExtraction(
        reconstructCanonicalValueFromOpenAITransport(
          factAndGroup,
          commercialDocumentExtractionSchemaV1,
        ),
      ),
    ).not.toThrow();

    const insufficientSubjects = relationshipCase('APPLIES_TOGETHER', [factId], []);
    expect(validateExtractionTransportSchema(insufficientSubjects)).toBe(true);
    expect(() =>
      validateCommercialDocumentExtraction(
        reconstructCanonicalValueFromOpenAITransport(
          insufficientSubjects,
          commercialDocumentExtractionSchemaV1,
        ),
      ),
    ).toThrowError(
      expect.objectContaining({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            path: '/composition/relationships/0',
            keyword: 'relationNeedsTwoSubjects',
          }),
        ]),
      }),
    );
  });

  it.each([
    ['Geely-like', geelyLikeCommercialDocumentMapFixture],
    ['GWM-like multipage', gwmLikeCommercialDocumentMapFixture],
    ['Fiat-like', fiatLikeCommercialDocumentMapFixture],
    ['VW-like partitioned', vwLikeCommercialDocumentMapFixture],
  ] as const)('round-trips the %s canonical map through the OpenAI transport', (_name, fixture) => {
    const transport = projectCanonicalValueForOpenAITransport(
      fixture,
      commercialDocumentMapSchemaV1,
    );
    const reconstructed = reconstructCanonicalValueFromOpenAITransport(
      transport,
      commercialDocumentMapSchemaV1,
    );
    expect(reconstructed).toEqual(fixture);
    expect(() => validateCommercialDocumentMap(reconstructed)).not.toThrow();
  });

  it('reconstructs nullability recursively and preserves required nullable values', () => {
    const canonicalSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['requiredNullable', 'nested', 'choice'],
      properties: {
        optionalScalar: { type: 'string' },
        optionalNullable: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        requiredNullable: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        nested: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['requiredNullable'],
            properties: {
              optionalArray: { type: 'array', items: { type: 'string' } },
              optionalScalar: { type: 'string' },
              requiredNullable: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            },
          },
        },
        choice: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind'],
              properties: { kind: { const: 'A' }, optionalValue: { type: 'string' } },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'value'],
              properties: { kind: { const: 'B' }, value: { type: 'integer' } },
            },
          ],
        },
      },
    } as const;
    const canonical = {
      optionalNullable: null,
      requiredNullable: null,
      nested: [{ requiredNullable: null }],
      choice: { kind: 'A' },
    };
    const projected = createOpenAIStructuredOutputProjection(canonicalSchema);
    expect(projected).toMatchObject({
      properties: { choice: { anyOf: expect.any(Array) } },
    });
    expect(JSON.stringify(projected)).not.toContain('"oneOf"');
    const transport = projectCanonicalValueForOpenAITransport(canonical, canonicalSchema);
    expect(transport).toMatchObject({
      optionalScalar: null,
      optionalNullable: null,
      requiredNullable: null,
      nested: [{ optionalArray: null, optionalScalar: null, requiredNullable: null }],
      choice: { kind: 'A', optionalValue: null },
    });
    expect(reconstructCanonicalValueFromOpenAITransport(transport, canonicalSchema)).toEqual(
      canonical,
    );
  });
});
