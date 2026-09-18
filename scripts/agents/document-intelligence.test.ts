import { OfficialSpecDocuments } from './spec-source-documents';
import { extractDeterministicSpecs, publishedSourceVersion } from '@compra-car/core/agents';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ValidatedDocumentIntelligence, modelYearFixture } from '@compra-car/core/agents';
import type { DocumentModelTransport } from '@compra-car/core/agents';
import { source, target, content } from '../../packages/core/test/document-intelligence-fixture';
import { buildDocumentSource } from './document-intelligence-source';
import { ReplayDocumentTransport, replayDocuments } from './document-intelligence-replay';
import { runSpecSources } from './spec-source-runtime';
import { SpecOfficialFetcher } from './spec-source-fetch';
const snap = {
  sourceUrl: source.reference,
  finalUrl: source.finalUrl,
  contentHash: 'old',
  contentType: 'text/html',
  sourceKind: 'OFFICIAL_HTML' as const,
  fetchedAt: 'fixture',
  extractorVersion: '21.5',
  targetKey: 'test',
};
describe('21.5 composition and replay', () => {
  it('structured HTML preserves table cells and GTS child scope', async () => {
    const s = await buildDocumentSource(
      Buffer.from(
        '<h1>Nivus</h1><section data-model="Nivus" data-version="GTS 250 TSI"><h2>GTS 250 TSI</h2><table><tr><th>Motor</th><td>250 TSI</td></tr></table></section><footer>ignore me</footer>',
      ),
      snap,
      target,
    );
    expect(s.blocks.find((b) => b.type === 'TABLE')?.tableRows).toEqual([['Motor', '250 TSI']]);
    expect(s.blocks.find((b) => b.type === 'TABLE')?.scope.version).toBe('GTS 250 TSI');
    expect(JSON.stringify(s.blocks)).not.toContain('ignore me');
  });
  it('21.4 prose GTS scope survives generic marketing heading', async () => {
    const s = await buildDocumentSource(
      Buffer.from(
        '<h1>Nivus</h1><section><h2>Esportivo e sofisticado</h2><p>O Novo Nivus GTS 250 TSI conta com motor 250 TSI.</p><p>Com câmbio automático</p></section>',
      ),
      snap,
      target,
    );
    expect(s.blocks.filter((b) => b.text.includes('câmbio'))[0]?.scope.version).toBe('GTS 250 TSI');
  });
  it('bounded content is flagged rather than silently called complete', async () => {
    const s = await buildDocumentSource(
      Buffer.from('<p>' + 'x'.repeat(160000) + '</p>'),
      snap,
      target,
    );
    expect(s.truncated).toBe(true);
  });
  it('owner manual candidate uses zero HTTP and provider budget', async () => {
    const f = modelYearFixture('VW'),
      http = vi.fn(),
      provider = { extract: vi.fn() };
    const r = await runSpecSources(
      [target],
      {
        ...f.active,
        sourceEntries: [
          { type: 'TECHNICAL_SHEET', url: 'https://vw.com.br/manual-nivus-2026.pdf', priority: 1 },
        ],
      },
      { provider: 'hybrid', mode: 'baseline', maxSources: 1, maxTargets: 1, maxSemanticCalls: 0 },
      new SpecOfficialFetcher(http),
      undefined,
      undefined,
      undefined,
      provider,
    );
    expect(http).not.toHaveBeenCalled();
    expect(provider.extract).not.toHaveBeenCalled();
    expect(r.discoveryGraph[0]?.rejectionReason).toBe('SOURCE_KIND_EXCLUDED');
  });
  it('hybrid runtime actually routes to document provider', async () => {
    const f = modelYearFixture('VW'),
      provider = {
        extract: vi.fn(async () =>
          new ValidatedDocumentIntelligence(
            new ReplayDocumentTransport([
              {
                content,
                model: 'gpt-5.6-terra',
                responseId: 'r',
                durationMs: 1,
                completed: true,
                usage: {
                  inputTokens: 100,
                  outputTokens: 100,
                  cachedInputTokens: 0,
                  reasoningTokens: 0,
                },
              },
            ]),
          ).extract(source, target),
        ),
      };
    const r = await runSpecSources(
      [target],
      { ...f.active, sourceEntries: [{ type: 'MODEL_PAGE', url: source.finalUrl, priority: 1 }] },
      { provider: 'hybrid', mode: 'baseline', maxSources: 1, maxTargets: 1, maxSemanticCalls: 0 },
      new SpecOfficialFetcher(
        async () => new Response('<h1>Nivus</h1>', { headers: { 'content-type': 'text/html' } }),
      ),
      undefined,
      undefined,
      undefined,
      provider,
    );
    expect(provider.extract).toHaveBeenCalledTimes(1);
    expect(r.documentIntelligenceReports).toHaveLength(1);
    expect(r.observations).toHaveLength(1);
  });
  it('replay has zero HTTP even when simulating repair', async () => {
    const transport: DocumentModelTransport = new ReplayDocumentTransport([
      {
        content: {},
        model: 'gpt-5.6-terra',
        responseId: 'a',
        durationMs: 1,
        completed: true,
        usage: { inputTokens: 100, outputTokens: 100, cachedInputTokens: 0, reasoningTokens: 0 },
      },
      {
        content,
        model: 'gpt-5.6-sol',
        responseId: 'b',
        durationMs: 1,
        completed: true,
        usage: { inputTokens: 100, outputTokens: 100, cachedInputTokens: 0, reasoningTokens: 0 },
      },
    ]);
    const r = await new ValidatedDocumentIntelligence(transport).extract(source, target);
    expect(r.requests).toHaveLength(2);
    expect(r.status).toBe('PASS');
  });
  it('replay separates historical token cost from new API spend', async () => {
    const r = await replayDocuments(source, target, {
      content,
      model: 'gpt-5.6-terra',
      responseId: 'r',
      durationMs: 1,
      completed: true,
      usage: { inputTokens: 5346, outputTokens: 6542, cachedInputTokens: 0, reasoningTokens: 71 },
    });
    expect(r.currentApiCalls).toBe(0);
    expect(r.currentApiCostUsd).toBe(0);
    expect(r.historicalPrimaryCostUsd).toBe(0.089196);
  });
  it('benchmark command is explicit and not normal CI', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts.test).not.toContain('benchmark');
    expect(pkg.scripts['agent:spec-source:replay']).toContain('document-intelligence-cli');
  });
});

