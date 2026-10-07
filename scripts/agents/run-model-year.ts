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
  type CurrentMmvDiscoverySnapshot,
  type OfficialProductCandidate,
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
      !['--brand', '--provider', '--parent-run-id'].includes(name ?? '') ||
      !value ||
      value.startsWith('--') ||
      options.has(name!)
    )
      throw new Error('INVALID_AGENT_ARGUMENTS');
    options.set(name!, value);
  }
  const brand = options.get('--brand');
  const provider = options.get('--provider');
  const parentRunId = options.get('--parent-run-id') ?? null;
  if (
    !brand ||
    (provider !== 'fixture' && provider !== 'openai') ||
    (parentRunId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(parentRunId))
  )
    throw new Error('INVALID_AGENT_ARGUMENTS');
  return {
    scope: { country: 'BR' as const, brand: canonicalVehicleBrand(connectorText(brand, 100)) },
    provider,
    persistFindings,
    parentRunId,
  };
}


function candidateWithEvidence(
  value: unknown,
  evidence: readonly { sourceUrl: string; title: string | null; excerpt: string | null; sourceType: string }[],
): OfficialProductCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.brand !== 'string' ||
    typeof candidate.model !== 'string' ||
    typeof candidate.taxonomy !== 'string'
  ) return null;
  return {
    ...(candidate as unknown as OfficialProductCandidate),
    evidence: evidence.map((item) => ({
      sourceKind: 'MANUFACTURER' as const,
      url: item.sourceUrl,
      title: item.title,
      excerpt: item.excerpt,
      evidenceType: item.sourceType as OfficialProductCandidate['evidence'][number]['evidenceType'],
    })),
  };
}

async function discoveryFromParentRun(
  parentRunId: string,
  scope: { readonly country: 'BR'; readonly brand: string },
  env: Readonly<Record<string, string | undefined>>,
): Promise<CurrentMmvDiscoverySnapshot> {
  const { AgentPlatformSupabaseAdapter, createLegacySupabaseClient } =
    await import('@compra-car/adapter-supabase');
  const platform = new AgentPlatformSupabaseAdapter(
    createLegacySupabaseClient({
      url: env.SUPABASE_URL!,
      serverKey: env.SUPABASE_SERVER_KEY!,
    }),
  );
  const parent = await platform.getRun(parentRunId);
  if (!parent || parent.run.agentType !== 'MMV_DISCOVERY' || parent.run.status !== 'COMPLETED')
    throw new Error('MODEL_YEAR_PARENT_MMV_RUN_REQUIRED');
  if (parent.run.brand !== scope.brand || parent.run.market !== scope.country)
    throw new Error('MODEL_YEAR_PARENT_MMV_SCOPE_MISMATCH');

  const candidates: OfficialProductCandidate[] = [];
  for (const bundle of parent.findings) {
    const evidence = bundle.evidence.map((item) => ({
      sourceUrl: item.sourceUrl,
      title: item.title,
      excerpt: item.excerpt,
      sourceType: item.sourceType,
    }));
    const structured = candidateWithEvidence(bundle.finding.payload.structuredCandidate, evidence);
    if (structured) candidates.push(structured);
    const variants = bundle.finding.payload.resolvedVariants;
    if (Array.isArray(variants)) {
      for (const variant of variants) {
        const resolved = candidateWithEvidence(variant, evidence);
        if (resolved) candidates.push(resolved);
      }
    }
  }

  const deduped = [
    ...new Map(
      candidates.map((candidate) => [
        [
          candidate.brand,
          candidate.model,
          candidate.officialVersionLabel ?? candidate.trim ?? '',
          candidate.productionYear ?? '',
          candidate.modelYear ?? '',
        ].join('\u001f'),
        candidate,
      ]),
    ).values(),
  ];
  if (!deduped.length) throw new Error('MODEL_YEAR_PARENT_MMV_SNAPSHOT_EMPTY');

  const startedAt = new Date().toISOString();
  return {
    schemaVersion: '20C.1',
    runId: randomUUID(),
    startedAt,
    completedAt: new Date().toISOString(),
    brand: scope.brand,
    market: scope.country,
    researchedCandidates: deduped.length,
    acceptedCandidates: deduped.length,
    modelsDiscovered: new Set(deduped.map((candidate) => candidate.model)).size,
    variantsResolved: deduped.filter((candidate) => Boolean(candidate.officialVersionLabel ?? candidate.trim)).length,
    observations: deduped,
    candidates: deduped,
    bodyModelProposals: [],
    rejectedCandidates: [],
    rejectedExternalSources: 0,
    researchMetadata: {
      provider: 'reused-mmv-run',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      webSearchCount: 0,
    },
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
    const { scope, provider, persistFindings, parentRunId } = parseModelYearArguments(args);
    env = await loadAgentEnvironment(repositoryRoot, env);
    if (provider === 'openai' && !parentRunId && (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim()))
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
        : parentRunId
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

    const discovery = parentRunId
      ? await discoveryFromParentRun(parentRunId, scope, env)
      : await new CurrentMmvDiscoveryAgent({
          research,
          connectorResolver,
        }).run(scope, randomUUID());
    log('Run: ' + discovery.runId);
    if (parentRunId) log('Reused MMV run: ' + parentRunId + ' | OpenAI calls: 0');

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
    const bundle = mapModelYearRunToPlatform(discovery, result, { provider: parentRunId ? 'reused-mmv-run' : provider });

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
