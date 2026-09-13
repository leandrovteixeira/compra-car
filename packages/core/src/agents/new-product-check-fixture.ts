import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import type {
  ProductResearchProvider,
  ProductCatalogReader,
  OfficialProductCandidate,
  AgentMarketScope,
} from './new-product-check-types';
import { officialBrandSource } from './official-product-sources';

/** Synthetic identities from the acceptance scenario; not assertions of current availability. */
export const toyotaFixtureCatalog: readonly AdministrativeVehicle[] = [
  ['cc-xr', 'Corolla Cross', 'XR 2.0 CVT'],
  ['cc-xre', 'Corolla Cross', 'XRE 2.0 CVT'],
  ['cc-xrx-hev', 'Corolla Cross', 'XRX 1.8 HEV CVT'],
  ['cc-xrx-ice', 'Corolla Cross', 'XRX 2.0 CVT'],
  ['yc-xre-ice', 'Yaris Cross', 'XRE 1.5 CVT'],
  ['yc-xrx-ice', 'Yaris Cross', 'XRX 1.5 CVT'],
  ['yc-xre-hev', 'Yaris Cross', 'XRE 1.5 HEV CVT'],
  ['yc-xrx-hev', 'Yaris Cross', 'XRX 1.5 HEV CVT'],
].map(([id, model, version], index) => ({
  id: id!,
  brand: 'Toyota',
  model: model!,
  version: version!,
  productionYear: 2025,
  modelYear: 2026,
  isActive: index !== 2,
  isPublic: index !== 1 && index !== 2,
}));
const unresolved: OfficialProductCandidate = {
  brand: 'Toyota',
  model: 'Corolla Cross',
  taxonomy: 'MODEL',
  officialVersionLabel: null,
  trim: null,
  powertrainLabel: null,
  engineDisplacement: null,
  engineLabel: null,
  propulsion: null,
  transmission: null,
  drivetrain: null,
  productionYear: null,
  modelYear: null,
  confidence: 0.95,
  extractionWarnings: [],
  evidence: [
    {
      url: 'https://www.toyota.com.br/modelos',
      title: 'Synthetic Toyota fixture',
      excerpt: 'Synthetic identity scenario; not extracted from this page.',
      evidenceType: 'MODEL_PAGE',
    },
  ],
};
export const toyotaFixtureCandidates: readonly OfficialProductCandidate[] = [
  ...(
    [
      ['Corolla Cross', 'XR', 2.0, 'ICE'],
      ['Corolla Cross', 'XRE', 2.0, 'ICE'],
      ['Corolla Cross', 'XRX', 1.8, 'HEV'],
      ['Corolla Cross', 'XRX', 2.0, 'ICE'],
      ['Yaris Cross', 'XRE', 1.5, 'ICE'],
      ['Yaris Cross', 'XRX', 1.5, 'ICE'],
      ['Yaris Cross', 'XRE', 1.5, 'HEV'],
      ['Yaris Cross', 'XRX', 1.5, 'HEV'],
    ] as const
  ).map(([model, trim, engineDisplacement, propulsion]) => ({
    ...unresolved,
    model,
    taxonomy: 'VARIANT' as const,
    officialVersionLabel: trim,
    trim,
    engineDisplacement,
    propulsion,
    transmission: 'CVT',
    evidence: [
      {
        url: 'https://media.toyota.com.br/fixture-technical-sheet.pdf',
        title: 'Synthetic technical sheet',
        excerpt: 'Synthetic variant ' + model + ' ' + trim + ' ' + propulsion + '.',
        evidenceType: 'TECHNICAL_SHEET' as const,
      },
    ],
  })),
  { ...unresolved, model: 'SW4' },
  { ...unresolved, taxonomy: 'VARIANT', officialVersionLabel: 'GR-Sport', trim: 'GR-Sport' },
  unresolved,
];
export class FixtureProductResearchProvider implements ProductResearchProvider {
  async researchProducts(scope: AgentMarketScope) {
    officialBrandSource(scope);
    return {
      candidates: structuredClone(toyotaFixtureCandidates),
      metadata: { provider: 'fixture', webSearchCount: 0 },
    };
  }
}
export class FixtureProductCatalogReader implements ProductCatalogReader {
  async readProducts(scope: AgentMarketScope) {
    officialBrandSource(scope);
    return structuredClone(toyotaFixtureCatalog);
  }
}