it('actual 21.4 GTS prose and sibling keep conflicting child scope', async () => {
  const s = await buildDocumentSource(
    Buffer.from(
      '<h1>Nivus</h1><section><h2>Esportivo e sofisticado</h2><p>O Novo Nivus GTS conta com motor 250 TSI, de 150cv de potência.</p><p>Com câmbio automático de seis marchas.</p></section>',
    ),
    snap,
    target,
  );
  expect(s.blocks.find((b) => b.text.startsWith('Com câmbio'))?.scope.version).toBe('GTS');
});

it('legacy structured/prose path also rejects the actual GTS section', () => {
  const html =
    '<h1>Nivus</h1><section><h2>Esportivo e sofisticado</h2><p>O Novo Nivus GTS conta com motor 250 TSI, de 150cv de potência.</p><p>Com câmbio automático de seis marchas.</p></section>';
  const result = extractDeterministicSpecs(
    target,
    new OfficialSpecDocuments().parse(html, snap, target),
  );
  expect(result.observations).toEqual([]);
});
it('model-year text is not a version label', () =>
  expect(publishedSourceVersion('Nivus MY2026 Motor 200 TSI', 'Nivus')).toBeNull());

it('21.6 HTML grounding excludes hidden nodes, footer and unrelated script', async () => {
  const s = await buildDocumentSource(
    Buffer.from(
      '<h1>Nivus</h1><h1 hidden>hidden identity</h1><p hidden>hidden fact</p><div style="display:none"><p>secret equipment</p></div><footer><p>legal fact</p></footer><script>unknownCode()</script><section data-version="Comfortline 200 TSI"><h2>Motor</h2><p>Motor 200 TSI</p><ul><li>Câmera</li></ul></section>',
    ),
    snap,
    target,
  );
  const text = s.blocks.map((b) => b.text).join(' ');
  for (const bad of [
    'hidden fact',
    'hidden identity',
    'secret equipment',
    'legal fact',
    'unknownCode',
  ])
    expect(text).not.toContain(bad);
  expect(s.blocks.some((b) => b.locator.startsWith('list/'))).toBe(true);
});
