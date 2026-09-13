import type { AgentRunBundle } from '@compra-car/core/agent-platform';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FixtureProductResearchProvider,
  FixtureProductCatalogReader,
  NewProductCheckAgent,
  jeepCapturedMmvCandidates,
  jeepCapturedMmvCatalog,
} from '@compra-car/core/agents';
import { LocalProductReportWriter } from '../report-writer';
import { parseAgentArguments, runNewProductCheckCli } from '../run-new-product-check';
const roots: string[] = [];
async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'compra-car-agent-test-'));
  roots.push(root);
  return root;
}
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
describe('CLI and local reports', () => {
  it('default ignores persistence capability even with credentials present', async () => {
    const persistence = { persistRunBundle: vi.fn() };
    vi.stubGlobal('fetch', () => {
      throw new Error('Network forbidden');
    });
    expect(
      await runNewProductCheckCli(
        ['--brand', 'Jeep', '--provider', 'fixture'],
        { SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVER_KEY: 'synthetic-key' },
        vi.fn(),
        await temporaryRoot(),
        persistence,
      ),
    ).toBe(0);
    expect(persistence.persistRunBundle).not.toHaveBeenCalled();
  });
  it('explicit opt-in passes only the operational bundle with the report UUID', async () => {
    const persistence = {
      persistRunBundle: vi.fn<(bundle: AgentRunBundle) => Promise<void>>(async () => {}),
    };
    const root = await temporaryRoot();
    vi.stubGlobal('fetch', () => {
      throw new Error('Network forbidden');
    });
    expect(
      await runNewProductCheckCli(
        ['--brand', 'Jeep', '--provider', 'fixture', '--persist-findings'],
        {},
        vi.fn(),
        root,
        persistence,
      ),
    ).toBe(0);
    expect(persistence.persistRunBundle).toHaveBeenCalledOnce();
    const bundle = persistence.persistRunBundle.mock.calls[0]![0] as unknown as {
      run: { id: string };
      findings: unknown[];
    };
    const report = JSON.parse(
      await readFile(
        join(root, '.local-reports/agents/new-product-check', bundle.run.id + '.json'),
        'utf8',
      ),
    );
    expect(report.runId).toBe(bundle.run.id);
    expect(bundle.findings).toHaveLength(7);
  });
  it('opt-in fails safely with missing config and without calling network', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('Network forbidden');
    });
    expect(
      await runNewProductCheckCli(
        ['--brand', 'Jeep', '--provider', 'fixture', '--persist-findings'],
        {},
        vi.fn(),
        await temporaryRoot(),
      ),
    ).toBe(1);
  });
  it('persistence failure leaves local reports and returns nonzero without leaking the error', async () => {
    const root = await temporaryRoot(),
      log = vi.fn();
    const persistence = {
      persistRunBundle: vi.fn(async () => {
        throw new Error('synthetic-private-error');
      }),
    };
    expect(
      await runNewProductCheckCli(
        ['--persist-findings', '--brand', 'Jeep', '--provider', 'fixture'],
        {},
        log,
        root,
        persistence,
      ),
    ).toBe(1);
    expect(await readdir(join(root, '.local-reports/agents/new-product-check'))).toHaveLength(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-error');
  });
  it('rejects duplicate opt-in flags and unexpected values', () => {
    expect(() =>
      parseAgentArguments([
        '--brand',
        'Jeep',
        '--provider',
        'fixture',
        '--persist-findings',
        '--persist-findings',
      ]),
    ).toThrow();
    expect(() =>
      parseAgentArguments([
        '--brand',
        'Jeep',
        '--provider',
        'fixture',
        '--persist-findings',
        'true',
      ]),
    ).toThrow();
  });
  it('reports a captured MMV once with four associated year rows in JSON and Markdown', async () => {
    const root = await temporaryRoot();
    const result = await new NewProductCheckAgent({
      research: {
        researchProducts: async () => ({
          candidates: jeepCapturedMmvCandidates,
          metadata: { provider: 'fixture-captured-offline', webSearchCount: 0 },
        }),
      },
      catalog: { readProducts: async () => jeepCapturedMmvCatalog },
      reports: new LocalProductReportWriter(root),
    }).run({ country: 'BR', brand: 'Jeep' }, 'mmv-report');
    const directory = join(root, '.local-reports/agents/new-product-check');
    const json = JSON.parse(await readFile(join(directory, 'mmv-report.json'), 'utf8'));
    const md = await readFile(join(directory, 'mmv-report.md'), 'utf8');
    expect(json.canonicalProductRows).toBe(16);
    expect(json.knownMmvIdentities).toBe(13);
    expect(json.matchedCandidates).toHaveLength(13);
    const match = json.matchedCandidates.find(
      (m: { candidate: { officialVersionLabel: string } }) =>
        m.candidate.officialVersionLabel === 'COMMANDER LONGITUDE T270 7L',
    );
    expect(match.matchedMmvIdentities).toHaveLength(1);
    expect(match.matchedMmvIdentities[0].productRows).toHaveLength(4);
    expect(match.matchedMmvIdentities[0].productRows.map((p: { id: string }) => p.id)).toEqual([
      '960',
      '996',
      '1064',
      '1128',
    ]);
    expect(match.candidate.modelYear).toBe(2027);
    expect(result.findings.every((f) => f.type === 'NEW_MODEL')).toBe(true);
    const block = md.split('### Jeep Commander COMMANDER LONGITUDE T270 7L')[1]!.split('### ')[0]!;
    expect(block).toContain('MMV correspondences:');
    expect(block).toContain('Jeep Commander / Longitude 1.3 TGDI AT');
    expect(block).toContain('Associated product rows');
    for (const text of [
      '960 / 2025/2025',
      '996 / 2025/2026',
      '1064 / 2026/2026',
      '1128 / 2026/2027',
    ])
      expect(block).toContain(text);
    expect(block).not.toContain('unresolved identities');
    expect(md).toContain('| Canonical product rows | 16 |');
    expect(md).toContain('| Known MMV identities | 13 |');
    expect(md).not.toContain('## Possible year changes');
  });

  it('executes Jeep with shared JSON/Markdown reports and fixture-only benchmark', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('Network forbidden');
    });
    const root = await temporaryRoot(),
      log = vi.fn();
    expect(
      await runNewProductCheckCli(['--brand', 'Jeep', '--provider', 'fixture'], {}, log, root),
    ).toBe(0);
    const directory = join(root, '.local-reports/agents/new-product-check');
    const files = await readdir(directory);
    const result = JSON.parse(
      await readFile(
        join(
          directory,
          files.find((f) => f.endsWith('.json'))!,
        ),
        'utf8',
      ),
    );
    const md = await readFile(
      join(
        directory,
        files.find((f) => f.endsWith('.md'))!,
      ),
      'utf8',
    );
    expect(result.brand).toBe('Jeep');
    expect(result.matchedCandidates).toHaveLength(4);
    expect(result.findings).toHaveLength(3);
    expect(
      result.findings.find((f: { type: string }) => f.type === 'NEW_MODEL').variants,
    ).toHaveLength(2);
    expect(md).toContain('Longitude T270 MHEV');
    expect(md).toContain('Longitude 1.3 TGDI AT MHEV');
    expect(md).toContain('Blackhawk Hurricane Flex');
    expect(md.match(/^### Jeep Commander$/gm)).toHaveLength(1);
    expect(md).toContain('## New models');
    expect(md).toContain('## New versions');
    expect(md).toContain('## Ambiguous');
    expect(md).not.toContain('Toyota');
    const benchmarkLine = log.mock.calls
      .map(([line]) => line as string)
      .find((line) => line.startsWith('Fixture benchmark: '))!;
    expect(JSON.parse(benchmarkLine.slice('Fixture benchmark: '.length))).toMatchObject({
      brand: 'Jeep',
      canonicalProductRows: 4,
      knownMmvIdentities: 4,
      reconciledKnownMmvIdentities: 4,
      falseNewMmv: 0,
      knownReconciliationRate: 1,
      falseNewRate: 0,
    });
  });

  it.each([
    [],
    ['--brand', 'Toyota'],
    ['--brand', 'Toyota', '--provider', 'invalid'],
    ['--brand', 'Toyota', '--provider', 'fixture', '--write', 'yes'],
    ['--brand', 'Toyota', '--brand', 'Toyota', '--provider', 'fixture'],
    ['--brand', 'Other', '--provider', 'fixture'],
  ])('rejects invalid arguments %j', (...args) =>
    expect(() => parseAgentArguments(args)).toThrow(),
  );
  it('supports pnpm argument separator', () =>
    expect(
      parseAgentArguments(['--', '--brand', ' toyota ', '--provider', 'fixture']),
    ).toMatchObject({ provider: 'fixture', scope: { brand: 'Toyota' } }));
  it('executes fixture end to end, writes JSON and Markdown with separate ambiguity section, never accesses network', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('Network forbidden');
    });
    const root = await temporaryRoot(),
      log = vi.fn();
    const env = {
      OPENAI_API_KEY: 'synthetic-key-for-test',
      OPENAI_AGENT_MODEL: 'unused-model',
      SUPABASE_SERVER_KEY: 'synthetic-server-key',
    };
    expect(
      await runNewProductCheckCli(
        ['--', '--brand', 'Toyota', '--provider', 'fixture'],
        env,
        log,
        root,
      ),
    ).toBe(0);
    const directory = join(root, '.local-reports/agents/new-product-check');
    const files = await readdir(directory);
    expect(files).toHaveLength(2);
    const json = await readFile(
      join(
        directory,
        files.find((f) => f.endsWith('.json'))!,
      ),
      'utf8',
    );
    const md = await readFile(
      join(
        directory,
        files.find((f) => f.endsWith('.md'))!,
      ),
      'utf8',
    );
    const result = JSON.parse(json);
    expect(result.researchedCandidates).toBe(21);
    expect(result.matchedCandidates).toHaveLength(8);
    expect(result.findings).toHaveLength(6);
    expect(result.schemaVersion).toBe('19A.4');
    expect(
      result.matchedCandidates.every((m: { matchMode: string }) => m.matchMode === 'LEGACY_NAMING'),
    ).toBe(true);
    expect(result.matchedCandidates[0].candidate.officialVersionLabel).toBe('XR');
    expect(md).toContain('XR 2.0 CVT');
    expect(md).toContain('## New models');
    expect(md).toContain('Warnings: POSSIBLE_ALIAS');
    expect(md).toContain('## New versions');
    expect(md.match(/^### Toyota Corolla$/gm)).toHaveLength(1);
    expect(md).toContain('Altis Hybrid Premium');
    expect(md).toContain('SRX Platinum 5S');
    expect(md).toContain('POSSIBLE_ALIAS');
    expect(md).toContain('POSSIBLE_PACKAGE');
    expect(md).toContain('Direct Shift (CVT)');
    const corolla = result.findings.find(
      (f: { type: string; candidate: { model: string } }) =>
        f.type === 'NEW_MODEL' && f.candidate.model === 'Corolla',
    );
    expect(corolla.variants).toHaveLength(5);
    expect(corolla.candidate.officialVersionLabel).toBeNull();
    expect(corolla.warnings).toContain('POSSIBLE_ALIAS');
    expect(
      result.matchedCandidates.find(
        (m: { candidate: { officialVersionLabel: string } }) =>
          m.candidate.officialVersionLabel === 'XRX Hybrid',
      ).matchedProductIds,
    ).toEqual(['615']);
    expect(md).toContain('| Official version | XR |');
    expect(md).toContain('| Propulsion | HEV |');
    expect(md).toContain('| Matched legacy naming | 8 |');
    expect(md).toContain('| Canonical product rows | 8 |');
    expect(md).toContain('## Ambiguous — manual review');
    expect(md).not.toContain('| POSSIBLE_YEAR_CHANGE |');
    expect(md).toContain('| Known MMV identities | 8 |');
    expect(md).toContain('https://www.toyota.com.br/modelos');
    for (const secret of [env.OPENAI_API_KEY, env.SUPABASE_SERVER_KEY])
      expect(json + md + JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('redacts keys from injected evidence and telemetry before both report formats', async () => {
    const root = await temporaryRoot(),
      secret = 'synthetic-secret-for-redaction';
    const fixture = new FixtureProductResearchProvider();
    const research = await fixture.researchProducts({ country: 'BR', brand: 'Toyota' });
    const result = await new NewProductCheckAgent({
      research: {
        researchProducts: async () => ({
          ...research,
          candidates: research.candidates.map((c) => ({
            ...c,
            evidence: [
              {
                url: 'https://toyota.com.br/?token=' + secret,
                title: secret,
                excerpt: secret,
                evidenceType: 'MODEL_PAGE' as const,
              },
            ],
          })),
          metadata: { provider: 'fake', responseId: secret },
        }),
      },
      catalog: new FixtureProductCatalogReader(),
      reports: new LocalProductReportWriter(root, [secret]),
    }).run({ country: 'BR', brand: 'Toyota' }, 'secret-test');
    const directory = join(root, '.local-reports/agents/new-product-check');
    for (const extension of ['json', 'md']) {
      const content = await readFile(join(directory, result.runId + '.' + extension), 'utf8');
      expect(content).not.toContain(secret);
      expect(content).toContain('REDACTED');
    }
  });
  it('returns nonzero without exposing raw arguments or environment on operational errors', async () => {
    const log = vi.fn(),
      secret = 'synthetic-error-secret';
    expect(
      await runNewProductCheckCli(
        ['--brand', secret, '--provider', 'fixture'],
        { OPENAI_API_KEY: secret },
        log,
      ),
    ).toBe(1);
    expect(
      await runNewProductCheckCli(
        ['--brand', 'Toyota', '--provider', 'openai'],
        { OPENAI_API_KEY: secret },
        log,
      ),
    ).toBe(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('does not overwrite an existing run', async () => {
    const root = await temporaryRoot(),
      writer = new LocalProductReportWriter(root);
    const result = await new NewProductCheckAgent({
      research: new FixtureProductResearchProvider(),
      catalog: new FixtureProductCatalogReader(),
      reports: writer,
    }).run({ country: 'BR', brand: 'Toyota' }, 'same-run');
    await expect(writer.write(result)).rejects.toThrow();
  });
});
