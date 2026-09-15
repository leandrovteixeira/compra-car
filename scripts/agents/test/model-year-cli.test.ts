import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelYearFixture, type ModelYearResearchTarget } from '@compra-car/core/agents';
import {
  runModelYearCli,
  parseModelYearArguments,
  createModelYearResearch,
} from '../run-model-year';
beforeEach(() =>
  vi.stubGlobal('fetch', () => {
    throw new Error('NETWORK_FORBIDDEN');
  }),
);
afterEach(() => vi.unstubAllGlobals());
describe('MY CLI offline', () => {
  it.each(['VW', 'Toyota', 'Jeep'])(
    'fixture %s writes MY-only JSON and Markdown without persistence',
    async (brand) => {
      const root = await mkdtemp(join(tmpdir(), 'my-cli-')),
        persistence = { persistRunBundle: vi.fn() },
        log = vi.fn();
      expect(
        await runModelYearCli(['--', '--brand', brand, '--provider', 'fixture'], {}, log, root, {
          persistence,
        }),
      ).toBe(0);
      expect(persistence.persistRunBundle).not.toHaveBeenCalled();
      const dir = join(root, '.local-reports/agents/model-year'),
        files = await readdir(dir);
      expect(files).toHaveLength(2);
      const json = await readFile(
        join(
          dir,
          files.find((f) => f.endsWith('.json'))!,
        ),
        'utf8',
      );
      expect(json).not.toContain('productionYear');
      expect(JSON.parse(json).bundle.findings).toHaveLength(2);
      expect(log.mock.calls.flat().join(' ')).toContain('Catalog unchanged');
    },
  );
  it('persist opt-in writes only operational bundle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'my-cli-')),
      persistence = { persistRunBundle: vi.fn(async () => undefined) };
    expect(
      await runModelYearCli(
        ['--brand', 'VW', '--provider', 'fixture', '--persist-findings'],
        {},
        vi.fn(),
        root,
        { persistence },
      ),
    ).toBe(0);
    expect(persistence.persistRunBundle).toHaveBeenCalledOnce();
    expect(persistence.persistRunBundle.mock.calls[0]).toBeDefined();
  });
  it.each(
    [
      ['--provider', 'openai'],
      ['--brand', 'VW', '--provider', 'bad'],
      ['--brand', 'VW', '--provider', 'fixture', '--unknown'],
      ['--brand', 'VW', '--provider', 'openai'],
    ].map((args) => ({ args })),
  )('configuration validation safely fails $args', async ({ args }) => {
    const root = await mkdtemp(join(tmpdir(), 'my-cli-')),
      log = vi.fn();
    expect(await runModelYearCli(args, {}, log, root)).toBe(1);
    expect(log.mock.calls.flat().join(' ')).toContain('MODEL_YEAR_FAILED');
  });
  it('logs only safe codes for raw dependency errors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'my-cli-')),
      log = vi.fn(),
      f = modelYearFixture('VW');
    expect(
      await runModelYearCli(['--brand', 'VW', '--provider', 'fixture'], {}, log, root, {
        ports: {
          ...f,
          research: {
            async researchModelYears() {
              throw new Error('SENSITIVE');
            },
          },
        },
      }),
    ).toBe(1);
    expect(log.mock.calls.flat().join(' ')).not.toContain('SENSITIVE');
  });
});

