import type { ModelYearResearchTarget, StructuredModelYearRow } from '../../src/agents';

// Regression for Staging run efabe25f-34c9-4c8f-b419-0ac6090242ed.
// Preserve the MMV Discovery fields reported by the operator, especially raw transmission.
// Remaining envelope fields are local test data, not a database export.
function discoveryTarget(
  model: string,
  trim: string,
  powertrainLabel: string,
  transmission: string,
): ModelYearResearchTarget {
  const version = trim + ' ' + powertrainLabel;
  return {
    targetKey: ['VW', model, version].join(':'),
    mmvIdentity: ['VW', model, version].join('|'),
    canonicalCatalogIdentity: { brand: 'VW', model, version },
    officialIdentity: { brand: 'VW', model, officialVersionLabel: version },
    structuredIdentity: {
      trim,
      powertrainLabel,
      engineDisplacement: null,
      engineLabel: null,
      propulsion: null,
      transmission,
      drivetrain: null,
    },
    knownAliases: [version],
    knownModelYears: [2026],
    discoveryEvidence: [],
  };
}
export const mmvDiscoveryNivusTargets = ['Comfortline', 'Highline', 'Sense', 'GTS'].map((trim) =>
  discoveryTarget(
    'Nivus',
    trim,
    trim === 'GTS' ? '250 TSI' : '200 TSI',
    'Automática de 6 velocidades',
  ),
);
export const mmvDiscoveryTaosTargets = ['Comfortline', 'Highline'].map((trim) =>
  discoveryTarget('Taos', trim, '250 TSI', 'Automática de 8 velocidades'),
);
export const mmvDiscoveryTeraTargets = ['Comfort', 'High'].map((trim) =>
  discoveryTarget('Tera', trim, '170 TSI', 'Automático'),
);
function row(model: string, versionLabel: string): StructuredModelYearRow {
  return {
    brand: 'VW',
    model,
    modelYear: 2027,
    versionLabel,
    sourceKind: 'WEBMOTORS_FIPE',
    sourceUrl:
      'https://www.webmotors.com.br/tabela-fipe/carros/volkswagen/' + model.toLowerCase() + '/2027',
  };
}
// Nivus labels supplied in the bug report; Taos/Tera are Webmotors-style test labels.
export const mmvDiscoveryStructuredCases = [
  {
    model: 'Nivus',
    targets: mmvDiscoveryNivusTargets,
    rows: [
      row('Nivus', 'Volkswagen Nivus 1.0 200 Tsi Comfortline Automático 2027'),
      row('Nivus', 'Volkswagen Nivus 1.0 200 Tsi Highline Automático 2027'),
      row('Nivus', 'Volkswagen Nivus 1.0 200 Tsi Sense Automático 2027'),
      row('Nivus', 'Volkswagen Nivus 1.4 250 Tsi GTS Automático 2027'),
    ],
    count: 4,
  },
  {
    model: 'Taos',
    targets: mmvDiscoveryTaosTargets,
    rows: [
      row('Taos', 'Volkswagen Taos 1.4 250 Tsi Comfortline Automático 2027'),
      row('Taos', 'Volkswagen Taos 1.4 250 Tsi Highline Automático 2027'),
    ],
    count: 2,
  },
  {
    model: 'Tera',
    targets: mmvDiscoveryTeraTargets,
    rows: [
      row('Tera', 'Volkswagen Tera 1.0 170 Tsi Comfort Automático 2027'),
      row('Tera', 'Volkswagen Tera 1.0 170 Tsi High Automático 2027'),
    ],
    count: 2,
  },
];
