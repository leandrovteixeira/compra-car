import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ModelYearAgent,
  modelYearFixture,
  PlatformMmvDiscoveryReader,
  OperationalBrandConnectorResolver,
  AdministrativeProductCatalogReader,
  StructuredFirstModelYearResearch,
  connectorText,
  type ModelYearResearchProvider,
} from '@compra-car/core/agents';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';

import {
  WebmotorsModelYearProvider,
  webmotorsDocumentTransport,
} from '@compra-car/adapter-webmotors';
import { modelYearHtmlParser } from './model-year-html-parser';
import { loadAgentEnvironment } from './agent-environment';
import { redactSecrets } from './report-writer';
import { safeAgentFailure } from './agent-diagnostics';
export function parseModelYearArguments(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : [...args],
    options = new Map<string, string>();
  let persistFindings = false,
    allowDealer = false;
  for (let i = 0; i < values.length; i++) {
    const name = values[i]!;
    if (name === '--persist-findings') {
      if (persistFindings) throw new Error('INVALID_AGENT_ARGUMENTS');
      persistFindings = true;
      continue;
    }
    if (name === '--allow-dealer') {
      if (allowDealer) throw new Error('INVALID_AGENT_ARGUMENTS');
      allowDealer = true;
      continue;
    }
    const value = values[++i];
    if (
      !['--brand', '--provider', '--mode'].includes(name) ||
      !value ||
      value.startsWith('--') ||
      options.has(name)
    )
      throw new Error('INVALID_AGENT_ARGUMENTS');
    options.set(name, value);
  }
  const brand = options.get('--brand'),
    provider = options.get('--provider'),
    mode = options.get('--mode') ?? 'monitor';
  if (
    !brand ||
    !provider ||
    !['fixture', 'structured', 'hybrid', 'openai'].includes(provider) ||
    !['monitor', 'baseline'].includes(mode) ||
    (allowDealer && provider !== 'hybrid')
  )
    throw new Error('INVALID_AGENT_ARGUMENTS');
  return {
    scope: { country: 'BR' as const, brand: connectorText(brand, 100) },
    provider,
    mode: mode === 'monitor' ? ('MONITOR' as const) : ('BASELINE' as const),
    persistFindings,
    allowDealer,
  };
}
export function modelYearLimit(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^\d+$/u.test(raw) || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error('INVALID_AGENT_ARGUMENTS');
  return value;
}
export async function runModelYearCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (s: string) => void = console.log,
  root = fileURLToPath(new URL('../../', import.meta.url)),
  dependencies: {
    ports?: ConstructorParameters<typeof ModelYearAgent>[0];
    persistence?: Pick<AgentPlatformRepository, 'persistRunBundle'>;
  } = {},
): Promise<number> {
  try {
    const { scope, provider, persistFindings, mode, allowDealer } = parseModelYearArguments(args);
    env = await loadAgentEnvironment(root, env);
    let ports = dependencies.ports,
      persistence = dependencies.persistence;
    if ((provider !== 'fixture' && !ports) || (persistFindings && !persistence)) {
      if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
        throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
      const { createLegacySupabaseClient, LegacySupabaseAdapter, AgentPlatformSupabaseAdapter } =
        await import('@compra-car/adapter-supabase');
      const { BrandConnectorSupabaseAdapter } =
        await import('@compra-car/adapter-supabase/brand-connectors');
      const client = createLegacySupabaseClient({
        url: env.SUPABASE_URL,
        serverKey: env.SUPABASE_SERVER_KEY,
      });
      const platform = new AgentPlatformSupabaseAdapter(client);
      persistence ??= platform;
      if (provider !== 'fixture' && !ports) {
        const catalog = new LegacySupabaseAdapter(client);
        ports = {
          catalog: new AdministrativeProductCatalogReader({
            listOperatorMatchingProducts: () => catalog.listOperatorMatchingProducts(),
          }),
          discovery: new PlatformMmvDiscoveryReader(platform),
          connectorResolver: new OperationalBrandConnectorResolver(
            new BrandConnectorSupabaseAdapter(client),
          ),
          research: await createModelYearResearch(provider, mode, allowDealer, env, root),
        };
      }
    }
    ports ??= modelYearFixture(scope.brand);
    const result = await new ModelYearAgent(ports).run(scope, provider);
    const clean = JSON.parse(
      redactSecrets(JSON.stringify(result), [
        env.OPENAI_API_KEY ?? '',
        env.SUPABASE_SERVER_KEY ?? '',
      ]),
    ) as typeof result;
    const directory = resolve(root, '.local-reports/agents/model-year');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, clean.bundle.run.id + '.json'),
      JSON.stringify(clean, null, 2) + '\n',
    );
    const cell = (v: unknown) =>
      (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')).replace(
        /[<>\[\]\r\n]/gu,
        ' ',
      );
    await writeFile(
      resolve(directory, clean.bundle.run.id + '.md'),
      [
        '# Model Year Agent',
        '',
        'Run: ' + clean.bundle.run.id,
        'Provider: ' + provider + (provider === 'fixture' ? ' (synthetic)' : ''),
        '',
        ...Object.entries(clean.bundle.run.summary).map(([k, v]) => k + ': ' + cell(v)),
        '',
        ...clean.targets.map((t) =>
          [
            t.officialIdentity.brand,
            t.officialIdentity.model,
            t.officialIdentity.officialVersionLabel,
            'Known MY:',
            t.knownModelYears.join(', '),
          ]
            .map(cell)
            .join(' '),
        ),
        '',
        ...clean.bundle.findings.flatMap((f) => [
          cell(f.finding.findingType) + ' ' + cell(f.finding.title),
          ...f.evidence.map((e) => cell(e.sourceUrl) + ' ? ' + cell(e.excerpt)),
        ]),
        '',
        '## Search audit',
        ...clean.searchAudit.map((a) => cell(a)),
        '',
        '## Rejected observations',
        ...clean.rejectedObservations.map((r) => cell(r)),
        '',
        'Accept is review-only. Catalog unchanged.',
        '',
      ].join('\n'),
    );
    if (persistFindings) await persistence!.persistRunBundle(clean.bundle);
    log(
      'Run: ' +
        clean.bundle.run.id +
        '\nProvider: ' +
        provider +
        '\n' +
        Object.entries(clean.bundle.run.summary)
          .map(([k, v]) => k + ': ' + cell(v))
          .join('\n'),
    );
    log(
      persistFindings
        ? 'Operational findings persisted. Catalog unchanged.'
        : 'Local reports written. Catalog unchanged.',
    );
    return 0;
  } catch (error) {
    log(safeAgentFailure('MODEL_YEAR_FAILED', error));
    return 1;
  }
}