it('20.1 reports every rejected observation and does not persist them as findings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'my-coverage-cli-')),
    f = modelYearFixture('VW'),
    persistence = { persistRunBundle: vi.fn(async () => undefined) },
    log = vi.fn();
  const ports = {
    ...f,
    research: {
      async researchModelYears(targets: readonly ModelYearResearchTarget[]) {
        return {
          observations: [
            {
              targetKey: targets[0]!.targetKey,
              modelYear: 2027,
              confidence: 0.9,
              applicability: 'EXACT_VERSION' as const,
              evidence: [
                {
                  url: 'https://vw.com.br/page',
                  title: 'bounded',
                  excerpt: 'Nivus Highline 200 TSI',
                  evidenceType: 'MODEL_PAGE' as const,
                },
              ],
            },
          ],
          searchAttempts: [
            {
              targetKey: targets[0]!.targetKey,
              stage: 'MANUFACTURER_OFFICIAL' as const,
              status: 'COMPLETED' as const,
              webSearchCount: 1,
              errorCode: null,
            },
          ],
        };
      },
    },
  };
  expect(
    await runModelYearCli(
      ['--brand', 'VW', '--provider', 'fixture', '--persist-findings'],
      {},
      log,
      root,
      { ports, persistence },
    ),
  ).toBe(0);
  const dir = join(root, '.local-reports/agents/model-year'),
    files = await readdir(dir),
    json = JSON.parse(
      await readFile(
        join(
          dir,
          files.find((f) => f.endsWith('.json'))!,
        ),
        'utf8',
      ),
    ),
    md = await readFile(
      join(
        dir,
        files.find((f) => f.endsWith('.md'))!,
      ),
      'utf8',
    );
  expect(json.rejectedObservations).toHaveLength(1);
  expect(json.rejectedObservations[0]).toMatchObject({
    proposedModelYear: 2027,
    reasonCode: 'NO_EXPLICIT_MY',
    sourceDomain: 'vw.com.br',
  });
  expect(json.bundle.findings).toEqual([]);
  expect(json.bundle.run.summary.rejectionsByReason).toEqual({ NO_EXPLICIT_MY: 1 });
  expect(json.searchAudit[0].searchAttempts).toHaveLength(1);
  expect(md).toContain('NO_EXPLICIT_MY');
  expect(JSON.stringify(json)).not.toContain('productionYear');
  expect(persistence.persistRunBundle).toHaveBeenCalledOnce();
});

it('structured/mode CLI parsing and explicit dealer opt-in', () => {
  expect(parseModelYearArguments(['--brand', 'VW', '--provider', 'structured']).mode).toBe(
    'MONITOR',
  );
  expect(
    parseModelYearArguments([
      '--brand',
      'VW',
      '--provider',
      'hybrid',
      '--mode',
      'baseline',
      '--allow-dealer',
    ]).allowDealer,
  ).toBe(true);
  expect(() =>
    parseModelYearArguments(['--brand', 'VW', '--provider', 'structured', '--allow-dealer']),
  ).toThrow();
  expect(() =>
    parseModelYearArguments(['--brand', 'VW', '--provider', 'structured', '--mode', 'all']),
  ).toThrow();
});
it('structured initializes without OpenAI config and writes reports with injected read ports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'my-structured-')),
    f = modelYearFixture('VW'),
    persist = { persistRunBundle: vi.fn(async () => undefined) };
  const research = await createModelYearResearch('structured', 'MONITOR', false, {}, root);
  const r = await runModelYearCli(
    ['--brand', 'VW', '--provider', 'structured', '--persist-findings'],
    {},
    vi.fn(),
    root,
    { ports: { ...f, research }, persistence: persist },
  );
  expect(r).toBe(0);
  expect(persist.persistRunBundle).toHaveBeenCalledOnce();
  const dir = join(root, '.local-reports/agents/model-year'),
    names = await readdir(dir);
  const report = JSON.parse(
    await readFile(
      join(
        dir,
        names.find((n) => n.endsWith('.json'))!,
      ),
      'utf8',
    ),
  );
  expect(report.rejectedObservations[0].reasonCode).toBe('STRUCTURED_SOURCE_UNAVAILABLE');
  expect(report.bundle.findings).toEqual([]);
  expect(report.bundle.run.summary.openAiModelGroupsResearched).toBe(0);
});
it('hybrid can initialize without OpenAI configuration before fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'my-hybrid-'));
  await expect(
    createModelYearResearch('hybrid', 'MONITOR', false, {}, root),
  ).resolves.toBeDefined();
});
