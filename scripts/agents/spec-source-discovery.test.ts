import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifySpecLink,
  connectorOfficialSource,
  modelYearFixture,
  buildSpecSourceTargets,
  joinSpecApplicability,
  type SourceScope,
} from '@compra-car/core/agents';
import { extractSpecDiscoveryLinks } from './spec-source-discovery';
import { runSpecSources } from './spec-source-runtime';
import { SpecOfficialFetcher } from './spec-source-fetch';
const f = modelYearFixture('VW'),
  source = connectorOfficialSource(f.active),
  resolved = buildSpecSourceTargets(f.context, f.rows, { country: 'BR', brand: 'VW' }, source).find(
    (t) => t.modelYear === 2026,
  )!;
const target = {
  ...resolved,
  officialVersionLabel: 'Comfortline 200 TSI',
  catalogVersion: 'Comfortline 1.0 TGDI AT',
  mmvIdentity: 'fixture:nivus:comfortline',
  structuredIdentity: { ...resolved.structuredIdentity, trim: 'Comfortline' },
};
const base = 'https://vw.com.br',
  seed = classifySpecLink(
    { url: base + '/cars', label: 'Cars', method: 'CONNECTOR_SEED' },
    target,
    null,
    2,
  );
const link = (url: string, label: string) => ({
  url: base + url,
  label,
  method: 'HTML_LINK' as const,
});
describe('generic official discovery', () => {
  it('real lineup preserves buttons as IDs, finds configurator without inventing model URL', () => {
    const links = extractSpecDiscoveryLinks(
      readFileSync(new URL('./fixtures/spec-discovery-vw-lineup.html', import.meta.url), 'utf8'),
      base + '/pt/carros.html',
    );
    expect(links.some((l) => l.url.includes('configurador'))).toBe(true);
    expect(links.some((l) => l.url === base + '/nivus')).toBe(false);
    expect(links.some((l) => l.url.includes('manuais'))).toBe(true);
  });
  it('lineup finds only requested model via generic anchor metadata', () => {
    const links = extractSpecDiscoveryLinks(
      '<a href="/cars/nivus.html">Nivus</a><a href="/cars/other.html">Other</a>',
      base,
    );
    expect(links.map((l) => classifySpecLink(l, target, seed, 2).status)).toEqual([
      'ACCEPTED',
      'REJECTED',
    ]);
  });
  it('model page discovers configurator and literature', () => {
    const parent = classifySpecLink(link('/cars/nivus.html', 'Nivus'), target, seed, 2);
    expect(classifySpecLink(link('/configure', 'Configurador'), target, parent, 2).status).toBe(
      'ACCEPTED',
    );
    expect(
      classifySpecLink(link('/manual.pdf', 'Manual MY26'), target, parent, 2).rejectionReason,
    ).toBe('SOURCE_KIND_EXCLUDED');
  });
  it('never promotes old manual to requested MY', () =>
    expect(
      classifySpecLink(link('/nivus-MY2024.pdf', 'Manual'), target, seed, 2).rejectionReason,
    ).toBe('SOURCE_KIND_EXCLUDED'));
  it('unknown year remains unknown', () =>
    expect(
      classifySpecLink(link('/nivus.pdf', 'Manual'), target, seed, 2).myBindingSignals,
    ).toEqual([]));
  it('depth is bounded', () =>
    expect(
      classifySpecLink(link('/nivus/technical', 'ficha técnica'), target, { ...seed, depth: 2 }, 2)
        .rejectionReason,
    ).toBe('MAX_DISCOVERY_DEPTH'));
  it.each(['careers', 'privacy', 'dealer', 'press', 'financiamento'])('rejects %s', (part) =>
    expect(classifySpecLink(link('/nivus/' + part, part), target, seed, 2).status).toBe('REJECTED'),
  );
  it('decodes nested percent-encoded JSON without evaluating script', () => {
    const state = encodeURIComponent(
      JSON.stringify({ content: JSON.stringify({ name: 'Nivus', url: '/cars/nivus.html' }) }),
    );
    expect(
      extractSpecDiscoveryLinks(
        '<script type="x-feature-hub/serialized-states">' + state + '</script>',
        base,
      )[0],
    ).toMatchObject({ url: base + '/cars/nivus.html', method: 'EMBEDDED_JSON' });
  });
  it('ignores executable script and nodeId fields', () =>
    expect(
      extractSpecDiscoveryLinks(
        '<script>fetch("/cars/nivus")</script><script type="application/json">{"nodeId":"/nivus"}</script>',
        base,
      ),
    ).toEqual([]));
});
describe('graph budgets and explicit multi-source applicability', () => {
  const options = {
    provider: 'structured' as const,
    mode: 'baseline' as const,
    maxTargets: 1,
    maxSources: 3,
    maxSemanticCalls: 0,
    maxDiscoveryDepth: 2,
  };
  const connector = {
    ...f.active,
    sourceEntries: [{ url: base + '/cars', type: 'MODEL_INDEX' as const, priority: 1 }],
  };
  it('traverses lineup -> model -> technical, ignores unrelated and deeper links', async () => {
    const transport = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      const body = url.endsWith('/cars')
        ? '<a href="/cars/nivus">Nivus</a><a href="/cars/other">Other</a>'
        : url.endsWith('/nivus')
          ? '<a href="/nivus/technical">ficha técnica MY26</a>'
          : '<a href="/nivus/deeper">Nivus technical</a>';
      return new Response(body, { headers: { 'content-type': 'text/html' } });
    });
    const r = await runSpecSources(
      [target],
      connector,
      options,
      new SpecOfficialFetcher(transport),
    );
    expect(transport).toHaveBeenCalledTimes(3);
    expect(r.discoveryGraph.find((c) => c.url.endsWith('/other'))?.status).toBe('REJECTED');
    expect(r.discoveryGraph.find((c) => c.url.endsWith('/deeper'))?.rejectionReason).toBe(
      'MAX_DISCOVERY_DEPTH',
    );
    expect(r.metrics.modelSpecificSources).toBe(2);
  });
  it('enforces total max sources even with multiple seeds', async () => {
    const r = await runSpecSources(
      [target],
      connector,
      { ...options, maxSources: 1 },
      new SpecOfficialFetcher(
        async () =>
          new Response('<a href="/nivus">Nivus</a>', { headers: { 'content-type': 'text/html' } }),
      ),
    );
    expect(r.http).toHaveLength(1);
    expect(r.discoveryGraph[1]?.rejectionReason).toBe('MAX_SOURCES');
  });
  it('one discovery call consumes the shared semantic budget', async () => {
    const discovery = { discover: vi.fn(async () => [link('/nivus', 'Nivus')]) },
      semantic = { extract: vi.fn() };
    const r = await runSpecSources(
      [target],
      connector,
      { ...options, provider: 'hybrid', maxSemanticCalls: 1 },
      new SpecOfficialFetcher(
        async () => new Response('', { headers: { 'content-type': 'text/html' } }),
      ),
      semantic,
      discovery,
    );
    expect(discovery.discover).toHaveBeenCalledTimes(1);
    expect(semantic.extract).not.toHaveBeenCalled();
    expect(r.metrics.discoveryCalls).toBe(1);
    expect(r.metrics.semanticCalls).toBe(1);
  });
  const scope: SourceScope = {
    model: 'Nivus',
    version: target.officialVersionLabel,
    modelYear: 2026,
    shared: false,
    matrix: false,
    currentLineup: false,
    engineDesignation: '200 TSI',
    fuel: 'Flex',
    transmission: 'AT',
  };
  const proof = {
    sourceUrl: base + '/configurator',
    sourceKind: 'OFFICIAL_CONFIGURATOR' as const,
    evidenceText: 'Nivus ' + target.officialVersionLabel + ' 2026 200 TSI Flex AT',
    locator: 'version/1',
    contentHash: 'config-hash',
  };
  it('can link separate value and applicability sources on explicit version and MY', () =>
    expect(
      joinSpecApplicability(scope, [{ scope, evidence: proof }], target)?.evidence.sourceUrl,
    ).toBe(base + '/configurator'));
  it('supports component-specific powertrain identity, never same-model-only join', () => {
    expect(
      joinSpecApplicability(
        { ...scope, version: null, component: 'POWERTRAIN' },
        [{ scope, evidence: proof }],
        target,
      ),
    ).not.toBeNull();
    expect(
      joinSpecApplicability({ ...scope, version: null }, [{ scope, evidence: proof }], target),
    ).toBeNull();
  });
  it('rejects cross-MY join', () =>
    expect(
      joinSpecApplicability({ ...scope, modelYear: 2025 }, [{ scope, evidence: proof }], target),
    ).toBeNull());
  it('rejects GTS applicability for target', () =>
    expect(
      joinSpecApplicability(
        scope,
        [{ scope: { ...scope, version: 'GTS 250 TSI' }, evidence: proof }],
        target,
      ),
    ).toBeNull());
  it('rejects missing applicability evidence', () =>
    expect(
      joinSpecApplicability(scope, [{ scope, evidence: { ...proof, evidenceText: '' } }], target),
    ).toBeNull());
  it('runtime produces distinct factEvidence and applicabilityEvidence URLs', async () => {
    const config =
      '<section data-model="Nivus" data-version="' +
      target.officialVersionLabel +
      '" data-model-year="2026" data-configuration-id="X"><dl><dt>Combustível</dt><dd>Flex</dd></dl></section>';
    const technical =
      '<section data-model="Nivus" data-model-year="2026" data-configuration-id="X"><dl><dt>Torque</dt><dd>200 Nm</dd></dl></section>';
    const c = {
      ...connector,
      sourceEntries: [
        { type: 'CONFIGURATOR' as const, url: base + '/nivus-configurator', priority: 1 },
        { type: 'TECHNICAL_SHEET' as const, url: base + '/nivus-technical', priority: 2 },
      ],
    };
    const r = await runSpecSources(
      [target],
      c,
      options,
      new SpecOfficialFetcher(
        async (input) =>
          new Response(String(input).endsWith('configurator') ? config : technical, {
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    const torque = r.observations.find((o) => o.observation.observedLabel === 'Torque');
    expect(torque?.factEvidence?.[0]?.sourceUrl).toBe(base + '/nivus-technical');
    expect(
      torque?.applicabilityEvidence?.some((e) => e.sourceUrl === base + '/nivus-configurator'),
    ).toBe(true);
  });
});

it('403 stops before any discovery fallback', async () => {
  const discovery = { discover: vi.fn() };
  await runSpecSources(
    [target],
    { ...f.active, sourceEntries: [{ url: base + '/cars', type: 'MODEL_INDEX', priority: 1 }] },
    { provider: 'hybrid', mode: 'baseline', maxTargets: 1, maxSources: 5, maxSemanticCalls: 1 },
    new SpecOfficialFetcher(async () => new Response('', { status: 403 })),
    undefined,
    discovery,
  );
  expect(discovery.discover).not.toHaveBeenCalled();
});

it('shared configuration ID cannot hide a conflicting engine across sources', () => {
  const a = {
    model: 'Nivus',
    version: target.officialVersionLabel,
    modelYear: 2026,
    shared: false,
    matrix: false,
    currentLineup: false,
    configurationId: 'X',
    engineDesignation: '200 TSI',
  };
  const proof = {
    sourceUrl: base + '/config',
    sourceKind: 'OFFICIAL_CONFIGURATOR' as const,
    locator: 'row',
    contentHash: 'hash',
    evidenceText: 'Nivus ' + target.officialVersionLabel + ' 2026 200 TSI',
  };
  expect(
    joinSpecApplicability(
      { ...a, version: null, engineDesignation: '250 TSI' },
      [{ scope: a, evidence: proof }],
      target,
    ),
  ).toBeNull();
});
