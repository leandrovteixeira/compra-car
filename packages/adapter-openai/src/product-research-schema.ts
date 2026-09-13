const nullableText = { type: ['string', 'null'], minLength: 1, maxLength: 200 };
const nullableYear = { type: ['integer', 'null'], minimum: 1900, maximum: 2200 };
const candidateProperties = {
  brand: { type: 'string', minLength: 1, maxLength: 120 },
  model: { type: 'string', minLength: 1, maxLength: 200 },
  taxonomy: { type: 'string', enum: ['MODEL', 'VARIANT', 'POWERTRAIN', 'LANDING_PAGE', 'UNKNOWN'] },
  officialVersionLabel: nullableText,
  trim: nullableText,
  powertrainLabel: nullableText,
  engineDisplacement: { type: ['number', 'null'], minimum: 0.1, maximum: 20 },
  engineLabel: nullableText,
  propulsion: { type: ['string', 'null'], enum: ['ICE', 'MHEV', 'HEV', 'PHEV', 'BEV', null] },
  transmission: nullableText,
  drivetrain: nullableText,
  productionYear: nullableYear,
  modelYear: nullableYear,
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  extractionWarnings: {
    type: 'array',
    items: {
      type: 'string',
      enum: ['POSSIBLE_ALIAS', 'POSSIBLE_PACKAGE', 'CONFLICTING_SOURCES', 'INSUFFICIENT_EVIDENCE'],
    },
  },
  evidence: {
    type: 'array',
    maxItems: 30,
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['url', 'title', 'excerpt', 'evidenceType'],
      properties: {
        url: { type: 'string', minLength: 1, maxLength: 2048 },
        title: { type: ['string', 'null'], maxLength: 300 },
        excerpt: { type: ['string', 'null'], maxLength: 300 },
        evidenceType: {
          type: ['string', 'null'],
          enum: [
            'TECHNICAL_SHEET',
            'VERSION_DOCUMENT',
            'PRICE_LIST',
            'CONFIGURATOR',
            'MODEL_PAGE',
            'PRESS_RELEASE',
            'OTHER_OFFICIAL',
            null,
          ],
        },
      },
    },
  },
};
export const productResearchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      maxItems: 1000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(candidateProperties),
        properties: candidateProperties,
      },
    },
  },
};
