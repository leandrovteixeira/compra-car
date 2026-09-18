import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSpecSourceTargets,
  connectorOfficialSource,
  modelYearFixture,
  extractDeterministicSpecs,
  specTargetKey,
  type SourceSnapshot,
} from '@compra-car/core/agents';
import { SpecOfficialFetcher, specOfficialUrl } from './spec-source-fetch';
import { OfficialSpecDocuments } from './spec-source-documents';
import { runSpecSources } from './spec-source-runtime';
import { parseSpecSourceArguments } from './run-spec-source';
const fixture = modelYearFixture('Jeep'),
  source = connectorOfficialSource(fixture.active);
const target = buildSpecSourceTargets(
  fixture.context,
  fixture.rows,
  { country: 'BR', brand: 'Jeep' },
  source,
).find((t) => t.modelYear === 2026)!;
const snapshot: SourceSnapshot = {
  sourceUrl: 'https://jeep.com.br/commander',
  finalUrl: 'https://jeep.com.br/commander',
  sourceKind: 'OFFICIAL_HTML',
  contentType: 'text/html',
  contentHash: 'fixture',
  fetchedAt: '2026-09-16',
  extractorVersion: '1',
  targetKey: specTargetKey(target),
};
const parser = new OfficialSpecDocuments();
const extract = (html: string) => extractDeterministicSpecs(target, parser.parse(html, snapshot));
const wrap = (html: string) =>
  '<section data-model="Commander" data-version="Longitude T270" data-model-year="2026">' +
  html +
  '</section>';
