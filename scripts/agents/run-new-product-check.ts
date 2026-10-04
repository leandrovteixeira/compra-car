import { randomUUID } from 'node:crypto';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  CurrentMmvDiscoveryAgent,
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
  type MmvMarketObservation,
} from '@compra-car/core/agents';
import {
  OpenAIProductResearchProvider,
  OpenAIMmvMarketLookupProvider,
  productResearchMaxWaitMs,
} from '@compra-car/adapter-openai';
import { LocalProductReportWriter, redactSecrets } from './report-writer';
import { LocalCurrentDiscoveryReportWriter } from './current-discovery-report-writer';
import { loadAgentEnvironment } from './agent-environment';
import { safeAgentFailure } from './agent-diagnostics';

export function parseAgentArguments(args: readonly string[]) {
  const values = args.filter((value) => value !== '--');
  const options = new Map<string, string>();
  let persistFindings = false;
  let discoveryOnly = false;
  let marketReconcile = false;
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (name === '--discovery-only') {
      if (discoveryOnly) throw new Error('INVALID_AGENT_ARGUMENTS');
      discoveryOnly = true;
      continue;
    }
    if (name === '--persist-findings') {
      if (persistFindings) throw new Error('INVALID_AGENT_ARGUMENTS');
      persistFindings = true;
      continue;
    }
    if (name === '--market-reconcile') {
      if (marketReconcile) throw new Error('INVALID_AGENT_ARGUMENTS');
      marketReconcile = true;
      continue;
    }
    const value = values[++index];
    if (
      !['--brand', '--provider', '--market-model'].includes(name ?? '') ||
      !value ||
      value.startsWith('--') ||
      options.has(name!)
    )
      throw new Error('INVALID_AGENT_ARGUMENTS');
    options.set(name!, value);
  }
  const brand = options.get('--brand');
  const provider = options.get('--provider');
  const marketModel = options.get('--market-model')?.trim() || null;
  if (
    !brand ||
    (provider !== 'fixture' && provider !== 'openai') ||
    (discoveryOnly && persistFindings) ||
    (marketReconcile && provider !== 'openai') ||
    (marketModel !== null && !marketReconcile)
  )
    throw new Error('INVALID_AGENT_ARGUMENTS');
  return {
    scope: { country: 'BR' as const, brand: connectorText(brand, 100) },
    provider,
    persistFindings,
    discoveryOnly,
    marketReconcile,
    marketModel,
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
    const { scope, provider, persistFindings, discoveryOnly, marketReconcile, marketModel } =
      parseAgentArguments(args);
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
    const runId = randomUUID();
    log('Run: ' + runId);

    if (discoveryOnly) {
      const result = await new CurrentMmvDiscoveryAgent({
        research,
        connectorResolver,
      }).run(scope, runId);
      await new LocalCurrentDiscoveryReportWriter(repositoryRoot, secrets).write(result);
      log(
        'Current discovery only | provider: ' +
          provider +
          ' | models discovered: ' +
          result.modelsDiscovered +
          ' | variants resolved: ' +
          result.variantsResolved +
          ' | researched: ' +
          result.researchedCandidates +
          ' | accepted: ' +
          result.acceptedCandidates +
          ' | rejected: ' +
          result.rejectedCandidates.length,
      );
      log('Legacy catalog not read. No reconciliation or canonical mutation executed.');
      log('Reports: .local-reports/agents/mmv-current-discovery/' + runId + '.{json,md}');
      return 0;
    }

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
    let marketReconciliationByModel:
      | Readonly<Record<string, readonly MmvMarketObservation[]>>
      | undefined;
    if (marketReconcile) {
      const lookup = new OpenAIMmvMarketLookupProvider({
        apiKey: env.OPENAI_API_KEY!,
        model: env.OPENAI_AGENT_MODEL!,
        prompt: await readFile(
          resolve(repositoryRoot, 'docs/agents/prompts/mmv-market-reconciliation-v1.md'),
          'utf8',
        ),
      });
      const requests = new Map<string, Set<string>>();
      for (const finding of result.findings) {
        if (finding.type !== 'NEW_MODEL' && finding.type !== 'NEW_VERSION') continue;
        if (
          marketModel &&
          finding.candidate.model.trim().toLocaleLowerCase('pt-BR') !==
            marketModel.toLocaleLowerCase('pt-BR')
        )
          continue;
        const labels =
          finding.type === 'NEW_MODEL'
            ? finding.variants
                .map((variant) => variant.officialVersionLabel ?? variant.trim)
                .filter((value): value is string => Boolean(value?.trim()))
            : [finding.candidate.officialVersionLabel ?? finding.candidate.trim].filter(
                (value): value is string => Boolean(value?.trim()),
              );
        if (!labels.length) continue;
        const set = requests.get(finding.candidate.model) ?? new Set<string>();
        labels.forEach((label) => set.add(label));
        requests.set(finding.candidate.model, set);
      }

      const collected: Record<string, readonly MmvMarketObservation[]> = {};
      for (const [model, hints] of requests) {
        try {
          collected[model] = await lookup.lookup({
            market: result.market,
            brand: result.brand,
            model,
            versionHints: [...hints],
          });
          log(
            'Market reconciliation: ' +
              model +
              ' | hints: ' +
              hints.size +
              ' | observations: ' +
              collected[model]!.length,
          );
        } catch {
          collected[model] = [];
          log('Market reconciliation unavailable for ' + model + '; MMV finding preserved.');
        }
      }
      marketReconciliationByModel = collected;
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
      await repository.persistRunBundle(
        mapMmvRunToPlatform(sanitized, { provider, marketReconciliationByModel }),
      );
      log('Operational findings persisted. Catalog unchanged.');
    }
    log('Reports: .local-reports/agents/new-product-check/' + runId + '.{json,md}');
    return 0;
  } catch (error) {
    log(safeAgentFailure('NEW_PRODUCT_CHECK_FAILED', error));
    return 1;
  }
}
