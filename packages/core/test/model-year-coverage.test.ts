import { describe, expect, it } from 'vitest';
import {
  reconcileModelYears,
  validateModelYearSources,
  type OfficialBrandSource,
  type ModelYearObservation,
} from '../src/agents';
import {
  coverageTarget,
  coverageObservation,
  contextEvidence,
  vwGoldenCoverage,
} from './fixtures/model-year-coverage';
const source: OfficialBrandSource = {
  country: 'BR',
  brand: 'VW',
  allowedDomains: ['vw.com.br', 'vwnews.com.br'],
  allowedHosts: ['www.vw.com.br', 'www.vwnews.com.br'],
  allowedSubdomainRoots: ['vw.com.br', 'vwnews.com.br'],
  searchHints: [],
};
const target = coverageTarget();
const official = () =>
  coverageObservation(target, 2026, 'Nivus linha 2026.\nVersões: Highline e Comfortline.');
const result = (o: ModelYearObservation[]) => validateModelYearSources([target], o, source);
describe('20.1 evidence context and provenance', () => {
  it.each(vwGoldenCoverage)('golden $model $version MY $year', (g) => {
    const t = coverageTarget('VW', g.model, g.version, g.trim);
    expect(
      validateModelYearSources([t], [coverageObservation(t, g.year, g.text, g.page)], source)
        .accepted,
    ).toHaveLength(1);
  });
  it('accepts fragments in one explicit contiguous section', () => {
    const text = 'Nivus ano-modelo 2027.\nVersões: Highline, Comfortline.';
    const o = {
      ...official(),
      modelYear: 2027,
      evidence: [
        contextEvidence(text, undefined, { excerpt: 'Nivus ano-modelo 2027.' }),
        contextEvidence(text, undefined, {
          role: 'TARGET_APPLICABILITY',
          excerpt: 'Versões: Highline, Comfortline.',
        }),
      ],
    };
    expect(result([o]).accepted).toHaveLength(1);
  });
  it('rejects unrelated blocks on the same page', () => {
    const o = {
      ...official(),
      modelYear: 2027,
      evidence: [
        contextEvidence('Nivus linha 2027', undefined, { contextId: 'nivus' }),
        contextEvidence('Tera: versões Highline', undefined, {
          contextId: 'tera',
          role: 'TARGET_APPLICABILITY',
        }),
      ],
    };
    expect(result([o]).rejected[0]?.reasonCode).toBe('VERSION_NOT_BOUND');
  });
  it('rejects excerpt not contained in its claimed block', () => {
    const o = official();
    expect(
      result([{ ...o, evidence: [{ ...o.evidence[0]!, contextText: 'Nivus unrelated' }] }])
        .rejected[0]?.reasonCode,
    ).toBe('INVALID_EVIDENCE_CONTEXT');
  });
  it('rejects mixed MY blocks rather than attributing another version year', () => {
    expect(
      result([
        {
          ...official(),
          evidence: [contextEvidence('Nivus Comfortline modelo 2026. Highline modelo 2027.')],
        },
      ]).rejected[0]?.reasonCode,
    ).toBe('INVALID_EVIDENCE_CONTEXT');
  });
  it('manufacturer page outside source entries is sufficient', () => {
    expect(result([official()]).accepted[0]?.sourceTier).toBe('MANUFACTURER_OFFICIAL');
  });
  it('from MY 2025 does not imply 2026', () => {
    expect(
      result([
        {
          ...official(),
          evidence: [contextEvidence('Nivus a partir do ano-modelo 2025. Versões: Highline.')],
        },
      ]).rejected[0]?.reasonCode,
    ).toBe('NO_EXPLICIT_MY');
  });
  it('does not invent High = Highline alias', () => {
    const t = coverageTarget('VW', 'Taos', 'Highline 250 TSI', 'Highline');
    expect(
      validateModelYearSources(
        [t],
        [coverageObservation(t, 2026, 'Taos ano-modelo 2026. Versões High e Comfort.')],
        source,
      ).accepted,
    ).toHaveLength(0);
  });
  it('manual vehicle-year heading requires official year-specific version applicability', () => {
    const t = coverageTarget('VW', 'T-Cross', 'Highline 250 TSI', 'Highline');
    const manual = contextEvidence(
      'Manuais por ano-modelo. Manual T-Cross 2027',
      'https://www.vw.com.br/manuals',
      { excerpt: 'Manual T-Cross 2027', yearSemantics: 'VEHICLE_MODEL_YEAR' },
    );
    const o = {
      ...coverageObservation(t, 2027, ''),
      evidence: [
        manual,
        contextEvidence('T-Cross linha 2027. Versões: Highline.', 'https://www.vw.com.br/t-cross', {
          role: 'TARGET_APPLICABILITY',
        }),
      ],
    };
    expect(validateModelYearSources([t], [o], source).accepted).toHaveLength(1);
    expect(
      validateModelYearSources([t], [{ ...o, evidence: [manual] }], source).rejected[0]?.reasonCode,
    ).toBe('VERSION_NOT_BOUND');
    expect(
      validateModelYearSources(
        [t],
        [
          {
            ...o,
            evidence: [
              { ...manual, contextText: 'Publicado em 2027. Manual T-Cross 2027' },
              o.evidence[1]!,
            ],
          },
        ],
        source,
      ).rejected[0]?.reasonCode,
    ).toBe('NO_EXPLICIT_MY');
  });
  it('manual cannot borrow a different MY version membership', () => {
    const t = coverageTarget('VW', 'T-Cross', 'Highline', 'Highline');
    const o = {
      ...coverageObservation(t, 2027, ''),
      evidence: [
        contextEvidence('Manuais por ano-modelo. Manual T-Cross 2027', undefined, {
          excerpt: 'Manual T-Cross 2027',
          yearSemantics: 'VEHICLE_MODEL_YEAR',
        }),
        contextEvidence('T-Cross linha 2026. Versões Highline.', 'https://www.vw.com.br/t-cross', {
          role: 'TARGET_APPLICABILITY',
        }),
      ],
    };
    expect(validateModelYearSources([t], [o], source).accepted).toHaveLength(0);
  });
  it('dealer requires binding name and domain on both observation and manufacturer authorization', () => {
    const o: ModelYearObservation = {
      ...coverageObservation(
        target,
        2027,
        'Dealer Exemplo - VW Nivus linha 2027. Versões Highline.',
        'https://dealer.example/oferta',
      ),
      sourceTier: 'AUTHORIZED_DEALER',
      dealer: { name: 'Dealer Exemplo', domain: 'dealer.example' },
    };
    const authorization = contextEvidence(
      'Concessionária autorizada Dealer Exemplo - dealer.example',
      'https://www.vw.com.br/locator',
      { role: 'DEALER_AUTHORIZATION' },
    );
    expect(result([o]).rejected[0]?.reasonCode).toBe('DEALER_AUTHORIZATION_NOT_PROVEN');
    expect(result([{ ...o, evidence: [...o.evidence, authorization] }]).accepted).toHaveLength(1);
    for (const patch of [
      { url: 'https://evil.example/locator' },
      {
        contextText: 'Concessionária Outra - dealer.example',
        excerpt: 'Concessionária Outra - dealer.example',
      },
      {
        contextText: 'Concessionária Dealer Exemplo - other.example',
        excerpt: 'Concessionária Dealer Exemplo - other.example',
      },
    ])
      expect(
        result([{ ...o, evidence: [...o.evidence, { ...authorization, ...patch }] }]).accepted,
      ).toHaveLength(0);
  });
  it('duplicates are audited while preserving unique evidence', () => {
    const r = reconcileModelYears([target], [official(), official()], source);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]?.observation.evidence).toHaveLength(1);
    expect(r.rejectedDetails[0]?.reasonCode).toBe('DUPLICATE_OBSERVATION');
  });
  it.each(['Toyota', 'Jeep'])('cross-brand %s official and dealer rules', (brand) => {
    const t = coverageTarget(brand, 'Modelo X', 'Versão A', 'Versão A'),
      domain = brand.toLowerCase() + '.com.br',
      src = {
        ...source,
        brand,
        allowedDomains: [domain],
        allowedHosts: [domain],
        allowedSubdomainRoots: [],
      };
    const text = brand + ' Modelo X linha 2027. Versões: Versão A.';
    const a = coverageObservation(t, 2027, text, 'https://' + domain + '/support');
    const dealer = {
      ...a,
      sourceTier: 'AUTHORIZED_DEALER' as const,
      dealer: { name: 'Dealer Um', domain: 'dealer.example' },
      evidence: [
        contextEvidence('Dealer Um ' + text, 'https://dealer.example'),
        contextEvidence(
          'Concessionária Dealer Um dealer.example',
          'https://' + domain + '/locator',
          { role: 'DEALER_AUTHORIZATION' },
        ),
      ],
    };
    expect(validateModelYearSources([t], [a, dealer], src).accepted).toHaveLength(2);
  });
  it.each([
    ['INVALID_TARGET', { targetKey: 'unknown' }],
    ['INVALID_YEAR', { modelYear: NaN }],
    ['INVALID_CONFIDENCE', { confidence: 2 }],
    ['APPLICABILITY_NOT_PROVEN', { applicability: 'UNKNOWN' }],
  ])('records actual branch %s', (reason, patch) => {
    expect(
      result([{ ...official(), ...patch } as ModelYearObservation]).rejected[0]?.reasonCode,
    ).toBe(reason);
  });
  it.each([
    ['NO_EXPLICIT_MY', 'Nivus Highline sem ano explícito'],
    ['MODEL_NOT_BOUND', 'Tera linha 2026. Versões Highline.'],
    ['VERSION_NOT_BOUND', 'Nivus linha 2026. Versões GTS.'],
    ['MODEL_LINE_NOT_BOUND', 'Nivus Highline modelo 2026'],
    ['APPLICABILITY_NOT_PROVEN', 'Nivus linha 2026 não inclui Highline'],
  ])('records context branch %s', (reason, text) => {
    expect(
      result([{ ...official(), evidence: [contextEvidence(text)] }]).rejected[0]?.reasonCode,
    ).toBe(reason);
  });
});

it('audit retains rejected source even when another source supports the observation', () => {
  const o = official(),
    r = result([
      {
        ...o,
        evidence: [
          ...o.evidence,
          contextEvidence('Nivus Highline linha 2026', 'https://unapproved.example/article'),
        ],
      },
    ]);
  expect(r.accepted).toHaveLength(1);
  expect(r.rejected).toHaveLength(1);
  expect(r.rejected[0]).toMatchObject({
    sourceUrl: 'https://unapproved.example/article',
    reasonCode: 'EXTERNAL_SOURCE_NOT_APPROVED',
  });
});
