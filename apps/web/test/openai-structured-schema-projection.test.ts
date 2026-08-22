import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { commercialDocumentMapSchemaV1 } from '@compra-car/core/commercial-document-map-schema';
import { validateCommercialDocumentMap } from '@compra-car/core/commercial-document-map-validator';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import { validateCommercialDocumentExtraction } from '@compra-car/core/commercial-document-extraction-validator';
import { canonicalizeCommercialDocumentExtractionUnit } from '@compra-car/core/commercial-document-extraction-canonicalizer';

import {
  fiatLikeCommercialDocumentMapFixture,
  geelyLikeCommercialDocumentMapFixture,
  gwmLikeCommercialDocumentMapFixture,
  vwLikeCommercialDocumentMapFixture,
} from '../../../packages/core/test/fixtures/import/commercial-document-map-fixtures';
import { geelyLikeCommercialDocumentExtractionFixture } from '../../../packages/core/test/fixtures/import/commercial-document-extraction-fixtures';
import {
  openAITransportDocumentExtractionSchema,
  openAITransportDocumentMapSchema,
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
    const canonical = canonicalizeCommercialDocumentExtractionUnit(reconstructed as never, 1);
    expect(() => validateCommercialDocumentExtraction(canonical)).not.toThrow();
    expect(canonical.documents[0]!.documentId).toMatch(/^document-u0001-/u);
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
