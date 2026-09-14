import { ProductResearchProviderError } from '@compra-car/adapter-openai';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FixtureBrandConnectorResearchProvider,
  FixtureProductResearchProvider,
} from '@compra-car/core/agents';
import { loadAgentEnvironment } from '../agent-environment';
import { safeAgentFailure } from '../agent-diagnostics';
import { runBrandConnectorCli } from '../run-brand-connector';
import { runNewProductCheckCli } from '../run-new-product-check';

const roots: string[] = [];
async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'agent-env-19c2-'));
  roots.push(root);
  return root;
}
async function environmentFile(root: string, content: string) {
  await mkdir(join(root, 'apps/web'), { recursive: true });
  await writeFile(join(root, 'apps/web/.env.local'), content);
}
const brandArgs = [
  '--brand',
  'Volkswagen',
  '--market',
  'BR',
  '--mode',
  'discover',
  '--provider',
  'fixture',
];
const mmvArgs = ['--brand', 'Toyota', '--provider', 'fixture'];
beforeEach(() => {
  vi.stubEnv('COMPRA_CAR_AGENT_ENV_FILE', undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Network forbidden');
    }),
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('Shared native agent environment', () => {
  it('both fixtures succeed with no optional env file', async () => {
    const root = await temporaryRoot();
    expect(await loadAgentEnvironment(root, {})).toEqual({});
    expect(await runBrandConnectorCli(brandArgs, {}, vi.fn(), root)).toBe(0);
    expect(await runNewProductCheckCli(mmvArgs, {}, vi.fn(), root)).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('loads missing values using native dotenv quoting, comments and multiline syntax', async () => {
    const root = await temporaryRoot();
    await environmentFile(
      root,
      'OPENAI_API_KEY="synthetic#key"\nOPENAI_AGENT_MODEL=mock-model # comment\nSUPABASE_URL=https://offline.invalid\nSUPABASE_SERVER_KEY=synthetic-server\nMULTILINE="first\nsecond"\n',
    );
    const env = await loadAgentEnvironment(root, { OPENAI_AGENT_MODEL: undefined });
    expect(env).toMatchObject({
      OPENAI_API_KEY: 'synthetic#key',
      OPENAI_AGENT_MODEL: 'mock-model',
      SUPABASE_URL: 'https://offline.invalid',
      SUPABASE_SERVER_KEY: 'synthetic-server',
      MULTILINE: 'first\nsecond',
    });
  });
  it('existing process.env values, including empty strings, win without process mutation', async () => {
    const root = await temporaryRoot();
    await environmentFile(
      root,
      'AGENT_TEST_19C2_VALUE=file\nAGENT_TEST_19C2_EMPTY=file\nAGENT_TEST_19C2_MISSING=file\n',
    );
    vi.stubEnv('AGENT_TEST_19C2_VALUE', 'process');
    vi.stubEnv('AGENT_TEST_19C2_EMPTY', '');
    vi.stubEnv('AGENT_TEST_19C2_MISSING', undefined);
    expect(await loadAgentEnvironment(root)).toMatchObject({
      AGENT_TEST_19C2_VALUE: 'process',
      AGENT_TEST_19C2_EMPTY: '',
      AGENT_TEST_19C2_MISSING: 'file',
    });
    expect(process.env.AGENT_TEST_19C2_MISSING).toBeUndefined();
  });
  it.each([false, true])('explicit env file override, absolute=%s', async (absolute) => {
    const root = await temporaryRoot();
    await environmentFile(root, 'SELECTED=default\nDEFAULT_ONLY=yes');
    await writeFile(join(root, 'custom.env'), 'SELECTED=custom');
    const env = await loadAgentEnvironment(root, {
      COMPRA_CAR_AGENT_ENV_FILE: absolute ? join(root, 'custom.env') : 'custom.env',
    });
    expect(env.SELECTED).toBe('custom');
    expect(env.DEFAULT_ONLY).toBeUndefined();
  });
  it('reads the standard file through a hard link without modifying either path', async () => {
    const root = await temporaryRoot(),
      original = join(root, 'synthetic-secrets.env');
    await writeFile(original, 'SHARED_VALUE=synthetic');
    await mkdir(join(root, 'apps/web'), { recursive: true });
    await link(original, join(root, 'apps/web/.env.local'));
    expect((await loadAgentEnvironment(root, {})).SHARED_VALUE).toBe('synthetic');
    expect(await readFile(original, 'utf8')).toBe('SHARED_VALUE=synthetic');
  });
  it.each(['not an assignment', '\0BROKEN=synthetic'])(
    'handles malformed optional content safely',
    async (content) => {
      const root = await temporaryRoot();
      await environmentFile(root, content);
      expect(await loadAgentEnvironment(root, { PRESERVED: 'yes' })).toEqual({ PRESERVED: 'yes' });
      expect(await runBrandConnectorCli(brandArgs, {}, vi.fn(), root)).toBe(0);
    },
  );
  it('missing explicit override is optional and never falls back to the default file', async () => {
    const root = await temporaryRoot();
    await environmentFile(root, 'SHOULD_NOT_LOAD=synthetic');
    expect(
      (await loadAgentEnvironment(root, { COMPRA_CAR_AGENT_ENV_FILE: 'missing.env' }))
        .SHOULD_NOT_LOAD,
    ).toBeUndefined();
  });
  it.each(['brand', 'mmv'])(
    '%s CLI uses the shared loader before validating real-run configuration',
    async (kind) => {
      const root = await temporaryRoot(),
        log = vi.fn();
      await environmentFile(root, 'OPENAI_API_KEY=synthetic-key\nOPENAI_AGENT_MODEL=mock-model');
      const code =
        kind === 'brand'
          ? await runBrandConnectorCli(
              ['--brand', 'VW', '--market', 'BR', '--mode', 'discover', '--provider', 'openai'],
              {},
              log,
              root,
            )
          : await runNewProductCheckCli(
              ['--brand', 'Toyota', '--provider', 'openai'],
              {},
              log,
              root,
            );
      expect(code).toBe(1);
      expect(log).toHaveBeenLastCalledWith(
        (kind === 'brand' ? 'BRAND_CONNECTOR_FAILED' : 'NEW_PRODUCT_CHECK_FAILED') +
          ': SUPABASE_AGENT_CONFIG_REQUIRED',
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each(['brand', 'mmv'])(
    '%s logs/reports never include secrets loaded from the env file',
    async (kind) => {
      const root = await temporaryRoot(),
        log = vi.fn(),
        apiSecret = 'opaque-api-19c2',
        dbSecret = 'opaque-server-19c2';
      await environmentFile(root, `OPENAI_API_KEY=${apiSecret}\nSUPABASE_SERVER_KEY=${dbSecret}`);
      let directory: string;
      if (kind === 'brand') {
        const fixture = await new FixtureBrandConnectorResearchProvider().researchConnector({
          brand: 'Volkswagen',
          market: 'BR',
          mode: 'discover',
        });
        const persistence = { persistRunBundle: vi.fn(async () => undefined) };
        expect(
          await runBrandConnectorCli([...brandArgs, '--persist-findings'], {}, log, root, {
            persistence,
            research: {
              researchConnector: async () => ({
                ...fixture,
                verificationSummary: apiSecret + ' ' + dbSecret,
                evidence: fixture.evidence.map((e) => ({
                  ...e,
                  excerpt: apiSecret + ' ' + dbSecret,
                })),
              }),
            },
          }),
        ).toBe(0);
        expect(JSON.stringify(persistence.persistRunBundle.mock.calls)).not.toContain(apiSecret);
        expect(JSON.stringify(persistence.persistRunBundle.mock.calls)).not.toContain(dbSecret);
        directory = 'brand-connector';
      } else {
        const original = FixtureProductResearchProvider.prototype.researchProducts;
        vi.spyOn(FixtureProductResearchProvider.prototype, 'researchProducts').mockImplementation(
          async (scope) => {
            const fixture = await original.call(new FixtureProductResearchProvider(), scope);
            return {
              ...fixture,
              metadata: { ...fixture.metadata, responseId: apiSecret + ' ' + dbSecret },
            };
          },
        );
        expect(await runNewProductCheckCli(mmvArgs, {}, log, root)).toBe(0);
        directory = 'new-product-check';
      }
      const reportDir = join(root, '.local-reports/agents', directory);
      const content =
        (
          await Promise.all(
            (await readdir(reportDir)).map((file) => readFile(join(reportDir, file), 'utf8')),
          )
        ).join('\n') + JSON.stringify(log.mock.calls);
      expect(content).not.toContain(apiSecret);
      expect(content).not.toContain(dbSecret);
      expect(content).toContain('REDACTED');
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('Safe stable diagnostics', () => {
  it.each([
    'OPENAI_AGENT_CONFIG_REQUIRED',
    'OPENAI_RESEARCH_CANCELLED',
    'CONNECTOR_RESEARCH_FAILED',
    'INVALID_CONNECTOR_RESEARCH',
  ])('reports only approved code %s', (code) => {
    expect(
      safeAgentFailure(
        'BRAND_CONNECTOR_FAILED',
        new Error(code, { cause: { key: 'opaque-secret', body: 'private' } }),
      ),
    ).toBe('BRAND_CONNECTOR_FAILED: ' + code);
  });
  it.each([
    new Error('opaque-secret'),
    new Error('CONNECTOR_RESEARCH_FAILED\nopaque-secret'),
    { code: 'opaque-secret' },
    'OPENAI_AGENT_CONFIG_REQUIRED',
  ])('unknown errors collapse without details', (error) => {
    expect(safeAgentFailure('BRAND_CONNECTOR_FAILED', error)).toBe('BRAND_CONNECTOR_FAILED');
    expect(safeAgentFailure('NEW_PRODUCT_CHECK_FAILED', error)).toBe('NEW_PRODUCT_CHECK_FAILED');
  });
  it('real-run missing OpenAI config and fixture persistence config fail before any network', async () => {
    const root = await temporaryRoot(),
      log = vi.fn();
    expect(
      await runBrandConnectorCli(
        ['--brand', 'VW', '--mode', 'discover', '--provider', 'openai'],
        {},
        log,
        root,
      ),
    ).toBe(1);
    expect(log).toHaveBeenLastCalledWith('BRAND_CONNECTOR_FAILED: OPENAI_AGENT_CONFIG_REQUIRED');
    expect(await runBrandConnectorCli([...brandArgs, '--persist-findings'], {}, log, root)).toBe(1);
    expect(log).toHaveBeenLastCalledWith('BRAND_CONNECTOR_FAILED: SUPABASE_AGENT_CONFIG_REQUIRED');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['CONNECTOR_RESEARCH_FAILED', 'BRAND_CONNECTOR_FAILED: CONNECTOR_RESEARCH_FAILED'],
    ['private response body opaque-secret', 'BRAND_CONNECTOR_FAILED'],
  ])('CLI catches provider failures safely', async (message, expected) => {
    const root = await temporaryRoot(),
      log = vi.fn();
    expect(
      await runBrandConnectorCli(brandArgs, {}, log, root, {
        research: {
          researchConnector: async () => {
            throw new Error(message);
          },
        },
      }),
    ).toBe(1);
    expect(log).toHaveBeenLastCalledWith(expected);
  });
});

it('MMV CLI logs only controlled transport fields', async () => {
  const root = await temporaryRoot(),
    log = vi.fn();
  const privateText = 'sk-synthetic-key private-body private-header private-prompt';
  const failure = Object.assign(
    new ProductResearchProviderError('OPENAI_RESEARCH_BAD_REQUEST', 400, 123),
    {
      cause: new Error(privateText),
      body: privateText,
      headers: { authorization: privateText },
      apiCode: privateText,
      param: privateText,
      requestId: privateText,
    },
  );
  vi.spyOn(FixtureProductResearchProvider.prototype, 'researchProducts').mockRejectedValue(failure);
  expect(await runNewProductCheckCli(mmvArgs, {}, log, root)).toBe(1);
  expect(log).toHaveBeenLastCalledWith(
    'NEW_PRODUCT_CHECK_FAILED: OPENAI_RESEARCH_BAD_REQUEST\nstatus=400\nelapsed_ms=123',
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain(privateText);
  expect(fetch).not.toHaveBeenCalled();
});

it('diagnostics omit absent and invalid metadata and unknown errors', () => {
  expect(
    safeAgentFailure(
      'NEW_PRODUCT_CHECK_FAILED',
      new ProductResearchProviderError('OPENAI_RESEARCH_TIMEOUT'),
    ),
  ).toBe('NEW_PRODUCT_CHECK_FAILED: OPENAI_RESEARCH_TIMEOUT');
  expect(
    safeAgentFailure(
      'NEW_PRODUCT_CHECK_FAILED',
      new ProductResearchProviderError('OPENAI_RESEARCH_FAILED', NaN, Infinity),
    ),
  ).toBe('NEW_PRODUCT_CHECK_FAILED: OPENAI_RESEARCH_FAILED');
  expect(
    safeAgentFailure(
      'NEW_PRODUCT_CHECK_FAILED',
      Object.assign(new Error('private'), { status: 400 }),
    ),
  ).toBe('NEW_PRODUCT_CHECK_FAILED');
});