describe('format adapters and applicability', () => {
  it('Jeep golden: T270 receives 1.3, never nearby 1.995/2.0', () => {
    const result = extract(
      readFileSync(new URL('./fixtures/spec-source-jeep-matrix.html', import.meta.url), 'utf8'),
    );
    expect(result.observations.map((o) => o.observation.parsedValue)).toEqual([1.3, 185]);
    expect(
      result.observations.every((o) => o.applicability.versionBinding === 'VERSION_MATRIX'),
    ).toBe(true);
    expect(result.rejections.filter((r) => r === 'VERSION_MISMATCH')).toHaveLength(5);
  });
  it('structured two-column table', () =>
    expect(
      extract(
        wrap(
          '<table><tr><th>Item</th><th>Valor</th></tr><tr><td>Torque</td><td>270 Nm</td></tr></table>',
        ),
      ).observations[0],
    ).toMatchObject({
      observation: { parsedValue: 270, parsedUnit: 'Nm' },
      extraction: { method: 'STRUCTURED_TABLE' },
    }));
  it('DOM label/value', () =>
    expect(
      extract(wrap('<dl><dt>Potência</dt><dd>185 cv</dd></dl>')).observations[0],
    ).toMatchObject({ extraction: { method: 'DOM_PAIR' }, observation: { parsedValue: 185 } }));
  it('feature columns bind only target version', () =>
    expect(
      extract(
        '<section data-model="Commander"><table><tr><th>Item</th><th>Longitude T270</th><th>Other</th></tr><tr><td>Teto solar</td><td>não disponível</td><td>disponível</td></tr></table></section>',
      ).observations.map((o) => o.observation.polarity),
    ).toEqual(['EXPLICIT_NEGATIVE']));
  it('version attributes override enclosing version', () =>
    expect(
      extract(wrap('<section data-version="Other"><dl><dt>Motor</dt><dd>2.0</dd></dl></section>'))
        .observations,
    ).toEqual([]));
  it('nested MY override rejects wrong MY', () =>
    expect(
      extract(wrap('<section data-model-year="2025"><dl><dt>Motor</dt><dd>1.3</dd></dl></section>'))
        .rejections,
    ).toEqual(['MY_MISMATCH']));
  it('embedded JSON-LD PropertyValue', () => {
    const item = {
      '@type': 'Car',
      model: 'Commander',
      vehicleConfiguration: 'Longitude T270',
      vehicleModelDate: '2026',
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Torque', value: 270, unitText: 'Nm' },
      ],
    };
    expect(
      extract('<script type="application/ld+json">' + JSON.stringify(item) + '</script>')
        .observations[0],
    ).toMatchObject({
      observation: { parsedValue: 270 },
      extraction: { method: 'STRUCTURED_JSON' },
    });
  });
  it('does not recursively mix arbitrary JSON objects', () =>
    expect(
      extract(
        '<script type="application/json">{"model":"Commander","engines":[{"power":272}]}</script>',
      ).observations,
    ).toEqual([]));
  it('PDF boundary reports unsupported', () =>
    expect(parser.parse('bytes', { ...snapshot, contentType: 'application/pdf' }).issues).toEqual([
      'PDF_UNSUPPORTED',
    ]));
  it('plain page title is not exact version evidence', () =>
    expect(extract('<h1>Commander</h1><dl><dt>Motor</dt><dd>2.0</dd></dl>').observations).toEqual(
      [],
    ));
});
describe('safe ordinary official GET', () => {
  it('accepts connector-approved URL', () =>
    expect(specOfficialUrl('https://jeep.com.br/commander', source)).toBeTruthy());
  it.each([
    'https://example.com/car',
    'http://jeep.com.br/car',
    'file:///car',
    'https://user:pass@jeep.com.br/car',
    'https://jeep.com.br:444/car',
    'https://media.jeep.com.br/car',
    'https://jeep.com.br/imprensa/car',
    'https://jeep.com.br/car?token=secret',
  ])('denies %s', (url) => expect(specOfficialUrl(url, source)).toBeNull());
  it('denies private literal address even in connector', () =>
    expect(
      specOfficialUrl('https://127.0.0.1/', { ...source, allowedHosts: ['127.0.0.1'] }),
    ).toBeNull());
  it('rejects redirect outside before sending second request', async () => {
    const transport = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: 'https://outside.example/' } }),
    );
    await expect(
      new SpecOfficialFetcher(transport).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('UNSAFE_REDIRECT');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('safe redirect records requests and hash', async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: '/commander/specs' } }),
      )
      .mockResolvedValueOnce(new Response('abc', { headers: { 'content-type': 'text/html' } }));
    const f = new SpecOfficialFetcher(transport),
      result = await f.fetch(snapshot.sourceUrl, source, target);
    expect(result.snapshot.contentHash).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(f.audit.map((a) => a.status)).toEqual([302, 200]);
    expect(f.audit[1]?.bytes).toBe(3);
    expect(transport.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });
  it.each([403, 429])('stops on %s without retry', async (status) => {
    const transport = vi.fn(async () => new Response('denied', { status }));
    await expect(
      new SpecOfficialFetcher(transport).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('STRUCTURED_SOURCE_UNAVAILABLE');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('stops on challenge HTML', async () =>
    await expect(
      new SpecOfficialFetcher(
        async () =>
          new Response('verify you are human', { headers: { 'content-type': 'text/html' } }),
      ).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('STRUCTURED_SOURCE_UNAVAILABLE'));
  it('enforces streamed size', async () =>
    await expect(
      new SpecOfficialFetcher(
        async () => new Response('12345', { headers: { 'content-type': 'text/html' } }),
        100,
        4,
      ).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('SOURCE_TOO_LARGE'));
  it('rejects unknown MIME', async () =>
    await expect(
      new SpecOfficialFetcher(
        async () => new Response('abc', { headers: { 'content-type': 'image/png' } }),
      ).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('UNSUPPORTED_CONTENT_TYPE'));
  it('enforces abort deadline', async () => {
    const transport: typeof fetch = async (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('abort'))),
      );
    await expect(
      new SpecOfficialFetcher(transport, 10).fetch(snapshot.sourceUrl, source, target),
    ).rejects.toThrow('SOURCE_TIMEOUT');
  });
});
describe('bounded pipeline and CLI', () => {
  const connector = {
    ...fixture.active,
    sourceEntries: [{ type: 'MODEL_PAGE' as const, url: snapshot.sourceUrl, priority: 1 }],
  };
  const options = {
    provider: 'hybrid' as const,
    mode: 'baseline' as const,
    maxTargets: 1,
    maxSources: 3,
    maxSemanticCalls: 1,
  };
  it('deterministic facts prevent unnecessary semantic call', async () => {
    const semantic = { extract: vi.fn() },
      fetcher = new SpecOfficialFetcher(
        async () =>
          new Response(wrap('<dl><dt>Torque</dt><dd>270 Nm</dd></dl>'), {
            headers: { 'content-type': 'text/html' },
          }),
      );
    const result = await runSpecSources(
      [target],
      connector,
      { ...options, provider: 'structured' },
      fetcher,
      semantic,
    );
    expect(result.observations).toHaveLength(1);
    expect(semantic.extract).not.toHaveBeenCalled();
    expect(result.metrics.semanticCalls).toBe(0);
  });
  it('legacy semantic fallback is not used by structured-only mode', async () => {
    const semantic = {
      extract: vi.fn(async () => [
        {
          locator: 'p/0',
          observedLabel: 'Potência',
          rawValue: '185',
          rawUnit: 'cv',
          evidenceText: 'Potência entrega 185 cv',
        },
      ]),
    };
    const fetcher = new SpecOfficialFetcher(
      async () =>
        new Response(wrap('<p>Potência entrega 185 cv</p>'), {
          headers: { 'content-type': 'text/html' },
        }),
    );
    const result = await runSpecSources([target], connector, options, fetcher, semantic);
    expect(result.metrics.semanticCalls).toBe(0);
    expect(semantic.extract).not.toHaveBeenCalled();
    expect(result.observations.length).toBeLessThanOrEqual(1);
  });
  it('missing safe connector entry stops without network', async () => {
    const transport = vi.fn();
    const result = await runSpecSources(
      [target],
      { ...connector, sourceEntries: [] },
      options,
      new SpecOfficialFetcher(transport),
    );
    expect(transport).not.toHaveBeenCalled();
    expect(result.rejections[0]?.reason).toBe('OFFICIAL_SOURCE_DISCOVERY_GAP');
  });
  it('unavailable source stops entire run', async () => {
    const transport = vi.fn(async () => new Response('denied', { status: 403 }));
    const result = await runSpecSources(
      [target],
      {
        ...connector,
        sourceEntries: [
          ...connector.sourceEntries,
          { type: 'MODEL_PAGE', url: snapshot.sourceUrl + '/specs', priority: 2 },
        ],
      },
      options,
      new SpecOfficialFetcher(transport),
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.stoppedUnavailable).toBe(true);
  });
  it('CLI defaults to fixture and zero semantic budget', () =>
    expect(
      parseSpecSourceArguments([
        '--brand',
        'Jeep',
        '--model',
        'Commander',
        '--version',
        'Longitude T270',
        '--my',
        '2026',
      ]).options,
    ).toMatchObject({ provider: 'fixture', maxSemanticCalls: 0 }));
  it('CLI denies persistence switch', () =>
    expect(() => parseSpecSourceArguments(['--persist-findings', 'true'])).toThrow(
      'INVALID_AGENT_ARGUMENTS',
    ));
  it('production runtime has no brand branches', () => {
    for (const file of [
      './spec-source-documents.ts',
      './spec-source-runtime.ts',
      './spec-source-fetch.ts',
    ]) {
      const code = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(code).not.toMatch(/brand\s*===?\s*['"](?:VW|Jeep|Toyota)/u);
    }
  });
});

it('unlabelled nested version heading cannot inherit exact parent binding', () => {
  expect(
    extract(wrap('<section><h4>Other</h4><dl><dt>Motor</dt><dd>2.0</dd></dl></section>'))
      .observations,
  ).toEqual([]);
});

it('fixture runtime never falls through to a live transport', async () => {
  await expect(
    runSpecSources([target], fixture.active, {
      provider: 'fixture',
      mode: 'baseline',
      maxTargets: 1,
      maxSources: 1,
      maxSemanticCalls: 0,
    }),
  ).rejects.toThrow('FIXTURE_TRANSPORT_REQUIRED');
});
