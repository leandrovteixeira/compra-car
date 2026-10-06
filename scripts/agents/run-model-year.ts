import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BuiltInBrandConnectorResolver,
  CurrentMmvDiscoveryAgent,
  FixtureProductResearchProvider,
  ModelYearAgent,
  OperationalBrandConnectorResolver,
  canonicalVehicleBrand,
  connectorText,
  mapModelYearRunToPlatform,
  type CanonicalMmv,
} from '@compra-car/core/agents';
import {
  OpenAIProductResearchProvider,
  productResearchMaxWaitMs,
} from '@compra-car/adapter-openai';
import { loadAgentEnvironment } from './agent-environment';

export function parseModelYearArguments(args: readonly string[]) {
  const values = args.filter((value) => value !== '--');
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
    scope: { country: 'BR' as const, brand: canonicalVehicleBrand(connectorText(brand, 100)) },
    provider,
    persistFindings,
  };
}

function fixtureMmvs(
  discovery: Awaited<ReturnType<CurrentMmvDiscoveryAgent['run']>>,
): readonly CanonicalMmv[] {
  return discovery.candidates.flatMap((candidate, index) => {
    const label = candidate.officialVersionLabel ?? candidate.trim;
    if (!label?.trim()) return [];
    return [{
      id: 'fixture-mmv-' + String(index + 1),
      market: discovery.market,
      identityKey: 'fixture:' + candidate.brand + ':' + candidate.model + ':' + label,
      brand: candidate.brand,
      model: candidate.model,
      officialVersionLabel: label,
      bodyStyle: candidate.bodyStyle ?? null,
      powertrainLabel: candidate.powertrainLabel,
      propulsion: candidate.propulsion,
      engineDisplacement: candidate.engineDisplacement,
      status: 'ACTIVE' as const,
      visibility: 'PRIVATE' as const,
      sourceFindingId: 'fixture',
      lastConfirmedFindingId: 'fixture',
      createdBy: null,
      createdAt: discovery.startedAt,
      updatedAt: discovery.completedAt,
    }];
  });
}

export async function runModelYearCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (message: string) => void = console.log,
  repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
): Promise<number> {
  try {
    const { scope, provider, persistFindings } = parseModelYearArguments(args);
    env = await loadAgentEnvironment(repositoryRoot, env);
    if (provider === 'openai' && (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim()))
      throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
    if (
      (provider === 'openai' || persistFindings) &&
      (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
    )
      throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');

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
    const discovery = await new CurrentMmvDiscoveryAgent({
      research,
      connectorResolver,
    }).run(scope, runId);

    const { mmvs, knownYears } =
      provider === 'fixture'
        ? { mmvs: fixtureMmvs(discovery), knownYears: [] }
        : await (async () => {
            const {
              CanonicalMmvSupabaseAdapter,
              CanonicalModelYearSupabaseAdapter,
              createLegacySupabaseClient,
            } = await import('@compra-car/adapter-supabase');
            const client = createLegacySupabaseClient({
              url: env.SUPABASE_URL!,
              serverKey: env.SUPABASE_SERVER_KEY!,
            });
            const mmvRepository = new CanonicalMmvSupabaseAdapter(client);
            const yearRepository = new CanonicalModelYearSupabaseAdapter(client);
            const mmvs = await mmvRepository.listCanonicalMmvs({
              market: 'BR',
              brand: scope.brand,
              status: 'ACTIVE',
            });
            const years = (
              await Promise.all(mmvs.map((mmv) => yearRepository.listModelYears({ mmvId: mmv.id })))
            ).flat();
            return { mmvs, knownYears: years };
          })();

    const result = new ModelYearAgent().run({ discovery, mmvs, knownYears });
    const bundle = mapModelYearRunToPlatform(discovery, result, { provider });

    if (persistFindings) {
      const { AgentPlatformSupabaseAdapter, createLegacySupabaseClient } =
        await import('@compra-car/adapter-supabase');
      const platform = new AgentPlatformSupabaseAdapter(
        createLegacySupabaseClient({
          url: env.SUPABASE_URL!,
          serverKey: env.SUPABASE_SERVER_KEY!,
        }),
      );
      await platform.persistRunBundle(bundle);
      log('Operational Model Year findings persisted. Catalog unchanged.');
    }

    log(
      [
        'Model Year | provider: ' + provider,
        'MMVs: ' + mmvs.length,
        'known years: ' + knownYears.length,
        'observations: ' + result.observations.length,
        'findings: ' + result.findings.length,
        'review: ' + result.findings.filter((item) => item.requiresReview).length,
        'new MY: ' + result.findings.filter((item) => item.reasonCode === 'NEW_MODEL_YEAR').length,
        'MMV escalations: ' +
          result.findings.filter((item) => item.reasonCode === 'POSSIBLE_NEW_MMV').length,
      ].join(' | '),
    );
    return 0;
  } catch (error) {
    log('Model Year run failed: ' + (error instanceof Error ? error.message : 'UNKNOWN_ERROR'));
    return 1;
  }
}
