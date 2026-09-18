import type {
  DocumentIntelligenceSource,
  TechnicalSheetContent,
  SpecSourceTarget,
} from '../src/agents';
export const target = {
  brand: 'VW',
  model: 'Nivus',
  officialVersionLabel: 'Comfortline 200 TSI',
  catalogVersion: 'Comfortline',
  modelYear: 2026,
  mmvIdentity: 'test',
  discoveryRunId: 'test',
  structuredIdentity: {},
} as SpecSourceTarget;
const scope = { model: 'Nivus', version: 'Comfortline 200 TSI', modelYear: 2026 };
const app = {
  ...scope,
  versionBinding: 'EXACT_VERSION' as const,
  yearBinding: 'EXACT_MY' as const,
};
export const source: DocumentIntelligenceSource = {
  format: 'HTML_DOCUMENT',
  sourceClass: 'OFFICIAL_MODEL_PAGE',
  official: true,
  reference: 'https://vw.com.br/nivus',
  finalUrl: 'https://vw.com.br/nivus',
  sourceHash: 'hash',
  contentType: 'text/html',
  byteSize: 100,
  title: 'VW Nivus',
  h1: ['Nivus'],
  truncated: false,
  blocks: [
    {
      locator: 'card',
      type: 'CARD',
      parentLocator: null,
      heading: 'Comfortline 200 TSI',
      scope,
      text: 'VW Nivus Comfortline 200 TSI MY2026 Motor 200 TSI Câmera •',
    },
  ],
};
const ev = { sourceHash: 'hash', locator: 'card', quote: source.blocks[0]!.text };
export const content: TechnicalSheetContent = {
  documentIdentity: { brand: 'VW', model: 'Nivus', version: null, modelYear: null, evidence: [ev] },
  sections: [
    {
      sourceHeading: 'Motor',
      normalizedHeading: null,
      applicability: app,
      items: [
        {
          sourceLabel: 'Motor',
          rawValue: '200 TSI',
          rawUnit: null,
          kind: 'VALUE',
          present: null,
          subgroup: null,
          parentGroup: null,
          rawText: 'Motor 200 TSI',
          evidence: [ev],
          applicability: app,
        },
      ],
    },
  ],
};
