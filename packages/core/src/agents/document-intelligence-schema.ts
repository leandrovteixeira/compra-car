import Ajv from 'ajv';
import type { TechnicalSheetContent } from './document-intelligence-types';
const nullable = { type: ['string', 'null'], maxLength: 2000 };
const text = { type: 'string', minLength: 1, maxLength: 12000 };
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const evidence = {
  type: 'array',
  maxItems: 20,
  items: {
    ...object({
      sourceHash: text,
      locator: text,
      quote: text,
      page: { type: ['integer', 'null'] },
      evidenceType: {
        type: 'string',
        enum: ['TEXT_SPAN', 'TEXT_WINDOW', 'STRUCTURAL_CONTEXT', 'LAYOUT_CONTEXT'],
      },
      sectionHeading: nullable,
      parentContext: nullable,
    }),
    required: ['sourceHash', 'locator', 'quote'],
  },
};
const applicability = object({
  model: nullable,
  version: nullable,
  modelYear: { type: ['integer', 'null'] },
  versionBinding: {
    type: 'string',
    enum: ['EXACT_VERSION', 'VERSION_MATRIX', 'MODEL_SHARED', 'UNRESOLVED'],
  },
  yearBinding: { type: 'string', enum: ['EXACT_MY', 'CURRENT_LINEUP', 'UNRESOLVED'] },
});
export const technicalSheetSchema = object({
  documentIdentity: object({
    brand: nullable,
    model: nullable,
    version: nullable,
    modelYear: { type: ['integer', 'null'] },
    evidence,
  }),
  sections: {
    type: 'array',
    maxItems: 100,
    items: object({
      sourceHeading: text,
      normalizedHeading: nullable,
      applicability,
      items: {
        type: 'array',
        maxItems: 1000,
        items: object({
          sourceLabel: text,
          rawValue: nullable,
          rawUnit: nullable,
          kind: {
            type: 'string',
            enum: ['VALUE', 'PRESENT', 'EXPLICIT_ABSENT', 'TEXT', 'COMPOSITE', 'OPTION'],
          },
          present: { type: ['boolean', 'null'] },
          subgroup: nullable,
          parentGroup: nullable,
          rawText: text,
          evidence,
          applicability,
        }),
      },
    }),
  },
});
/** Responses strict schema requires all v2 evidence fields; v1 input remains replayable. */
export const productionTechnicalSheetSchema = JSON.parse(
  JSON.stringify(technicalSheetSchema),
) as Record<string, unknown>;
function requireAll(node: unknown) {
  if (!node || typeof node !== 'object') return;
  const v = node as Record<string, unknown>;
  if (v.type === 'object') v.required = Object.keys(v.properties as object);
  for (const child of Object.values(v)) {
    if (Array.isArray(child)) child.forEach(requireAll);
    else requireAll(child);
  }
}
requireAll(productionTechnicalSheetSchema);
export const validateTechnicalSheetSchema = new Ajv({
  strict: true,
  allErrors: true,
}).compile<TechnicalSheetContent>(technicalSheetSchema);
