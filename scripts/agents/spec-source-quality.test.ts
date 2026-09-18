import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import {
  modelYearFixture,
  connectorOfficialSource,
  buildSpecSourceTargets,
  classifySpecLink,
  selectSourcesForTarget,
  extractDeterministicSpecs,
  assessSourceFact,
  validateObservedIdentityLink,
  provenEngineChain,
  identityLinksFromFacts,
  type SourceSnapshot,
  type ObservedIdentityLink,
  type SourceFact,
} from '@compra-car/core/agents';
import { OfficialSpecDocuments } from './spec-source-documents';
import { technicalPdfDocument, readPdfPages } from './spec-source-pdf';
import { reconstructPdfRows, classifyPdfPage } from './spec-source-pdf-quality';
import { proseFacts } from './spec-source-prose';
import { runSpecSources } from './spec-source-runtime';
import { SpecOfficialFetcher } from './spec-source-fetch';
const f = modelYearFixture('VW'),
  source = connectorOfficialSource(f.active);
const baseTarget = buildSpecSourceTargets(
  f.context,
  f.rows,
  { brand: 'VW', country: 'BR' },
  source,
).find((t) => t.modelYear === 2026)!;
const target = {
  ...baseTarget,
  officialVersionLabel: 'Comfortline 200 TSI',
  catalogVersion: 'Comfortline 1.0 TGDI AT',
};
const snapshot: SourceSnapshot = {
  sourceUrl: 'https://vw.com.br/cars/nivus.html',
  finalUrl: 'https://vw.com.br/cars/nivus.html',
  sourceKind: 'OFFICIAL_HTML',
  contentType: 'text/html',
  contentHash: 'hash',
  fetchedAt: 'fixture',
  extractorVersion: '21.4',
  targetKey: 'fixture',
};
const scope = {
  model: 'Nivus',
  version: null,
  modelYear: 2026,
  shared: false,
  matrix: false,
  currentLineup: false,
};
const binding = {
  scope,
  evidence: {
    sourceUrl: 'https://vw.com.br/manuals',
    sourceKind: 'OFFICIAL_CATALOG' as const,
    contentHash: 'index',
    locator: 'link',
    evidenceText: 'Ficha técnica Nivus 2026',
  },
};
const parse = (html: string, s = snapshot) => new OfficialSpecDocuments().parse(html, s, target);
const candidate = (path: string, label: string, t = target) =>
  classifySpecLink({ url: 'https://vw.com.br' + path, label, method: 'HTML_LINK' }, t, null, 2);
