import { describe, expect, it } from 'vitest';
import { commercialDocumentMapSchemaV1 } from '@compra-car/core/commercial-document-map-schema';
import { validateCommercialDocumentMap } from '@compra-car/core/commercial-document-map-validator';
import { commercialDocumentExtractionSchemaV1 } from '@compra-car/core/commercial-document-extraction-schema';
import { validateCommercialDocumentExtraction } from '@compra-car/core/commercial-document-extraction-validator';

import { geelyLikeCommercialDocumentMapFixture } from '../../../packages/core/test/fixtures/import/commercial-document-map-fixtures';
import { geelyLikeCommercialDocumentExtractionFixture } from '../../../packages/core/test/fixtures/import/commercial-document-extraction-fixtures';
import {
  openAITransportDocumentExtractionSchema,
  openAITransportDocumentMapSchema,
} from '../src/server/segmented-import-runtime';
import { createOpenAIStructuredOutputProjection } from '../src/server/openai-structured-output-schema';

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
});
