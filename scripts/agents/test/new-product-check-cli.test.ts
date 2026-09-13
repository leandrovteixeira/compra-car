import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FixtureProductResearchProvider,
  FixtureProductCatalogReader,
  NewProductCheckAgent,
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
      knownProducts: 4,
      reconciledKnownProducts: 4,
      falseNewProducts: 0,
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
    expect(result.schemaVersion).toBe('19A.2');
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
    expect(md).toContain('| Known canonical products | 8 |');
    expect(md).toContain('## Ambiguous — manual review');
    expect(md).toContain('| POSSIBLE_YEAR_CHANGE |');
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
