import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  WebmotorsModelYearProvider,
  parseWebmotorsYears,
  parseWebmotorsRows,
  selectStructuredYears,
  webmotorsDocumentTransport,
  allowedWebmotorsUrl,
  type HtmlParser,
} from '../src';
import {
  groupModelYearTargets,
  matchStructuredRows,
  mapModelYearRunToPlatform,
} from '@compra-car/core/agents';
import { coverageTarget } from '../../core/test/fixtures/model-year-coverage';
const require = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const parse = (require('next/dist/compiled/node-html-parser') as { parse: HtmlParser }).parse;
const root = 'https://www.webmotors.com.br/tabela-fipe/carros/volkswagen/nivus';
const html = readFileSync(new URL('./fixtures/nivus-root.html', import.meta.url), 'utf8');
const table = readFileSync(new URL('./fixtures/nivus-2027.html', import.meta.url), 'utf8');
const group = groupModelYearTargets(
  ['Comfortline', 'Highline', 'Sense', 'GTS'].map((trim) => ({
    ...coverageTarget('VW', 'Nivus', trim + (trim === 'GTS' ? ' 250 TSI' : ' 200 TSI'), trim),
    structuredIdentity: {
      ...coverageTarget().structuredIdentity,
      trim,
      powertrainLabel: trim === 'GTS' ? '250 TSI' : '200 TSI',
    },
  })),
)[0]!;
const source = {
  brand: 'VW',
  country: 'BR' as const,
  allowedDomains: ['vw.com.br'],
  allowedHosts: ['www.vw.com.br'],
  allowedSubdomainRoots: [],
  searchHints: [],
};
afterEach(() => vi.useRealTimers());
describe('Webmotors deterministic document adapter', () => {
  it('extracts linked years, not copyright or arbitrary links', () =>
    expect(
      parseWebmotorsYears(
        html + '<footer>2030</footer><a href="https://evil.example/2028">2028</a>',
        root,
        parse,
      ),
    ).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021]));
  it('extracts all four observed labels and FIPE codes', () =>
    expect(
      parseWebmotorsRows(table, root + '/2027', group, 2027, parse).map((r) => r.fipeCode),
    ).toEqual(['005525-5', '005526-3', '005548-4', '005553-0']));
  it.each([
    '',
    '<table><tr><td>2027',
    '<script>throw Error()</script>',
    '<table><tr><th>Price</th></tr><tr><td>2027</td></tr></table>',
  ])('handles malformed/missing expected table %s', (input) =>
    expect(parseWebmotorsRows(input, root + '/2027', group, 2027, parse)).toEqual([]),
  );
  it('wrong document year/model header rejects table', () => {
    expect(
      parseWebmotorsRows(
        table.replace('<h1>Volkswagen Nivus 2027</h1>', '<h1>Taos 2026</h1>'),
        root + '/2027',
        group,
        2027,
        parse,
      ),
    ).toEqual([]);
  });
  it('four MMVs share one root and year fetch with request caching', async () => {
    const transport = vi.fn(async (url: string) => ({ url, html: url === root ? html : table }));
    const provider = new WebmotorsModelYearProvider({
      parse,
      transport,
      brandSlugs: { VW: 'volkswagen' },
    });
    const g = { ...group, targets: group.targets.map((t) => ({ ...t, knownModelYears: [2027] })) };
    const first = await provider.discover(g, 'MONITOR'),
      second = await provider.discover(g, 'MONITOR');
    expect(transport).toHaveBeenCalledTimes(2);
    expect(first.metrics).toEqual({
      structuredModelFetches: 1,
      structuredYearFetches: 1,
      structuredRowsParsed: 4,
    });
    expect(second.metrics.structuredYearFetches).toBe(0);
    provider.beginRun();
    await provider.discover(g, 'MONITOR');
    expect(transport).toHaveBeenCalledTimes(4);
  });
  it('generates four NEW findings with candidate codes when only 2026 is known', () => {
    const rows = parseWebmotorsRows(table, root + '/2027', group, 2027, parse),
      matched = matchStructuredRows(group, rows);
    expect(matched.matched).toBe(4);
    const bundle = mapModelYearRunToPlatform({
      runId: 'r',
      startedAt: '2026-09-15',
      completedAt: '2026-09-15',
      scope: { brand: 'VW', country: 'BR' },
      provider: 'structured',
      targets: group.targets,
      source,
      discoveryRunId: null,
      skippedUnresolved: 0,
      observations: matched.observations,
    });
    expect(bundle.findings).toHaveLength(4);
    expect(
      bundle.findings.every(
        (f) => f.finding.findingType === 'NEW_MODEL_YEAR' && f.finding.requiresReview,
      ),
    ).toBe(true);
    expect(bundle.findings.flatMap((f) => f.finding.payload.fipeCodeCandidates)).toHaveLength(4);
    expect(JSON.stringify(bundle)).not.toMatch(
      /productionYear|PRESS_CORROBORATION|targetsWithPress/,
    );
  });
  it('monitor and baseline are bounded', () => {
    expect(selectStructuredYears([2027, 2026, 2025, 2024, 2023, 2022], group, 'MONITOR')).toEqual([
      2027, 2026,
    ]);
    expect(
      selectStructuredYears([2027, 2026, 2025, 2024, 2023, 2022], group, 'BASELINE', 99),
    ).toHaveLength(5);
    expect(selectStructuredYears([2025], group, 'MONITOR')).toEqual([]);
  });
  it('missing table records invalid year page instead of propagating root MYs', async () => {
    const p = new WebmotorsModelYearProvider({
      parse,
      transport: async (url) => ({ url, html: url === root ? html : '<main>No table</main>' }),
      brandSlugs: { VW: 'volkswagen' },
    });
    const r = await p.discover(group, 'MONITOR');
    expect(r.rows).toEqual([]);
    expect(r.issues.every((i) => i.reasonCode === 'STRUCTURED_YEAR_PAGE_INVALID')).toBe(true);
  });
  it('unavailable source is controlled', async () => {
    const p = new WebmotorsModelYearProvider({
      parse,
      transport: async () => {
        throw Error('secret');
      },
    });
    expect((await p.discover(group, 'MONITOR')).issues[0]?.reasonCode).toBe(
      'STRUCTURED_SOURCE_UNAVAILABLE',
    );
  });
});
describe('ordinary public HTTP only', () => {
  const mocked = (response: Response) => vi.fn(async () => response) as unknown as typeof fetch;
  const make = (fetcher: typeof fetch, extra = {}) =>
    webmotorsDocumentTransport({ fetch: fetcher, paceMs: 250, sleep: async () => {}, ...extra });
  it.each([403, 429, 500, 503])('handles status %i with zero retries', async (status) => {
    const f = mocked(new Response('blocked', { status }));
    await expect(make(f)(root)).rejects.toThrow('STRUCTURED_SOURCE_UNAVAILABLE');
    expect(f).toHaveBeenCalledOnce();
  });
  it('only approved public host/path accepted', async () => {
    for (const url of [
      'http://www.webmotors.com.br/x',
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://10.0.0.1/x',
      'https://www.webmotors.com.br.evil.example/x',
      'https://www.webmotors.com.br@evil.example/x',
      root + '?url=http://localhost',
    ])
      expect(allowedWebmotorsUrl(url)).toBe(false);
  });
  it('outside redirect never fetched', async () => {
    const f = mocked(
      new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/' } }),
    );
    await expect(make(f)(root)).rejects.toThrow();
    expect(f).toHaveBeenCalledOnce();
  });
  it('redirect loop bounded', async () => {
    const f = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: root } }),
    ) as unknown as typeof fetch;
    await expect(make(f)(root)).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('stream size bound without content-length', async () => {
    await expect(
      make(mocked(new Response('x'.repeat(101), { headers: { 'content-type': 'text/html' } })), {
        maxBytes: 100,
      })(root),
    ).rejects.toThrow();
  });
  it('content length bound', async () => {
    await expect(
      make(
        mocked(
          new Response('x', { headers: { 'content-type': 'text/html', 'content-length': '1000' } }),
        ),
        { maxBytes: 100 },
      )(root),
    ).rejects.toThrow();
  });
  it('timeout aborts HTTP', async () => {
    vi.useFakeTimers();
    const f = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal!.addEventListener('abort', () => reject(Error('timeout'))),
        ),
    ) as unknown as typeof fetch;
    const result = expect(make(f, { timeoutMs: 50 })(root)).rejects.toThrow(
      'STRUCTURED_SOURCE_UNAVAILABLE',
    );
    await vi.advanceTimersByTimeAsync(60);
    await result;
  });
  it('success returns HTML without executing script', async () =>
    expect(
      (
        await make(
          mocked(new Response('<main>Hello</main>', { headers: { 'content-type': 'text/html' } })),
        )(root)
      ).html,
    ).toBe('<main>Hello</main>'));
  it('blocks challenge content safely', async () =>
    await expect(
      make(mocked(new Response('CAPTCHA', { headers: { 'content-type': 'text/html' } })))(root),
    ).rejects.toThrow());
});
