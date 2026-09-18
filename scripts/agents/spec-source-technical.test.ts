import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import {
  buildSpecSourceTargets,
  connectorOfficialSource,
  modelYearFixture,
  classifySpecLink,
  extractDeterministicSpecs,
  validateSemanticSpecs,
  type SourceSnapshot,
} from '@compra-car/core/agents';
import { OfficialSpecDocuments } from './spec-source-documents';
import { OfficialSpecPdf, technicalPdfDocument, readPdfPages } from './spec-source-pdf';
import { extractSpecDiscoveryLinks } from './spec-source-discovery';
import { SpecOfficialFetcher } from './spec-source-fetch';
import { runSpecSources } from './spec-source-runtime';
const fixture = modelYearFixture('VW'),
  source = connectorOfficialSource(fixture.active);
const resolved = buildSpecSourceTargets(
  fixture.context,
  fixture.rows,
  { brand: 'VW', country: 'BR' },
  source,
).find((t) => t.modelYear === 2026)!;
const target = {
  ...resolved,
  officialVersionLabel: 'Comfortline 200 TSI',
  catalogVersion: 'Comfortline 1.0 TGDI AT',
};
const snapshot: SourceSnapshot = {
  sourceUrl: 'https://vw.com.br/nivus',
  finalUrl: 'https://vw.com.br/nivus',
  sourceKind: 'OFFICIAL_HTML',
  contentType: 'text/html',
  contentHash: 'fixture',
  fetchedAt: '2026-09-16',
  extractorVersion: '21.3',
  targetKey: 'fixture',
};
const parse = (html: string) => new OfficialSpecDocuments().parse(html, snapshot, target);
const html = readFileSync(
  new URL('./fixtures/spec-technical-sections.html', import.meta.url),
  'utf8',
);
const binding = {
  scope: {
    model: 'Nivus',
    modelYear: 2026,
    version: null,
    shared: false,
    matrix: false,
    currentLineup: false,
  },
  evidence: {
    sourceUrl: 'https://vw.com.br/manuais',
    sourceKind: 'OFFICIAL_CATALOG' as const,
    contentHash: 'parent',
    locator: 'link/manual',
    evidenceText: 'Manual Nivus 2026',
  },
};
describe('21.3 grounded technical extraction', () => {
  it('model prose atomizes one paragraph with multiple technical values', () => {
    const out = extractDeterministicSpecs(target, parse(html)).observations;
    expect(
      out.some((o) => o.observation.parsedValue === 128 && o.observation.rawUnit === 'cv'),
    ).toBe(true);
    expect(
      out.some((o) => o.observation.parsedValue === 200 && o.observation.rawUnit === 'Nm'),
    ).toBe(true);
    expect(out.find((o) => o.observation.parsedValue === 128)?.applicability).toMatchObject({
      versionBinding: 'MODEL_SHARED',
      yearBinding: 'UNRESOLVED',
    });
  });
  it('bullets and card pairs preserve raw units', () => {
    const out = extractDeterministicSpecs(target, parse(html)).observations;
    expect(out.some((o) => o.observation.parsedValue === 4266)).toBe(true);
    expect(
      out.some((o) => o.observation.parsedValue === 415 && o.observation.rawUnit === 'L'),
    ).toBe(true);
  });
  it('exact configurator card yields exact version, never neighboring values', () => {
    const out = extractDeterministicSpecs(target, parse(html));
    expect(
      out.observations
        .filter((o) => o.applicability.versionBinding === 'EXACT_VERSION')
        .map((o) => o.observation.rawValue),
    ).toEqual(['Total Flex', 'Automático']);
    expect(
      out.observations.some((o) => [129, 150, 116].includes(o.observation.parsedValue as number)),
    ).toBe(false);
    expect(out.rejections.filter((r) => r === 'VERSION_MISMATCH')).toHaveLength(3);
  });
  it('missing MY never inherits target MY', () => {
    const out = extractDeterministicSpecs(
      target,
      parse(html.replace(' data-model-year="2026"', '')),
    ).observations;
    expect(out.every((o) => o.applicability.yearBinding === 'UNRESOLVED')).toBe(true);
  });
  it('explicit old card MY is rejected', () => {
    const out = extractDeterministicSpecs(
      target,
      parse(html.replace('data-model-year="2026"', 'data-model-year="2025"')),
    ).observations;
    expect(out.some((o) => o.applicability.versionBinding === 'EXACT_VERSION')).toBe(false);
  });
  it('serialized manufacturer cards maintain MY and sibling boundaries', () => {
    const card = (name: string, my: string, fuel: string) => ({
      type: 'trim',
      data: {
        name,
        engines: [
          { key: { modelYear: my, modelId: name }, engineTypes: [fuel], gearTypes: ['Automático'] },
        ],
      },
    });
    const data = {
      type: 'carline',
      data: { name: 'Nivus' },
      children: [
        card('Comfortline 200 TSI', '2026', 'Total Flex'),
        card('GTS 250 TSI', '2026', 'Gasolina'),
        card('Sense 200 TSI', '2027', 'Flex'),
      ],
    };
    const doc = parse(
      '<script type="x-feature-hub/serialized-states">' +
        encodeURIComponent(JSON.stringify(data)) +
        '</script>',
    );
    const out = extractDeterministicSpecs(target, doc);
    expect(out.observations.map((o) => o.observation.rawValue)).toEqual([
      'Total Flex',
      'Automático',
    ]);
    expect(
      out.observations.every(
        (o) =>
          o.applicability.versionBinding === 'EXACT_VERSION' &&
          o.applicability.yearBinding === 'EXACT_MY',
      ),
    ).toBe(true);
  });
  it('known wrong MY in serialized card prevents DOM card from relabeling it unknown', () => {
    const data = {
      type: 'carline',
      data: { name: 'Nivus' },
      children: [
        {
          type: 'trim',
          data: {
            name: 'Comfortline 200 TSI',
            engines: [{ key: { modelYear: '2027' }, engineTypes: ['Total Flex'] }],
          },
        },
      ],
    };
    const doc = parse(
      '<script type="application/json">' +
        JSON.stringify(data) +
        '</script>' +
        html.replace(' data-model-year="2026"', ''),
    );
    expect(
      extractDeterministicSpecs(target, doc).observations.some(
        (o) => o.applicability.versionBinding === 'EXACT_VERSION',
      ),
    ).toBe(false);
  });
  it('semantic prose allows bounded literal verb relation, rejects other-value reassignment', () => {
    const scope = binding.scope,
      text = 'Potência desenvolve 128 cv; Torque: 200 Nm';
    const input = { target, snapshot, sections: [{ locator: 'p', text, scope }] };
    const fact = {
      locator: 'p',
      observedLabel: 'Potência',
      rawValue: '128',
      rawUnit: 'cv',
      evidenceText: text,
      extractionConfidence: 0.7,
    };
    expect(validateSemanticSpecs(input, [fact]).observations[0]?.applicability.versionBinding).toBe(
      'UNRESOLVED',
    );
    expect(
      validateSemanticSpecs(input, [{ ...fact, rawValue: '200', rawUnit: 'Nm' }]).observations,
    ).toEqual([]);
    expect(
      validateSemanticSpecs(input, [{ ...fact, extractionConfidence: 2 }]).observations,
    ).toEqual([]);
  });
  it('source observations have no canonical fields', () => {
    const observations = extractDeterministicSpecs(target, parse(html)).observations;
    expect(observations.length).toBeGreaterThan(0);
    for (const key of [
      'specCode',
      'equipmentId',
      'canonicalSpec',
      'productSpecId',
      'productionYear',
    ])
      expect(JSON.stringify(observations)).not.toContain('"' + key + '"');
  });
});
describe('21.3 ranking and manuals', () => {
  const links = extractSpecDiscoveryLinks(
    readFileSync(new URL('./fixtures/spec-ranking-pool.html', import.meta.url), 'utf8'),
    'https://vw.com.br',
  );
  const candidates = links.map((l) => classifySpecLink(l, target, null, 2));
  it('manual MY2026 and configurator precede accessories with explained scores', () => {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    expect(sorted[0]!.url).toContain('manual-nivus-2026');
    const accessory = sorted.findIndex((c) => c.url.includes('/acessorios'));
    expect(accessory).toBeGreaterThan(sorted.findIndex((c) => c.url.includes('configurador')));
    for (const c of sorted) expect(c.score).toBe(c.scoreReasons.reduce((v, r) => v + r.delta, 0));
  });
  it('generic manuals path containing services/accessories is not accessory product', () => {
    const c = classifySpecLink(
      {
        url: 'https://vw.com.br/servicos-e-acessorios/manuais.html',
        label: 'Manuais',
        method: 'HTML_LINK',
      },
      target,
      null,
      2,
    );
    expect(c.scoreReasons.some((r) => r.reason === 'ACCESSORIES_LIFESTYLE')).toBe(false);
    expect(c.rejectionReason).toBe('SOURCE_KIND_EXCLUDED');
  });
  it('local model heading enriches a year-only manual anchor', () => {
    const links = extractSpecDiscoveryLinks(
      '<section><h2>Nivus</h2><a href="/literatura/document.pdf">Manual 2026</a></section>',
      'https://vw.com.br',
    );
    const c = classifySpecLink(links[0]!, target, null, 2);
    expect(c.targetBindingSignals).toContain('MODEL_NAME');
    expect(c.myBindingSignals).toContain('MY_CANDIDATE:2026');
  });
  it('bounded fetch budget chooses manual ahead of accessory and emits ranking BEFORE GET', async () => {
    const connector = {
      ...fixture.active,
      sourceEntries: [{ type: 'MODEL_INDEX' as const, url: 'https://vw.com.br/cars', priority: 1 }],
    };
    const order: string[] = [];
    const transport = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      order.push('fetch:' + url);
      return new Response(
        String(url).endsWith('/cars')
          ? readFileSync(new URL('./fixtures/spec-ranking-pool.html', import.meta.url), 'utf8')
          : '<h1>Nivus</h1>',
        { headers: { 'content-type': 'text/html' } },
      );
    });
    const out = await runSpecSources(
      [target],
      connector,
      {
        provider: 'structured',
        mode: 'baseline',
        maxTargets: 1,
        maxSources: 2,
        maxDiscoveryDepth: 2,
        maxSemanticCalls: 0,
      },
      new SpecOfficialFetcher(transport),
      undefined,
      undefined,
      (r) => order.push('rank:' + r[0]!.url),
    );
    expect(order[2]).toContain('rank:');
    expect(order[3]).toContain('configurador/nivus');
    expect(out.http.some((h) => h.url.includes('/acessorios'))).toBe(false);
  });
});
describe('21.3 PDF local text boundary', () => {
  const pdfSnapshot = {
    ...snapshot,
    contentType: 'application/pdf',
    sourceKind: 'OFFICIAL_MANUAL' as const,
  };
  it('reads actual text PDF bytes, technical pages and locators without OCR', async () => {
    const bytes = readFileSync(new URL('./fixtures/spec-technical-manual.pdf', import.meta.url));
    const pages = await readPdfPages(bytes);
    expect(pages).toHaveLength(3);
    const doc = await new OfficialSpecPdf().parse(bytes, pdfSnapshot, binding);
    expect(doc.facts.some((f) => f.value === '128' && f.locator.includes('pdf/page/2'))).toBe(true);
    const out = extractDeterministicSpecs(target, doc).observations;
    expect(out.length).toBeGreaterThan(0);
    expect(
      out.every(
        (o) =>
          o.applicability.versionBinding === 'UNRESOLVED' &&
          o.applicability.yearBinding === 'EXACT_MY',
      ),
    ).toBe(true);
  }, 20000);
  it('preserves engine groups without binding either to Comfortline', () => {
    const doc = technicalPdfDocument(
      [{ page: 20, text: 'Dados técnicos\nMotor A\nPotência: 128 cv\nMotor B\nPotência: 150 cv' }],
      pdfSnapshot,
      binding,
    );
    expect(
      doc.facts.filter((f) => f.label === 'Potência').map((f) => f.scope.engineDesignation),
    ).toEqual(['Motor A', 'Motor B']);
    expect(
      extractDeterministicSpecs(target, doc).observations.every(
        (o) => o.applicability.versionBinding === 'UNRESOLVED',
      ),
    ).toBe(true);
  });
  it('manual equipment mention never asserts exact-version fitment', () => {
    const doc = technicalPdfDocument(
      [
        {
          page: 20,
          text: 'Dados técnicos\nACC: disponível\nTeto solar: disponível\nPotência: 128 cv',
        },
      ],
      pdfSnapshot,
      binding,
    );
    expect(
      extractDeterministicSpecs(target, doc).observations.every(
        (o) => o.applicability.versionBinding === 'UNRESOLVED',
      ),
    ).toBe(true);
  });
  it('ambiguous multi-engine row is not collapsed into one version', () => {
    const doc = technicalPdfDocument(
      [{ page: 2, text: 'Dados técnicos\nPotência: 128 cv 150 cv' }],
      pdfSnapshot,
      binding,
    );
    expect(doc.facts).toEqual([]);
    expect(doc.issues).toContain('PDF_MULTIPLE_ENGINE_VALUES_UNRESOLVED');
  });
  it('no explicit binding leaves model unresolved and produces no attributed facts', () => {
    expect(
      extractDeterministicSpecs(
        target,
        technicalPdfDocument([{ page: 2, text: 'Dados técnicos\nPotência: 128 cv' }], pdfSnapshot),
      ).observations,
    ).toEqual([]);
  });
  it('rejects non-PDF signature before spawning a parser', async () => {
    await expect(readPdfPages(new Uint8Array([1, 2, 3]))).rejects.toThrow('INVALID_PDF_SIGNATURE');
  });
  it('PDF gets separate size ceiling without relaxing HTML', async () => {
    const bytes = new Uint8Array(100);
    bytes.set(Buffer.from('%PDF-'));
    const fetcher = new SpecOfficialFetcher(
      async () => new Response(bytes, { headers: { 'content-type': 'application/pdf' } }),
      1000,
      10,
      100,
    );
    expect((await fetcher.fetch(snapshot.sourceUrl, source, target)).bytes.length).toBe(100);
    await expect(
      new SpecOfficialFetcher(
        async () => new Response(bytes, { headers: { 'content-type': 'text/html' } }),
        1000,
        10,
        100,
      ).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('SOURCE_TOO_LARGE');
  });
});

it('heading plus nearby value text is parsed without a paragraph', () => {
  const out = extractDeterministicSpecs(
    target,
    parse('<h1>Nivus</h1><section><h2>Potência</h2><div>128 cv</div></section>'),
  ).observations;
  expect(out.some((o) => o.observation.parsedValue === 128)).toBe(true);
});
it('PDF source row with unit before value is retained unresolved', () => {
  const doc = technicalPdfDocument(
    [{ page: 4, text: 'Dados técnicos\nCilindrada cm3 999' }],
    { ...snapshot, contentType: 'application/pdf' },
    binding,
  );
  expect(doc.facts[0]).toMatchObject({ label: 'Cilindrada', value: '999', unit: 'cm3' });
});
it('PDF value and parent index MY evidence have distinct URLs and hashes', async () => {
  const connector = {
    ...fixture.active,
    sourceEntries: [
      { type: 'MODEL_INDEX' as const, url: 'https://vw.com.br/manuais', priority: 1 },
    ],
  };
  const bytes = readFileSync(new URL('./fixtures/spec-technical-manual.pdf', import.meta.url));
  const transport = vi.fn(async (url: Parameters<typeof fetch>[0]) =>
    String(url).endsWith('.pdf')
      ? new Response(bytes, { headers: { 'content-type': 'application/pdf' } })
      : new Response(
          '<section><h2>Nivus</h2><a href="/literatura/manual-nivus-2026.pdf">Manual Nivus 2026</a></section>',
          { headers: { 'content-type': 'text/html' } },
        ),
  );
  const out = await runSpecSources(
    [target],
    connector,
    {
      provider: 'structured',
      mode: 'baseline',
      maxTargets: 1,
      maxSources: 2,
      maxDiscoveryDepth: 2,
      maxSemanticCalls: 0,
    },
    new SpecOfficialFetcher(transport),
  );
  expect(out.observations).toEqual([]);
  expect(transport).not.toHaveBeenCalled();
  expect(out.discoveryGraph[0]?.rejectionReason).toBe('SOURCE_KIND_EXCLUDED');
}, 20000);

it('explicit PDF MY contradicting its index is rejected', () => {
  const doc = technicalPdfDocument(
    [{ page: 1, text: 'MY2025\nDados técnicos\nPotência: 128 cv' }],
    { ...snapshot, contentType: 'application/pdf' },
    binding,
  );
  expect(doc.facts).toEqual([]);
  expect(doc.issues).toContain('PDF_MY_MISMATCH');
});

it('five-source budget covers manual, configurator and model before duplicate indexes/accessories', async () => {
  const connector = {
    ...fixture.active,
    sourceEntries: [
      { type: 'MODEL_INDEX' as const, url: 'https://vw.com.br/cars', priority: 1 },
      { type: 'OTHER_OFFICIAL' as const, url: 'https://vw.com.br/manuais', priority: 2 },
      { type: 'CONFIGURATOR' as const, url: 'https://vw.com.br/configurador', priority: 3 },
    ],
  };
  const transport = vi.fn(
    async (url: Parameters<typeof fetch>[0]) =>
      new Response(
        String(url).endsWith('/cars')
          ? '<a href="/manuais/garantia">Manuais</a><a href="/acessorios/nivus">Nivus acessórios</a>'
          : String(url).endsWith('/manuais')
            ? '<a href="/manual-nivus-2026.html">Manual Nivus 2026</a>'
            : '<h1>Nivus</h1>',
        { headers: { 'content-type': 'text/html' } },
      ),
  );
  const discovery = {
    discover: vi.fn(async () => [
      { url: 'https://vw.com.br/cars/nivus', label: 'Nivus', method: 'OFFICIAL_SEARCH' as const },
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
    new SpecOfficialFetcher(transport),
    undefined,
    discovery,
  );
  expect(out.http.map((h) => h.url)).toEqual([
    'https://vw.com.br/cars',
    'https://vw.com.br/configurador',
    'https://vw.com.br/cars/nivus',
  ]);
  expect(out.http.some((h) => h.url.includes('acessorios'))).toBe(false);
});