describe('21.4 deterministic role budgets', () => {
  const pool = () => [
    candidate('/cars/nivus.html', 'Nivus'),
    candidate('/configurador/nivus', 'Nivus configurador'),
    candidate('/technical-sheet-nivus-my2026.pdf', 'Ficha técnica Nivus 2026'),
    candidate('/nivus/technical2.pdf', 'Nivus dados técnicos 2026'),
    candidate('/nivus/marketing', 'Nivus'),
    candidate('/accessories/nivus', 'Nivus accessories'),
    candidate('/cars/unrelated', 'Unrelated'),
  ];
  it('reserves overview, configurator and exact MY technical source before duplicate roles', () => {
    const selected = selectSourcesForTarget(pool(), { maxSources: 3, modelYear: 2026 });
    expect(selected).toHaveLength(3);
    expect(selected.map((s) => s.candidate.url)).toContain(
      'https://vw.com.br/technical-sheet-nivus-my2026.pdf',
    );
    expect(selected.flatMap((s) => s.candidate.roles ?? [])).toEqual(
      expect.arrayContaining(['MODEL_OVERVIEW', 'CONFIGURATOR', 'TECHNICAL_DATA']),
    );
  });
  it('five slots preserve required roles and never prefer accessories', () => {
    const selected = selectSourcesForTarget(pool(), { maxSources: 5, modelYear: 2026 });
    expect(selected.every((s) => !s.candidate.url.includes('accessories'))).toBe(true);
    expect(selected[0]?.reason).toBe('MISSING_ROLE:TECHNICAL_DATA');
  });
  it('same generic algorithm works with a fictional manufacturer/model', () => {
    const t = {
      ...target,
      brand: 'Example',
      model: 'Atlas',
      officialVersionLabel: 'Tour 300 Turbo',
    };
    const selected = selectSourcesForTarget(
      [
        candidate('/atlas', 'Atlas', t),
        candidate('/configure/atlas', 'Atlas configurator', t),
        candidate('/technical-sheet-atlas-my2026.pdf', 'Atlas 2026 technical sheet', t),
        candidate('/atlas/accessories', 'Atlas accessories', t),
      ],
      { maxSources: 3, modelYear: 2026 },
    );
    expect(selected).toHaveLength(3);
    expect(selected.every((s) => !s.candidate.url.includes('accessories'))).toBe(true);
  });
  it('connectivity guide is OTHER and cannot displace a technical manual', () => {
    const guide = candidate('/manual-nivus/my26/conectado.pdf', 'Guia Conectado 2026'),
      manual = candidate('/technical-sheet-nivus/my26/sheet.pdf', 'Ficha técnica Nivus 2026');
    expect(guide.roles).toEqual(['OTHER']);
    expect(
      selectSourcesForTarget([guide, manual], { maxSources: 1, modelYear: 2026 })[0]?.candidate.url,
    ).toBe(manual.url);
  });
  it('fetches all three roles within the full five-request discovery flow', async () => {
    const connector = {
      ...f.active,
      sourceEntries: [
        { url: 'https://vw.com.br/cars', type: 'MODEL_INDEX' as const, priority: 1 },
        { url: 'https://vw.com.br/configurador', type: 'CONFIGURATOR' as const, priority: 2 },
        { url: 'https://vw.com.br/technical-sheets', type: 'OTHER_OFFICIAL' as const, priority: 3 },
      ],
    };
    const fetcher = new SpecOfficialFetcher(
      async (input) =>
        new Response(
          String(input).endsWith('/technical-sheets')
            ? '<a href="/technical-sheet-nivus-my2026.html">Ficha técnica Nivus 2026</a><a href="/manual-nivus/my26/conectado.html">Guia Conectado 2026</a>'
            : '<h1>Nivus</h1>',
          { headers: { 'content-type': 'text/html' } },
        ),
    );
    const discovery = {
      discover: vi.fn(async () => [
        { url: snapshot.finalUrl, label: 'Nivus', method: 'OFFICIAL_SEARCH' as const },
      ]),
    };
    const out = await runSpecSources(
      [target],
      connector,
      {
        provider: 'hybrid',
        mode: 'baseline',
        maxTargets: 1,
        maxSources: 5,
        maxDiscoveryDepth: 2,
        maxSemanticCalls: 1,
      },
      fetcher,
      undefined,
      discovery,
    );
    expect(out.http.map((h) => h.url)).toEqual(
      expect.arrayContaining([
        'https://vw.com.br/cars',
        'https://vw.com.br/configurador',
        snapshot.finalUrl,
        'https://vw.com.br/technical-sheets',
        'https://vw.com.br/technical-sheet-nivus-my2026.html',
      ]),
    );
    expect(out.rankedBeforeFetch.every((r) => !!r.candidates[0]?.selectionReason)).toBe(true);
  });
});
describe('21.4 page and nested applicability', () => {
  const html =
    '<title>Nivus | Fabricante</title><h1>Conheça nosso SUV</h1><section><h2>Motor 200 TSI</h2><p>O motor 200 TSI, de 128 cv, entrega torque de 200 Nm.</p></section>';
  it('final URL/title bind model without repeating it in every technical paragraph', () => {
    const doc = parse(html),
      out = extractDeterministicSpecs(target, doc);
    expect(doc.pageContext?.modelBinding).toBe('EXACT_MODEL');
    expect(out.observations.length).toBeGreaterThan(0);
    expect(out.rejections).not.toContain('MODEL_NOT_BOUND');
    expect(
      out.observations.every(
        (o) =>
          o.applicability.modelBinding === 'EXACT_MODEL' &&
          o.applicability.versionBinding === 'MODEL_SHARED' &&
          o.applicability.yearBinding === 'UNRESOLVED',
      ),
    ).toBe(true);
  });
  it('model page evidence never proves requested year or exact version by itself', () => {
    const out = extractDeterministicSpecs(target, parse(html)).observations;
    expect(
      out.every(
        (o) =>
          o.applicability.yearBinding !== 'EXACT_MY' &&
          o.applicability.versionBinding !== 'EXACT_VERSION',
      ),
    ).toBe(true);
  });
  it('nested version section can strengthen ownership while outer facts stay shared', () => {
    const doc = parse(
      html +
        '<section><h2>Comfortline 200 TSI</h2><section><h3>Equipamentos</h3><dl><dt>Transmissão</dt><dd>Automático</dd></dl></section></section><section><h2>GTS 250 TSI</h2><dl><dt>Potência</dt><dd>150 cv</dd></dl></section>',
    );
    const out = extractDeterministicSpecs(target, doc);
    expect(
      out.observations.find((o) => o.observation.rawValue === 'Automático')?.applicability
        .versionBinding,
    ).toBe('EXACT_VERSION');
    expect(out.observations.some((o) => o.observation.parsedValue === 150)).toBe(false);
  });
  it('other-model explicit container cannot inherit target model', () => {
    const out = extractDeterministicSpecs(
      target,
      parse('<section data-model="Other"><dl><dt>Potência</dt><dd>999 cv</dd></dl></section>'),
    );
    expect(out.observations).toEqual([]);
    expect(out.rejections).toContain('MODEL_NOT_BOUND');
  });
  it('generic lineup multiple model containers do not globally bind a requested model', () => {
    const doc = parse(
      '<section data-model="Nivus"></section><section data-model="Other"></section><p>Potência: 999 cv</p>',
      { ...snapshot, finalUrl: 'https://vw.com.br/cars' },
    );
    expect(doc.pageContext?.modelBinding).toBe('UNRESOLVED');
  });
  it('explicit current lineup stays CURRENT_LINEUP, not exact MY', () => {
    const doc = parse('<h1>Nivus — linha atual</h1><p>Potência: 128 cv</p>');
    expect(extractDeterministicSpecs(target, doc).observations[0]?.applicability.yearBinding).toBe(
      'CURRENT_LINEUP',
    );
  });
});
describe('21.4 PDF quality and trace', () => {
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/spec-pdf-quality-pages.json', import.meta.url), 'utf8'),
  ) as { pages: { page: number; text: string }[] };
  const pdf = {
    ...snapshot,
    sourceKind: 'OFFICIAL_MANUAL' as const,
    contentType: 'application/pdf',
  };
  it('full engine labels survive raw -> normalized -> parsed while groups remain separate', () => {
    const doc = technicalPdfDocument(fixture.pages, pdf, binding),
      out = extractDeterministicSpecs(target, doc);
    expect(doc.facts.filter((f) => f.label === 'Motor').map((f) => f.value)).toEqual([
      '1.0 TOTALFLEX 85/94 kW - TSI',
      '1.4 TOTALFLEX 110/110 kW - TSI',
    ]);
    expect(doc.facts.find((f) => f.value === '999')?.scope.engineDesignation).toBe(
      'Motor 1.0 TOTALFLEX 85/94 kW - TSI',
    );
    expect(doc.facts.find((f) => f.value === '1395')?.scope.engineDesignation).toBe(
      'Motor 1.4 TOTALFLEX 110/110 kW - TSI',
    );
    expect(
      out.observations.every(
        (o) =>
          o.applicability.versionBinding === 'UNRESOLVED' &&
          o.applicability.yearBinding === 'EXACT_MY',
      ),
    ).toBe(true);
    expect(JSON.stringify(doc.audit)).toContain('rawPageText');
    expect(JSON.stringify(doc.audit)).toContain('structuredBlocks');
    expect(doc.rejectedFacts?.map((f) => f.reason)).toEqual(
      expect.arrayContaining(['INDEX_REFERENCE', 'GLOSSARY_DEFINITION']),
    );
  });
  it('positioned table rows preserve full text cells and coordinate ordering', () => {
    const rows = reconstructPdfRows([
      { text: '999 cm3', x: 220, y: 100, width: 55, height: 10 },
      { text: 'Cilindrada', x: 20, y: 100, width: 60, height: 10 },
      { text: 'Motor 1.0 TOTALFLEX', x: 20, y: 120, width: 180, height: 10 },
    ]);
    expect(rows[0]?.text).toBe('Motor 1.0 TOTALFLEX');
    expect(rows[1]?.cells.map((c) => c.text)).toEqual(['Cilindrada', '999 cm3']);
  });
  it('worker preserves raw page text and positioned spans using existing PDF.js', async () => {
    const pages = await readPdfPages(
      readFileSync(new URL('./fixtures/spec-technical-manual.pdf', import.meta.url)),
    );
    expect(pages[1]?.rawPageText).toContain('128');
    expect(pages[1]?.spans?.some((s) => s.text.includes('128') && Number.isFinite(s.x))).toBe(true);
  }, 20000);
  it.each([
    ['Índice remissivo\nTransmissão automática ........ 265', 'INDEX'],
    ['Sumário\nDados técnicos .... 258', 'TABLE_OF_CONTENTS'],
    [
      'Abreviaturas\nAQ 250 Transmissão automática de 6 marchas motor TSI.',
      'GLOSSARY_OR_DEFINITION',
    ],
    ['Dados técnicos\nMotor 1.0 TOTALFLEX\nCilindrada 999 cm3', 'TECHNICAL_DATA'],
  ])('classifies %s without using page number', (text, role) =>
    expect(classifyPdfPage(text)).toBe(role),
  );
  it('index/glossary examples never emit vehicle observations', () => {
    const doc = technicalPdfDocument(fixture.pages.slice(2), pdf, binding);
    expect(extractDeterministicSpecs(target, doc).observations).toEqual([]);
  });
  it('regex capture, not PDF extraction, caused 21.3 truncation', () => {
    const text = 'Motor 1.0 TOTALFLEX 85/94 kW - TSI';
    const old =
      /\b([Mm]otor)\s+(\d{2,4}\s*[A-Z]{2,4}|[Tt]\d{3}|\d[.,]\d(?:\s*(?:turbo|[A-Z]{2,4}))?)/u.exec(
        text,
      );
    expect(old?.[2]).toBe('1.0 TOTA');
    expect(
      proseFacts({ text, locator: 'fixture', scope }).find((f) => f.label === 'Motor')?.value,
    ).toBe('1.0 TOTALFLEX');
  });
});
describe('21.4 quality and explicit identity links', () => {
  const fact: SourceFact = {
    label: 'Cilindrada',
    value: '999',
    unit: 'cm3',
    text: 'Cilindrada 999 cm3',
    locator: 'page/258',
    scope: { ...scope, engineDesignation: 'Motor 1.0 TOTALFLEX' },
    method: 'PDF_TEXT',
  };
  it('unknown exact version is useful UNRESOLVED quality, not rejection', () =>
    expect(assessSourceFact(fact, target)).toMatchObject({ state: 'UNRESOLVED' }));
  it('rejects truncated source token and non-verbatim values', () => {
    expect(
      assessSourceFact(
        { ...fact, value: '1.0 TOTA', unit: null, text: 'Motor 1.0 TOTALFLEX' },
        target,
      ).reason,
    ).toBe('TRUNCATED_SOURCE_TEXT');
    expect(assessSourceFact({ ...fact, value: '1998' }, target).reason).toBe(
      'EVIDENCE_NOT_VERBATIM',
    );
  });
  it('dedupes repeated source facts but never collapses different engine groups', () => {
    const doc = {
      snapshot,
      facts: [
        fact,
        { ...fact, locator: 'another' },
        {
          ...fact,
          scope: { ...scope, engineDesignation: 'Motor 1.4 TOTALFLEX' },
          locator: 'page/259',
        },
      ],
      sections: [],
      links: [],
      issues: [],
    };
    const out = extractDeterministicSpecs(target, doc);
    expect(out.observations).toHaveLength(2);
    expect(out.rejections).toContain('DUPLICATE_SOURCE_FACT');
  });
  const evidence = (text: string, url: string) => ({
    sourceUrl: url,
    sourceKind: 'OFFICIAL_HTML' as const,
    contentHash: 'h',
    locator: 'section',
    evidenceText: text,
  });
  const a: ObservedIdentityLink = {
    sourceA: 'https://vw.com.br/configurador',
    sourceB: 'https://vw.com.br/configurador',
    from: { kind: 'VERSION', label: 'Comfortline 200 TSI' },
    to: { kind: 'ENGINE_DESIGNATION', label: '200 TSI' },
    model: 'Nivus',
    modelYear: 2026,
    evidence: [
      evidence(
        'Nivus MY2026 Comfortline 200 TSI — Motor: 200 TSI',
        'https://vw.com.br/configurador',
      ),
    ],
  };
  const b: ObservedIdentityLink = {
    sourceA: snapshot.finalUrl,
    sourceB: snapshot.finalUrl,
    from: { kind: 'ENGINE_GROUP', label: 'Motor 1.0 TOTALFLEX' },
    to: { kind: 'ENGINE_DESIGNATION', label: '200 TSI' },
    model: 'Nivus',
    modelYear: 2026,
    evidence: [
      evidence('Nivus MY2026 Motor 1.0 TOTALFLEX — designação 200 TSI', snapshot.finalUrl),
    ],
  };
  it('each identity edge requires evidence naming both ends', () => {
    expect(validateObservedIdentityLink(a)).toBe(true);
    expect(validateObservedIdentityLink({ ...a, modelYear: 2025 })).toBe(false);
    expect(validateObservedIdentityLink({ ...a, model: 'Other' })).toBe(false);
    expect(validateObservedIdentityLink({ ...a, evidence: [] })).toBe(false);
    expect(
      validateObservedIdentityLink({ ...b, evidence: [evidence('Nivus', snapshot.finalUrl)] }),
    ).toBe(false);
  });
  it('no Comfortline -> 1.0 inference from name, model or shared year', () => {
    expect(provenEngineChain(fact.scope, target.officialVersionLabel, [a])).toBeNull();
    expect(
      provenEngineChain(fact.scope, target.officialVersionLabel, [{ ...a, modelYear: 2027 }, b]),
    ).toBeNull();
    expect(provenEngineChain(fact.scope, target.officialVersionLabel, [a, b])).toHaveLength(2);
  });
  it('observed fuel/transmission relations stay source-native and exclude unknown output fields', () => {
    const links = identityLinksFromFacts(
      [
        {
          ...fact,
          label: 'Combustível',
          value: 'Total Flex',
          unit: null,
          text: 'Combustível: Total Flex',
          scope: {
            ...scope,
            version: target.officialVersionLabel,
            evidenceText: 'Nivus MY2026 Comfortline 200 TSI',
          },
        },
      ],
      snapshot,
    );
    expect(links[0]?.to).toEqual({ kind: 'FUEL', label: 'Total Flex' });
    for (const key of [
      'specCode',
      'equipmentId',
      'canonicalSpec',
      'productSpecId',
      'productionYear',
    ])
      expect(JSON.stringify(links)).not.toContain(key);
  });
});
