import type { AdministrativeVehicle } from '../admin/administrative-vehicle';
import type { OfficialProductCandidate } from './new-product-check-types';

/** Synthetic acceptance data, not a statement about the current Jeep range. */
export const jeepFixtureCatalog: readonly AdministrativeVehicle[] = [
  ['jeep-renegade-longitude-ice', 'Renegade', 'Longitude 1.3 TGDI AT'],
  ['jeep-renegade-longitude-mhev', 'Renegade', 'Longitude 1.3 TGDI AT MHEV'],
  ['jeep-compass-longitude', 'Compass', 'Longitude 1.3 TGDI AT'],
  ['jeep-compass-limited', 'Compass', 'Limited 1.3 TGDI AT'],
].map(([id, model, version], index) => ({
  id: id!,
  brand: 'Jeep',
  model: model!,
  version: version!,
  productionYear: 2025,
  modelYear: 2026,
  isActive: index !== 1,
  isPublic: index > 1,
}));
const modelOnly: OfficialProductCandidate = {
  brand: 'Jeep',
  model: 'Compass',
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
      url: 'https://www.jeep.com.br/fixture-models',
      title: 'Synthetic Jeep models',
      excerpt: 'Synthetic fixture, not extracted from a live page.',
      evidenceType: 'MODEL_PAGE',
    },
  ],
};
export const jeepFixtureCandidates: readonly OfficialProductCandidate[] = [
  ...(
    [
      ['Renegade', 'Longitude', 'T270', 'ICE'],
      ['Renegade', 'Longitude', 'T270 MHEV', 'MHEV'],
      ['Compass', 'Longitude', 'T270', 'ICE'],
      ['Compass', 'Limited', 'T270', 'ICE'],
    ] as const
  ).map(([model, trim, powertrainLabel, propulsion]) => ({
    ...modelOnly,
    model,
    trim,
    powertrainLabel,
    propulsion,
    taxonomy: 'VARIANT' as const,
    officialVersionLabel: trim + ' ' + powertrainLabel,
    engineDisplacement: 1.3,
    transmission: 'Automática de 6 velocidades',
    evidence: [
      {
        url: 'https://www.jeep.com.br/fixture-technical-sheet.pdf',
        title: 'Synthetic technical sheet',
        excerpt:
          model +
          ' ' +
          trim +
          ' ' +
          powertrainLabel +
          '; explicitly published fixture facts: 1.3 L, ' +
          propulsion +
          ', AT.',
        evidenceType: 'TECHNICAL_SHEET' as const,
      },
    ],
  })),
  {
    ...modelOnly,
    taxonomy: 'VARIANT',
    officialVersionLabel: 'Blackhawk Hurricane Flex',
    trim: 'Blackhawk',
    powertrainLabel: 'Hurricane Flex',
    evidence: [
      {
        url: 'https://configurador.jeep.com.br/fixture-compass',
        title: 'Synthetic configurator',
        excerpt:
          'Distinct commercial variant: Compass Blackhawk Hurricane Flex. No technical mapping inferred.',
        evidenceType: 'CONFIGURATOR',
      },
    ],
  },
  ...(['Limited', 'Overland'] as const).map((trim) => ({
    ...modelOnly,
    model: 'Commander',
    taxonomy: 'VARIANT' as const,
    trim,
    officialVersionLabel: trim + ' Hurricane',
    powertrainLabel: 'Hurricane',
  })),
  modelOnly,
];
