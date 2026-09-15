import type {
  ModelYearResearchTarget,
  ModelYearObservation,
  ModelYearEvidence,
} from '../../src/agents';
/** Reconstructed from coverage facts supplied in the Sprint 20.1 brief. Not a live capture or verbatim page transcript. */
export const vwGoldenCoverage = [
  {
    model: 'Nivus',
    version: 'Highline 200 TSI',
    trim: 'Highline',
    year: 2025,
    text: 'Nivus: a partir do ano/modelo 2025.\nVersões Highline, GTS e opcional Comfortline.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Nivus',
    version: 'GTS 250 TSI',
    trim: 'GTS',
    year: 2025,
    text: 'Nivus: a partir do ano/modelo 2025.\nVersões Highline, GTS e opcional Comfortline.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Nivus',
    version: 'Comfortline 200 TSI',
    trim: 'Comfortline',
    year: 2025,
    text: 'Nivus: a partir do ano/modelo 2025.\nVersões Highline, GTS e opcional Comfortline.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Tera',
    version: 'Tera Comfort',
    trim: 'Comfort',
    year: 2026,
    text: 'Tera: a partir do ano/modelo 2026.\nVersões Comfort, High e 170 TSI.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Tera',
    version: 'Tera High',
    trim: 'High',
    year: 2026,
    text: 'Tera: a partir do ano/modelo 2026.\nVersões Comfort, High e 170 TSI.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Tera',
    version: '170 TSI',
    trim: '170 TSI',
    year: 2026,
    text: 'Tera: a partir do ano/modelo 2026.\nVersões Comfort, High e 170 TSI.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Taos',
    version: 'Comfort',
    trim: 'Comfort',
    year: 2026,
    text: 'Taos: a partir do ano/modelo 2026.\nVersões Comfort e High.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Taos',
    version: 'High',
    trim: 'High',
    year: 2026,
    text: 'Taos: a partir do ano/modelo 2026.\nVersões Comfort e High.',
    page: 'https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html',
  },
  {
    model: 'Nivus',
    version: 'Highline 200 TSI',
    trim: 'Highline',
    year: 2026,
    text: 'Nivus linha 2026.\nVersões: Comfortline e Highline.',
    page: 'https://www.vwnews.com.br/news/synthetic-nivus-context',
  },
  {
    model: 'T-Cross',
    version: 'Highline 250 TSI',
    trim: 'Highline',
    year: 2026,
    text: 'T-Cross linha 2026.\nVersões: Comfortline, Highline, Extreme e 200 TSI.',
    page: 'https://www.vwnews.com.br/news/synthetic-t-cross-context',
  },
];
export function coverageTarget(
  brand = 'VW',
  model = 'Nivus',
  version = 'Highline 200 TSI',
  trim = 'Highline',
): ModelYearResearchTarget {
  return {
    targetKey: [brand, model, version].join(':'),
    mmvIdentity: [brand, model, version].join('|'),
    canonicalCatalogIdentity: { brand, model, version },
    officialIdentity: { brand, model, officialVersionLabel: version },
    structuredIdentity: {
      trim,
      powertrainLabel: null,
      engineDisplacement: null,
      engineLabel: null,
      propulsion: null,
      transmission: null,
      drivetrain: null,
    },
    knownAliases: [version],
    knownModelYears: [2026],
    discoveryEvidence: [],
  };
}
export function contextEvidence(
  text: string,
  url = 'https://www.vw.com.br/technology',
  patch: Partial<ModelYearEvidence> = {},
): ModelYearEvidence {
  return {
    url,
    title: 'Synthetic context',
    excerpt: text,
    contextText: text,
    contextId: 'model-block',
    role: 'MY_ASSERTION',
    yearSemantics: 'EXPLICIT_MY',
    evidenceType: 'OTHER_OFFICIAL',
    ...patch,
  };
}
export function coverageObservation(
  target: ModelYearResearchTarget,
  year: number,
  text: string,
  url?: string,
): ModelYearObservation {
  return {
    targetKey: target.targetKey,
    modelYear: year,
    confidence: 0.8,
    applicability: 'MODEL_LINE',
    sourceTier: 'MANUFACTURER_OFFICIAL',
    evidence: [contextEvidence(text, url)],
  };
}
