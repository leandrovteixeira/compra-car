import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrandConnectorAgent,
  FixtureBrandConnectorResearchProvider,
  fixtureActiveConnector,
  builtInConnectorDefinitions,
  connectorText,
  connectorMarket,
  type BrandConnectorRepository,
  type BrandConnectorResearchProvider,
} from '@compra-car/core/agents';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';
import { OpenAIBrandConnectorResearchProvider } from '@compra-car/adapter-openai';
import { redactSecrets } from './report-writer';
import { loadAgentEnvironment } from './agent-environment';
import { safeAgentFailure } from './agent-diagnostics';
export function parseBrandConnectorArguments(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : args,
    options = new Map<string, string>();
  let persistFindings = false;
  for (let i = 0; i < values.length; i++) {
    const name = values[i]!;
    if (name === '--persist-findings' && !persistFindings) {
      persistFindings = true;
      continue;
    }
    const value = values[++i];
    if (
      !['--brand', '--market', '--mode', '--provider', '--fixture-state'].includes(name) ||
      !value ||
      value.startsWith('--') ||
      options.has(name)
    )
      throw new Error('INVALID_CONNECTOR_ARGUMENTS');
    options.set(name, value);
  }
  const brand = connectorText(options.get('--brand'), 100),
    market = connectorMarket(options.get('--market') ?? 'BR'),
    mode = options.get('--mode'),
    provider = options.get('--provider'),
    fixtureState = options.get('--fixture-state') ?? 'healthy';
  if (
    (mode !== 'discover' && mode !== 'health-check') ||
    (provider !== 'fixture' && provider !== 'openai') ||
    !['healthy', 'drift'].includes(fixtureState) ||
    (provider !== 'fixture' && options.has('--fixture-state'))
  )
    throw new Error('INVALID_CONNECTOR_ARGUMENTS');
  return { brand, market, mode, provider, persistFindings, fixtureState } as const;
}
export async function runBrandConnectorCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (message: string) => void = console.log,
  root = fileURLToPath(new URL('../../', import.meta.url)),
  dependencies: {
    repository?: BrandConnectorRepository;
    persistence?: Pick<AgentPlatformRepository, 'persistRunBundle'>;
    research?: BrandConnectorResearchProvider;
  } = {},
): Promise<number> {
  try {
    const options = parseBrandConnectorArguments(args);
    env = await loadAgentEnvironment(root, env);
    if (
      options.provider === 'openai' &&
      !dependencies.research &&
      (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())
    )
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    let repository = dependencies.repository,
      persistence = dependencies.persistence;
    if (
      (options.provider === 'openai' && !repository) ||
      (options.persistFindings && !persistence)
    ) {
      if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
        throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
      const { AgentPlatformSupabaseAdapter, createLegacySupabaseClient } =
        await import('@compra-car/adapter-supabase');
      const { BrandConnectorSupabaseAdapter } =
        await import('@compra-car/adapter-supabase/brand-connectors');
      const client = createLegacySupabaseClient({
        url: env.SUPABASE_URL ?? '',
        serverKey: env.SUPABASE_SERVER_KEY ?? '',
      });
      repository ??= new BrandConnectorSupabaseAdapter(client);
      persistence ??= new AgentPlatformSupabaseAdapter(client);
    }
    const activeConnector =
      options.provider === 'fixture'
        ? options.mode === 'health-check'
          ? fixtureActiveConnector(
              builtInConnectorDefinitions().find(
                (d) => d.brand.toLowerCase() === options.brand.toLowerCase(),
              ),
            )
          : undefined
        : ((await repository!.getActiveConnector(options.brand, options.market)) ?? undefined);
    const research =
      dependencies.research ??
      (options.provider === 'fixture'
        ? new FixtureBrandConnectorResearchProvider(options.fixtureState === 'drift')
        : new OpenAIBrandConnectorResearchProvider({
            apiKey: env.OPENAI_API_KEY ?? '',
            model: env.OPENAI_AGENT_MODEL ?? '',
            prompt: await readFile(
              resolve(root, 'docs/agents/prompts/brand-connector-agent-v1.md'),
              'utf8',
            ),
          }));
    const bundle = await new BrandConnectorAgent(research).run(
      { brand: options.brand, market: options.market, mode: options.mode, activeConnector },
      undefined,
      options.provider,
    );
    const secrets = [env.OPENAI_API_KEY ?? '', env.SUPABASE_SERVER_KEY ?? ''];
    const clean = JSON.parse(redactSecrets(JSON.stringify(bundle), secrets)) as typeof bundle;
    const finding = clean.findings[0]!.finding;
    const directory = resolve(root, '.local-reports/agents/brand-connector');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, bundle.run.id + '.json'),
      JSON.stringify(clean, null, 2) + '\n',
    );
    const cell = (value: unknown) => String(value ?? '').replace(/[<>\[\]|\r\n]/gu, ' ');
    await writeFile(
      resolve(directory, bundle.run.id + '.md'),
      [
        '# Brand Connector',
        '',
        'Brand: ' + cell(clean.run.brand),
        'Market: ' + cell(clean.run.market),
        'Observed manufacturer label: ' + cell(finding.payload.observedBrandLabel),
        'Mode: ' + options.mode,
        'Provider: ' +
          options.provider +
          (options.provider === 'fixture' ? ' (sintético; não é pesquisa real)' : ''),
        'Finding: ' + finding.findingType,
        'Confidence: ' + finding.confidence,
        '',
        'Candidate domains: ' + cell(finding.payload.candidateDomains),
        'Sources: ' + cell(finding.payload.sourceCoverage),
        '',
        ...(finding.payload.sourceEntries
          ? (finding.payload.sourceEntries as unknown as { type: string; url: string }[]).map(
              (e) => '- ' + cell(e.type) + ': ' + cell(e.url),
            )
          : []),
        '',
        'Warnings: ' + cell(finding.payload.warnings),
        cell(finding.summary),
        '',
        'Accept não ativa. Ativação exige ação administrativa separada.',
        '',
      ].join('\n'),
    );
    if (options.persistFindings) await persistence!.persistRunBundle(clean);
    log(
      'Run: ' +
        bundle.run.id +
        ' | ' +
        finding.findingType +
        ' | Reports: .local-reports/agents/brand-connector/' +
        bundle.run.id +
        '.{json,md}',
    );
    return 0;
  } catch (error) {
    log(safeAgentFailure('BRAND_CONNECTOR_FAILED', error));
    return 1;
  }
}
