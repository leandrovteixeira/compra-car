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
import { recordAiUsage } from './ai-usage';
import { requireAgentOpenAiApiKey } from './agent-openai-credentials';

export function parseModelYearArguments(args: readonly string[]) {
  const values = args.filter((value) => value !== '--');
  const options = new Map<string, string>();
  let persistFindings = false;
  let noFipe = false;
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index];
    if (name === '--no-fipe') { noFipe = true; continue; }
    if (name === '--persist-findings') {
      if (persistFindings) throw new Error('INVALID_AGENT_ARGUMENTS');
      persistFindings = true;
      continue;
    }
    const value = values[++index];
    if (
      !['--brand', '--provider', '--parent-run-id', '--mmv-id'].includes(name ?? '') ||
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
  const mmvId = options.get('--mmv-id') ?? null;
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
    noFipe,
    mmvId,
  };
}


function candidateWithEvidence(
  value: unknown,
  evidence: readonly { sourceUrl: string; title: string | null; excerpt: string | null; sourceType: string }[],
  resolvedMmvId: string | null = null,
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
    resolvedMmvId,
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
    const canonicalMmvs = bundle.finding.subject.canonicalMmv;
    const resolvedMmvId =
      bundle.finding.findingType === 'MMV_MATCHED' &&
      Array.isArray(canonicalMmvs) &&
      canonicalMmvs.length === 1 &&
      canonicalMmvs[0] &&
      typeof canonicalMmvs[0] === 'object' &&
      typeof (canonicalMmvs[0] as { id?: unknown }).id === 'string'
        ? (canonicalMmvs[0] as { id: string }).id
        : null;
    const structured = candidateWithEvidence(
      bundle.finding.payload.structuredCandidate,
      evidence,
      resolvedMmvId,
    );
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
    const { scope, provider, persistFindings, parentRunId, noFipe, mmvId } = parseModelYearArguments(args);
    env = await loadAgentEnvironment(repositoryRoot, env);
    if (provider === 'openai' && !parentRunId) {
      requireAgentOpenAiApiKey(env, 'MODEL_YEAR');
      if (!env.OPENAI_AGENT_MODEL?.trim()) throw new Error('OPENAI_AGENT_MODEL_REQUIRED');
    }
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

    // For independent MY runs, guide research toward approved canonical MMVs.
    // A previous MMV run is not a sufficient source for MY/PY discovery.
    let canonicalYearTargets: readonly CanonicalMmv[] = [];
    if (provider === 'openai' && !parentRunId) {
      const {CanonicalMmvSupabaseAdapter,createLegacySupabaseClient} =
        await import('@compra-car/adapter-supabase');
      canonicalYearTargets=await new CanonicalMmvSupabaseAdapter(
        createLegacySupabaseClient({url:env.SUPABASE_URL!,serverKey:env.SUPABASE_SERVER_KEY!}),
      ).listCanonicalMmvs({market:'BR',brand:scope.brand,status:'ACTIVE'});
      const db=createLegacySupabaseClient({url:env.SUPABASE_URL!,serverKey:env.SUPABASE_SERVER_KEY!});
      const {data:eligibility,error:eligibilityError}=await db.from('agent_my_launch_eligibility')
        .select('mmv_id,eligibility').eq('brand',scope.brand);
      if(eligibilityError)throw new Error('MY_LAUNCH_ELIGIBILITY_READ_FAILED');
      const eligible=new Set((eligibility??[]).filter(x=>x.eligibility==='ELIGIBLE').map(x=>x.mmv_id));
      canonicalYearTargets=canonicalYearTargets.filter(m=>eligible.has(m.id) && (!mmvId||m.id===mmvId));
      if(canonicalYearTargets.length>1 && !mmvId)
        canonicalYearTargets=[canonicalYearTargets.sort((a,b)=>a.id.localeCompare(b.id))[0]!];
      if(!canonicalYearTargets.length){
        log('NO_MY_RESEARCH_REQUIRED: no launch MMV without canonical MY or pending FIPE coverage. OpenAI calls: 0');
        return 0;
      }
      if (!canonicalYearTargets.length) throw new Error('MODEL_YEAR_CANONICAL_MMVS_REQUIRED');
    }
    // FIPE preflight is read-only. Only confirmed mappings can constrain MY
    // research: a candidate mapping must never become an automatic identity.
    const fipePreflight: string[] = [];
    const fipeCoveredMmvs = new Set<string>();
    if (provider === 'openai' && !parentRunId && !noFipe) {
      const {createLegacySupabaseClient}=await import('@compra-car/adapter-supabase');
      const db=createLegacySupabaseClient({url:env.SUPABASE_URL!,serverKey:env.SUPABASE_SERVER_KEY!});
      for (const mmv of canonicalYearTargets) {
        const {data:mappings,error:mapError}=await db.from('catalog_mmv_fipe_mappings')
          .select('fipe_code,status,reference_period,model_year_hint')
          .eq('mmv_id',mmv.id).eq('status','CONFIRMED').limit(10);
        if(mapError)throw new Error('MY_FIPE_MAPPING_READ_FAILED');
        for(const mapping of mappings??[]) {
          const {data:values,error:valueError}=await db.from('agent_fipe_valuation_history')
            .select('model_year,reference_year,reference_month')
            .eq('fipe_code',mapping.fipe_code)
            .order('reference_year',{ascending:false})
            .order('reference_month',{ascending:false}).limit(150);
          if(valueError)throw new Error('MY_FIPE_VALUES_READ_FAILED');
          const years=new Set<number>();
          let zeroKm=false;
          const latest=values?.[0];
          for(const row of values??[]) {
            const parsed=Number(row.model_year);
            const latestReference=latest&&row.reference_year===latest.reference_year&&
              row.reference_month===latest.reference_month;
            if(parsed===32000){if(latestReference)zeroKm=true;continue;}
            if(Number.isInteger(parsed)&&parsed>=2001&&parsed<=2100)years.add(parsed);
          }
          // A current zero-km FIPE entry plus the highest actual MY for the
          // same code is a deterministic coverage signal, not sales proof.
          // Missing MY must first be proposed through the FIPE-to-MY flow.
          const now=new Date();
          const currentReference=!!latest && latest.reference_year===now.getUTCFullYear() &&
            latest.reference_month>=now.getUTCMonth()+1-1;
          const newestYear=years.size?Math.max(...years):null;
          if(currentReference&&zeroKm&&newestYear!==null)
            fipeCoveredMmvs.add(mmv.id);
          fipePreflight.push([
            mmv.id,mapping.fipe_code,
            'FIPE_MY='+([...years].sort((a,b)=>a-b).join(',')||'none'),
            'FIPE_ZERO_KM='+zeroKm,
            'FIPE_REFERENCE='+String(latest?latest.reference_month+'/'+latest.reference_year:(mapping.reference_period??'unspecified')),
          ].join(' | '));
        }
      }
    }
    if (provider==='openai'&&!parentRunId&&!noFipe) {
      const covered=canonicalYearTargets.filter(m=>fipeCoveredMmvs.has(m.id));
      for(const mmv of covered)
        log('MY FIPE-first: skip redundant source research for '+mmv.id+
          ' (latest FIPE MY with current zero-km reference; canonical MY approval handled separately).');
      canonicalYearTargets=canonicalYearTargets.filter(m=>!fipeCoveredMmvs.has(m.id));
      if(!canonicalYearTargets.length) {
        log('NO_MY_RESEARCH_REQUIRED: FIPE coverage complete. OpenAI calls: 0');
        return 0;
      }
    }
    const modelYearResearchInstructions = [
      'FIRST MODEL YEAR AT LAUNCH — determine only the initial commercial MY of the single listed canonical MMV in Brazil:',
      'Confirmed FIPE references (none means no verified mapping; never infer an absent MY):',
      ...(noFipe?['ISOLATED TEST: FIPE input deliberately disabled. Do not consult or rely on FIPE data.']:fipePreflight.length?fipePreflight:['No confirmed FIPE mappings available for these canonical identities.']),
      'FIPE year 32000 means zero-km valuation, not MY 32000. Only treat a current reference 0-km record and the maximum real MY of the SAME confirmed FIPE code as a lead for current sales, never proof.',
      ...canonicalYearTargets.map(m=>`- ${m.brand} ${m.model} | official version: ${m.officialVersionLabel ?? '(commercial version unspecified)'} | canonical ID: ${m.id}`),
      'Search only the listed MMV; identify its first launch MY, not the newest MY across years.',
      'Never propose a different model or variant as a fallback; if launch MY is unverified, report unknown.',
      'Prioritize explicit launch MY in the current or next calendar year; these are search hints, not forced answers.',
      'Look for official launch announcements, sales opening dates, current configurators and current price lists; a historic technical sheet only proves that the historic MY existed.',
      'For each MY, retain dated primary evidence identifying both the vehicle variant and the year. Search for newer FLEX derivatives and model-year rollover even if an old PDF remains online.',
      'Where a 2027 model replaced a 2026 model, return separate evidence-backed 2026 and 2027 candidates; never silently collapse them into one MY.',
      'If current on-sale status is not explicitly supported, do not assert it. Highest confirmed MY and currently on-sale MY are separate questions.',
      'Search official manufacturer model pages and published specifications for explicit model year and production year.',
      'Do not guess a year from the current calendar, a web publication date, or an unrelated variant. Missing year must remain null.',
      'Preserve precisely the canonical brand, model and commercial version; versionless vehicles must keep a null version.',
      'Only attach resolvedMmvId when the evidence uniquely identifies the matching canonical MMV.',
      'Do not use owners manuals or repair manuals as supporting sources.',
      'Return independent per-MMV candidates with year evidence; do not invent a commercial version.',
    ].join('\\n');

    const research =
      provider === 'fixture'
        ? new FixtureProductResearchProvider()
        : parentRunId
          ? new FixtureProductResearchProvider()
          : new OpenAIProductResearchProvider({
              apiKey: requireAgentOpenAiApiKey(env,'MODEL_YEAR'),
              model: env.OPENAI_AGENT_MODEL!,
              maxWaitMs: productResearchMaxWaitMs(env.OPENAI_AGENT_MAX_WAIT_MS),
              prompt: (await readFile(
                resolve(repositoryRoot, 'docs/agents/prompts/new-product-check-agent-v1.md'),
                'utf8',
              )) + '\\n\\n' + modelYearResearchInstructions,
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
            const allMmvs = await mmvRepository.listCanonicalMmvs({
              market: 'BR',
              brand: scope.brand,
              status: 'ACTIVE',
            });
            const mmvs = provider==='openai'&&!parentRunId ? allMmvs.filter(m=>canonicalYearTargets.some(t=>t.id===m.id)) : allMmvs;
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
      if (provider === 'openai' && !parentRunId) {
        const meta=discovery.researchMetadata;
        if (!meta.model || !Number.isFinite(meta.totalTokens) || !meta.totalTokens)
          throw new Error('MODEL_YEAR_PROVIDER_USAGE_MISSING');
        await recordAiUsage(
          createLegacySupabaseClient({
            url:env.SUPABASE_URL!,serverKey:env.SUPABASE_SERVER_KEY!,
          }),{
            runId:discovery.runId,agentType:'PRODUCT_YEAR',
            market:scope.country,brand:scope.brand,provider:meta.provider,
            model:meta.model,inputTokens:meta.inputTokens,
            outputTokens:meta.outputTokens,totalTokens:meta.totalTokens,
            webSearchCount:meta.webSearchCount,reason:'MODEL_YEAR_RESEARCH',
          },env,
        );
        log('Model Year provider token usage persisted.');
      }
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
