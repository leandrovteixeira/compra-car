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
  ['895', 'Corolla Cross', 'XR 2.0 CVT'],
  ['896', 'Corolla Cross', 'XRE 2.0 CVT'],
  ['615', 'Corolla Cross', 'XRX 1.8 HEV CVT'],
  ['897', 'Corolla Cross', 'XRX 2.0 CVT'],
  ['1015', 'Yaris Cross', 'XRE 1.5 CVT'],
  ['1016', 'Yaris Cross', 'XRX 1.5 CVT'],
  ['1018', 'Yaris Cross', 'XRE 1.5 HEV CVT'],
  ['1017', 'Yaris Cross', 'XRX 1.5 HEV CVT'],
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
    officialVersionLabel:
      propulsion === 'HEV'
        ? trim + ' Hybrid'
        : model === 'Corolla Cross' && trim === 'XRX'
          ? 'XRX FFV'
          : trim,
    trim,
    engineDisplacement,
    propulsion,
    transmission:
      propulsion === 'HEV'
        ? model === 'Corolla Cross'
          ? 'Hybrid Transaxle (CVT)'
          : 'Hybrid Transaxle'
        : model === 'Corolla Cross'
          ? 'Direct Shift (CVT)'
          : trim === 'XRE'
            ? 'CVT Multidrive'
            : 'CVT Multidrive sequencial',
    evidence: [
      {
        url: 'https://media.toyota.com.br/fixture-technical-sheet.pdf',
        title: 'Synthetic technical sheet',
        excerpt: 'Synthetic variant ' + model + ' ' + trim + ' ' + propulsion + '.',
        evidenceType: 'TECHNICAL_SHEET' as const,
      },
    ],
  })),
  ...(
    [
      ['Corolla', 'Altis Hybrid Premium', 'HEV', 1.8],
      ['Corolla', 'GLI Hybrid', 'HEV', 1.8],
      ['Corolla', 'Altis Premium', 'ICE', 2],
      ['Corolla', 'XEI', 'ICE', 2],
      ['Corolla', 'GR-S', 'ICE', 2],
      ['SW4', 'Diamond', 'ICE', 2.8],
      ['SW4', 'SRX Platinum 7S', 'ICE', 2.8],
      ['SW4', 'SRX Platinum 5S', 'ICE', 2.8],
      ['RAV4', '4WD S', 'HEV', 2.5],
      ['RAV4', '4WD SX', 'HEV', 2.5],
    ] as const
  ).map(([model, trim, propulsion, engineDisplacement]) => ({
    ...unresolved,
    model,
    trim,
    propulsion,
    engineDisplacement,
    taxonomy: 'VARIANT' as const,
    officialVersionLabel: trim,
    extractionWarnings:
      trim === 'GR-S' || trim.startsWith('SRX') ? ['POSSIBLE_ALIAS' as const] : [],
  })),
  ...(['GRS', 'GRS Dualtone'] as const).map((officialVersionLabel) => ({
    ...unresolved,
    taxonomy: 'VARIANT' as const,
    trim: 'GRS',
    officialVersionLabel,
    extractionWarnings:
      officialVersionLabel === 'GRS' ? ['POSSIBLE_ALIAS' as const] : ['POSSIBLE_PACKAGE' as const],
    evidence: [
      {
        url: 'https://www.toyota.com.br/fixture-price-list.pdf',
        title: 'Synthetic price list',
        excerpt: 'Separate commercial row: ' + officialVersionLabel,
        evidenceType: 'PRICE_LIST' as const,
      },
      {
        ...unresolved.evidence[0]!,
        excerpt: 'Synthetic model page naming: Corolla Cross GR-Sport.',
      },
    ],
  })),
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
