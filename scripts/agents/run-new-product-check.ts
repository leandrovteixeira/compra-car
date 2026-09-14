import { randomUUID } from 'node:crypto';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  NewProductCheckAgent,
  mapMmvRunToPlatform,
  AdministrativeProductCatalogReader,
  FixtureProductCatalogReader,
  FixtureProductResearchProvider,
  BuiltInBrandConnectorResolver,
  OperationalBrandConnectorResolver,
  connectorText,
  productCheckFixture,
  benchmarkProductFixture,
} from '@compra-car/core/agents';
import {
  OpenAIProductResearchProvider,
  productResearchMaxWaitMs,
} from '@compra-car/adapter-openai';
import { LocalProductReportWriter, redactSecrets } from './report-writer';
import { loadAgentEnvironment } from './agent-environment';
import { safeAgentFailure } from './agent-diagnostics';

export function parseAgentArguments(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  const options = new Map<string, string>();
  let persistFindings = false;
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (name === '--persist-findings') {
      if (persistFindings) throw new Error('INVALID_AGENT_ARGUMENTS');
      persistFindings = true;
      continue;
    }
    const value = values[++index];
    if (
      !['--brand', '--provider'].includes(name ?? '') ||
      !value ||
      value.startsWith('--') ||
      options.has(name!)
    )
      throw new Error('INVALID_AGENT_ARGUMENTS');
    options.set(name!, value);
  }
  const brand = options.get('--brand');
  const provider = options.get('--provider');
  if (!brand || (provider !== 'fixture' && provider !== 'openai'))
    throw new Error('INVALID_AGENT_ARGUMENTS');
  return {
    scope: { country: 'BR' as const, brand: connectorText(brand, 100) },
    provider,
    persistFindings,
  };
}

export async function runNewProductCheckCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (message: string) => void = console.log,
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
  persistence?: Pick<AgentPlatformRepository, 'persistRunBundle'>,
): Promise<number> {
  try {
    const { scope, provider, persistFindings } = parseAgentArguments(args);
    env = await loadAgentEnvironment(repositoryRoot, env);
    if (provider === 'openai' && (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())) {
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    }
    if (
      (provider === 'openai' || (persistFindings && !persistence)) &&
      (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
    ) {
      throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
    }
    const secrets = [env.OPENAI_API_KEY ?? '', env.SUPABASE_SERVER_KEY ?? ''];
    const reports = new LocalProductReportWriter(repositoryRoot, secrets);
    const connectorResolver =
      provider === 'fixture'
        ? new BuiltInBrandConnectorResolver()
        : await (async () => {
            const { createLegacySupabaseClient } = await import('@compra-car/adapter-supabase');
            const { BrandConnectorSupabaseAdapter } =
              await import('@compra-car/adapter-supabase/brand-connectors');
            return new OperationalBrandConnectorResolver(
              new BrandConnectorSupabaseAdapter(
                createLegacySupabaseClient({
                  url: env.SUPABASE_URL!,
                  serverKey: env.SUPABASE_SERVER_KEY!,
                }),
              ),
              new BuiltInBrandConnectorResolver(),
            );
          })();
    const research =
      provider === 'fixture'
        ? new FixtureProductResearchProvider()
        : new OpenAIProductResearchProvider({
            apiKey: env.OPENAI_API_KEY!,
            model: env.OPENAI_AGENT_MODEL!,
            maxWaitMs: productResearchMaxWaitMs(env.OPENAI_AGENT_MAX_WAIT_MS),
            prompt: await readFile(
              resolve(repositoryRoot, 'docs/agents/prompts/new-product-check-agent-v1.md'),
              'utf8',
            ),
          });
    const catalog =
      provider === 'fixture'
        ? new FixtureProductCatalogReader()
        : await (async () => {
            const { LegacySupabaseAdapter, createLegacySupabaseClient } =
              await import('@compra-car/adapter-supabase');
            const repository = new LegacySupabaseAdapter(
              createLegacySupabaseClient({
                url: env.SUPABASE_URL!,
                serverKey: env.SUPABASE_SERVER_KEY!,
              }),
            );
            return new AdministrativeProductCatalogReader({
              listOperatorMatchingProducts: () => repository.listOperatorMatchingProducts(),
            });
          })();
    const runId = randomUUID();
    log('Run: ' + runId);
    const result = await new NewProductCheckAgent({
      research,
      catalog,
      reports,
      connectorResolver,
    }).run(scope, runId);
    log(
      'Provider: ' +
        provider +
        ' | models discovered: ' +
        result.modelsDiscovered +
        ' | variants resolved: ' +
        result.variantsResolved +
        ' | researched: ' +
        result.researchedCandidates +
        ' | canonical product rows: ' +
        result.canonicalProductRows +
        ' | known MMV identities: ' +
        result.knownMmvIdentities +
        ' | matched MMV candidates: ' +
        result.matchedCandidates.length +
        ' | exact: ' +
        result.matchedCandidates.filter((m) => m.matchMode === 'EXACT_OFFICIAL').length +
        ' | legacy naming: ' +
        result.matchedCandidates.filter((m) => m.matchMode === 'LEGACY_NAMING').length,
    );
    log(
      ['NEW_MODEL', 'NEW_VERSION', 'POSSIBLE_YEAR_CHANGE', 'AMBIGUOUS']
        .map((type) => type + ': ' + result.findings.filter((f) => f.type === type).length)
        .join(' | ') +
        ' | rejected: ' +
        result.rejectedCandidates.length +
        ' | rejected external sources: ' +
        result.rejectedExternalSources,
    );
    if (provider === 'fixture') {
      const benchmark = benchmarkProductFixture(
        result,
        productCheckFixture(scope).knownExpectations,
      );
      log('Fixture benchmark: ' + JSON.stringify(benchmark));
    }
    if (persistFindings) {
      const repository =
        persistence ??
        (await (async () => {
          const { AgentPlatformSupabaseAdapter, createLegacySupabaseClient } =
            await import('@compra-car/adapter-supabase');
          return new AgentPlatformSupabaseAdapter(
            createLegacySupabaseClient({
              url: env.SUPABASE_URL!,
              serverKey: env.SUPABASE_SERVER_KEY!,
            }),
          );
        })());
      const sanitized = JSON.parse(redactSecrets(JSON.stringify(result), secrets)) as typeof result;
      await repository.persistRunBundle(mapMmvRunToPlatform(sanitized, { provider }));
      log('Operational findings persisted. Catalog unchanged.');
    }
    log('Reports: .local-reports/agents/new-product-check/' + runId + '.{json,md}');
    return 0;
  } catch (error) {
    log(safeAgentFailure('NEW_PRODUCT_CHECK_FAILED', error));
    return 1;
  }
}