export async function createModelYearResearch(
  provider: string,
  mode: 'MONITOR' | 'BASELINE',
  allowDealer: boolean,
  env: Readonly<Record<string, string | undefined>>,
  root: string,
): Promise<ModelYearResearchProvider> {
  const maxGroups = modelYearLimit(env.MODEL_YEAR_MAX_OPENAI_MODEL_GROUPS, 2, 0, 10);
  const fallback = async (stage: 'MANUFACTURER_OFFICIAL' | 'AUTHORIZED_DEALER') => {
    if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    const { OpenAIModelYearResearchProvider } = await import('@compra-car/adapter-openai');
    return new OpenAIModelYearResearchProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_AGENT_MODEL,
      prompt: await readFile(resolve(root, 'docs/agents/prompts/model-year-agent-v1.md'), 'utf8'),
      stage,
      maxModelGroups: maxGroups,
      maxToolCalls: modelYearLimit(env.MODEL_YEAR_MAX_TOOL_CALLS, 3, 1, 10),
      maxWaitMs: modelYearLimit(env.MODEL_YEAR_OPENAI_MAX_WAIT_MS, 120000, 60000, 300000),
    });
  };
  if (provider === 'openai')
    return {
      researchModelYears: async (targets, source) =>
        (await fallback('MANUFACTURER_OFFICIAL')).researchModelYears(targets, source),
    };
  return new StructuredFirstModelYearResearch({
    structured: new WebmotorsModelYearProvider({
      transport: webmotorsDocumentTransport(),
      parse: modelYearHtmlParser(),
      brandSlugs: { VW: 'volkswagen' },
      baselineWindow: 3,
    }),
    mode,
    allowDealer,
    maxOpenAiModelGroups: maxGroups,
    ...(provider === 'hybrid' ? { fallback } : {}),
  });
}
