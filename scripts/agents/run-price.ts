import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DeterministicFirstPriceResearch,
  PriceAgent,
  validateConnectorDefinition,
  connectorFingerprint,
  connectorEntryPriceKind,
  makePriceSnapshot,
  type PriceSourceKind,
} from '@compra-car/core/agents';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';
import {
  AgentPlatformSupabaseAdapter,
  createLegacySupabaseClient,
} from '@compra-car/adapter-supabase';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { PriceAgentSupabaseCatalogReader, PriceAgentSupabaseTelemetry } from '@compra-car/adapter-supabase/price-agent-context';
import { loadAgentEnvironment } from './agent-environment';
import { redactSecrets } from './report-writer';
import { agentOpenAiApiKey,agentOpenAiSecrets,requireAgentOpenAiApiKey } from './agent-openai-credentials';
import { officialGwmPricePageForTarget, isCompetingGwmProductPage, resolveGwmPageCandidates, officialGwmProductPriceCoverage } from './gwm-price-sources';
import { recordEngineeringRunEvent } from './engineering-run-log';
import { engineeringFailureReason } from './engineering-failure-reason';

function safePriceFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'PRICE_AGENT_FAILED';
  const message = error.message.replace(/[\r\n\t]/gu, ' ').slice(0, 1200);
  if (
    /^(?:CONNECTOR_READ_FAILED|SUPABASE_AGENT_CONFIG_REQUIRED|BRAND_CONNECTOR_REQUIRED|PRICE_[A-Z_]+|INVALID_AGENT_ARGUMENTS)(?::|$)/u.test(
      message,
    )
  )
    return 'PRICE_AGENT_FAILED: ' + message;
  return 'PRICE_AGENT_FAILED';
}

function parse(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  let brand: string | null = null,
    persistFindings = false,
    auditOnly = false,
    shadowConnectorRunId: string | null = null;
  for (let i = 0; i < values.length; i++) {
    const token = values[i]!;
    if (token === '--audit-only') {
      auditOnly = true;
      continue;
    }
    if (token === '--persist-findings') {
      persistFindings = true;
      continue;
    }
    if (token === '--shadow-connector-run-id') {
      shadowConnectorRunId = values[++i]?.trim() || null;
      continue;
    }
    if (token === '--brand') {
      brand = values[++i]?.trim() || null;
      continue;
    }
    throw new Error('INVALID_AGENT_ARGUMENTS');
  }
  if (!brand) throw new Error('INVALID_AGENT_ARGUMENTS');
  if (shadowConnectorRunId && !/^[0-9a-f-]{36}$/iu.test(shadowConnectorRunId))
    throw new Error('INVALID_AGENT_ARGUMENTS');
  if (auditOnly && persistFindings) throw new Error('PRICE_AUDIT_CONFLICTING_FLAGS');
  return { brand, persistFindings, auditOnly, shadowConnectorRunId };
}

export function entryAppliesToTarget(
  entry: { readonly type: string; readonly url: string },
  model: string,
): boolean {
  if (entry.type === 'PRICE_LIST') return true;
  if (!['MODEL_PAGE', 'CONFIGURATOR'].includes(entry.type)) return true;
  try {
    const path = decodeURIComponent(new URL(entry.url).pathname);
    const slug = (value: string) => value.normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
    const compact = (value: string) => slug(value).replace(/-/gu, '');
    const modelSlug = slug(model);
    const tokens = modelSlug.split('-').filter(Boolean);
    if (!tokens.length) return false;
    const segments = path.split('/').map(x => slug(x.replace(/\\.[a-z0-9]+$/iu, '')));
    return segments.some(segment => {
      if (!segment) return false;
      // ORA 5 -> /ora5 and TANK 300 -> /tank-300.
      if (segment === modelSlug || segment.startsWith(modelSlug + '-')) return true;
      if (compact(segment) === compact(modelSlug)) return true;
      // A version-specific name can use a base model page, but require
      // at least the two-token family prefix (HAVAL H6, ORA 03, TANK 300).
      if (tokens.length >= 3) {
        const family = tokens.slice(0,2).join('-');
        return segment === family || compact(segment) === compact(family) ||
          segment.startsWith(family + '-');
      }
      return false;
    });
  } catch {
    return false;
  }
}

function kindForEntry(type: string): PriceSourceKind | null {
  if (type === 'PRICE_LIST') return 'OFFICIAL_PRICE_LIST';
  if (type === 'CONFIGURATOR') return 'OFFICIAL_CONFIGURATOR';
  if (type === 'MODEL_PAGE') return 'OFFICIAL_MODEL_PAGE';
  return null;
}

function priceBudget(raw: string | undefined): number {
  if (raw === undefined) return 1;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > 2) throw new Error('INVALID_AGENT_ARGUMENTS');
  return value;
}

async function supplementalMappingSnapshots(
  result: Awaited<ReturnType<PriceAgent['run']>>,
) {
  const out = [...result.research.snapshots];
  const existing = new Set(
    out.map((snapshot) => {
      try {
        const url = new URL(snapshot.finalUrl);
        return url.origin.toLowerCase() + url.pathname.replace(/\/$/u, '').toLowerCase();
      } catch {
        return snapshot.finalUrl;
      }
    }),
  );
  const byId = new Map(result.targets.map((target) => [target.productId, target]));

  for (const mapping of result.research.mappings ?? []) {
    let sourceKey: string;
    try {
      const url = new URL(mapping.sourceUrl);
      sourceKey = url.origin.toLowerCase() + url.pathname.replace(/\/$/u, '').toLowerCase();
    } catch {
      continue;
    }
    if (existing.has(sourceKey)) continue;
    const target = byId.get(mapping.productId);
    if (!target) continue;

    try {
      const response = await fetch(mapping.sourceUrl, {
        headers: {
          'user-agent': 'CompraCarPriceAgent/1.0',
          accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const snapshot = makePriceSnapshot({
        target,
        sourceUrl: response.url,
        sourceKind: 'OFFICIAL_MODEL_PAGE',
        body: await response.text(),
      });
      out.push(snapshot);
      existing.add(sourceKey);
    } catch {
      /* evidence fingerprint enrichment is best-effort; never changes pricing output */
    }
  }
  return out;
}

async function operationalResearch(
  env: Readonly<Record<string, string | undefined>>,
  diagnostic: (line: string) => void = () => {},
  connectorOnly = false,
) {
  const requestCache = new Map<string, Promise<{ body: string; finalUrl: string } | null>>();
  const compactEnabled = env.PRICE_AGENT_COMPACT_MATCH_ENABLED === '1';
  const reconciliation = !compactEnabled && env.PRICE_AGENT_LLM_ENABLED === '1' && agentOpenAiApiKey(env,'PRICE_INTELLIGENCE')
    ? new (await import('@compra-car/adapter-openai')).OpenAIPriceReconciliationProvider({
        apiKey: requireAgentOpenAiApiKey(env,'PRICE_INTELLIGENCE'),
        models: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'],
        maxToolCalls: 2,
        maxOutputTokens: 1800,
      })
    : undefined;

  const compactMatcher = compactEnabled
    ? new (await import('@compra-car/adapter-openai')).OpenAICompactPriceMatcher(
        requireAgentOpenAiApiKey(env,'PRICE_INTELLIGENCE'),
      ) : undefined;
  return new DeterministicFirstPriceResearch({
    reconciliation,
    compactMatcher,
    hardCostCapUsd: priceBudget(env.PRICE_AGENT_HARD_COST_CAP_USD),
    fetch: async (target, connector) => {
      const out = [];
      const officialProductPage = connectorOnly ? null : officialGwmPricePageForTarget(target);
      // QA transitional bootstrap only. Once the Brand Connector owns the
      // dedicated page, do not inject it a second time.
      const alreadyInConnector = officialProductPage !== null &&
        connector.sourceEntries.some(entry => entry.url === officialProductPage);
      const entries = [
        // Dedicated first-party product pages take precedence over old news and
        // previously discovered URLs; do not mix prices across H6 trims.
        ...(officialProductPage && !alreadyInConnector ? [{
          type: 'MODEL_PAGE' as const,
          url: officialProductPage,
          priority: -500,
        }] : []),
        ...connector.sourceEntries,
        ...(target.knownOfficialPriceUrls ?? []).map(url => ({
          // Historic URLs remain only hints; download fresh official content.
          type: 'PRICE_LIST' as const, url, priority: -200,
        })),
        ...(target.knownPriceReconciliations ?? [])
          .filter((item) => item.sourceFingerprint)
          .map((item) => ({
            type: 'MODEL_PAGE' as const,
            url: item.sourceUrl,
            priority: -100,
          })),
      ];
      const seen = new Set<string>();
      let approvedCount=0, applicableCount=0, failedFetchCount=0;

      for (const entry of [...entries].sort((a, b) => a.priority - b.priority)) {
        // Never fetch an AI-suggested address outside the trusted connector hosts.
        let approved = false;
        try {
          const url = new URL(entry.url);
          approved = url.protocol === 'https:' &&
            connector.allowedDomains.some(domain => {
              const host = domain.toLowerCase().replace(/^www\\./u,'');
              const candidate = url.hostname.toLowerCase().replace(/^www\\./u,'');
              return candidate===host || candidate.endsWith('.'+host);
            });
        } catch { /* malformed evidence is ignored */ }
        if (!approved) continue;
        approvedCount++;
        if (seen.has(entry.url)) continue;
        seen.add(entry.url);
        if (isCompetingGwmProductPage(target, entry.url)) continue;
        if (!entryAppliesToTarget(entry, target.model)) continue;
        const sourceKind = connectorEntryPriceKind(entry as Parameters<typeof connectorEntryPriceKind>[0]) ?? kindForEntry(entry.type);
        if (!sourceKind) continue;
        applicableCount++;

        let pending = requestCache.get(entry.url);
        if (!pending) {
          pending = (async () => {
            try {
              const response = await fetch(entry.url, {
                headers: {
                  'user-agent': 'CompraCarPriceAgent/1.0',
                  accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.1',
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(15000),
              });
              if (!response.ok) return null;
              return { body: await response.text(), finalUrl: response.url };
            } catch {
              return null;
            }
          })();
          requestCache.set(entry.url, pending);
        }

        const loaded = await pending;
        if (!loaded) { failedFetchCount++; continue; }
        out.push(
          makePriceSnapshot({
            target,
            sourceUrl: loaded.finalUrl,
            sourceKind,
            body: loaded.body,
          }),
        );
      }
      diagnostic('PRICE_SOURCE_DIAGNOSTIC model=' + target.model +
        ' historical=' + (target.knownOfficialPriceUrls?.length ?? 0) +
        ' candidate=' + entries.length + ' allowed=' + approvedCount +
        ' applicable=' + applicableCount + ' fetched=' + out.length +
        ' unavailable=' + failedFetchCount);
      return out;
    },
  });
}

export async function runPriceCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (value: string) => void = console.log,
  root = fileURLToPath(new URL('../../', import.meta.url)),
  dependencies: {
    agent?: PriceAgent;
    persistence?: Pick<AgentPlatformRepository, 'persistRunBundle'>;
  } = {},
): Promise<number> {
  const started = performance.now();
  const attemptId = randomUUID();
  let attemptedBrand = 'unknown';
  try {
    const { brand, persistFindings, auditOnly, shadowConnectorRunId } = parse(args);
    attemptedBrand = brand;
    env = await loadAgentEnvironment(root, env);
    if (env.PRICE_AGENT_LLM_ENABLED === '1' ||
        env.PRICE_AGENT_COMPACT_MATCH_ENABLED === '1')
      requireAgentOpenAiApiKey(env,'PRICE_INTELLIGENCE');

    let agent = dependencies.agent;
    let persistence = dependencies.persistence;
    let telemetry: PriceAgentSupabaseTelemetry | undefined;

    if (!agent || ((persistFindings || auditOnly) && !persistence)) {
      if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
        throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');

      const client = createLegacySupabaseClient({
        url: env.SUPABASE_URL,
        serverKey: env.SUPABASE_SERVER_KEY,
      });
      const connectors = new BrandConnectorSupabaseAdapter(client);
      const platform = new AgentPlatformSupabaseAdapter(client);
      persistence ??= platform;
      telemetry = new PriceAgentSupabaseTelemetry(client);

      // QA shadow mode reads a completed Brand discovery proposal, never
      // activates it or changes the approved connector in the database.
      let shadowSources: ReturnType<typeof validateConnectorDefinition> | null = null;
      if (shadowConnectorRunId) {
        if (env.APP_ENV !== 'qa') throw new Error('PRICE_SHADOW_QA_ONLY');
        const {data:parent,error:parentError} = await client.from('agent_runs')
          .select('agent_type,status,brand,market').eq('id',shadowConnectorRunId).single();
        if(parentError || !parent || parent.agent_type!=='BRAND_CONNECTOR' ||
           parent.status!=='COMPLETED' || parent.brand!==brand || parent.market!=='BR')
          throw new Error('PRICE_SHADOW_PARENT_INVALID');
        const {data:proposals,error:proposalError} = await client.from('agent_findings')
          .select('proposal').eq('run_id',shadowConnectorRunId).limit(2);
        if(proposalError || proposals?.length!==1 || !proposals[0]?.proposal)
          throw new Error('PRICE_SHADOW_PROPOSAL_REQUIRED');
        const proposal = validateConnectorDefinition(proposals[0].proposal);
        if(proposal.brand!==brand || proposal.market!=='BR') throw new Error('PRICE_SHADOW_SCOPE_MISMATCH');
        shadowSources = proposal;
      }

      agent ??= new PriceAgent({
        // The QA Product Year registry now uses UUID MMV identities. The legacy
        // Price selection reader uses text identities and would silently drop
        // valid targets; use the active catalog until a registry-backed reader lands.
        catalog: new PriceAgentSupabaseCatalogReader(client),
        connector: shadowSources ? {
          async getActiveConnector(targetBrand: string, market: string) {
            const active = await connectors.getActiveConnector(targetBrand, market);
            if (!active) {
              // Brand-from-zero test only: ephemeral official proposal adapter.
              // This is never inserted into brand_connectors or activated.
              const now = new Date().toISOString();
              return {
                ...shadowSources!,
                id: shadowConnectorRunId!,
                targetId: shadowConnectorRunId!,
                version: 0,
                status: 'ACTIVE' as const,
                fingerprint: connectorFingerprint(shadowSources!),
                sourceFindingId: null,
                activatedBy: null,
                activatedAt: now,
                supersededAt: null,
                createdAt: now,
              };
            }
            const existing = new Set(active.sourceEntries.map(s=>s.url));
            return {...active, sourceEntries:[...active.sourceEntries,
              ...shadowSources!.sourceEntries.filter(s=>!existing.has(s.url))]};
          },
        } : connectors,
        research: await operationalResearch(env,log,Boolean(shadowConnectorRunId)),
      });
    }

    const result = await agent.run(
      brand,
      'BR',
      env.PRICE_AGENT_COMPACT_MATCH_ENABLED === '1'
        ? 'compact-identity-only'
        : env.PRICE_AGENT_LLM_ENABLED === '1' && agentOpenAiApiKey(env,'PRICE_INTELLIGENCE')
          ? 'hybrid' : 'deterministic',
    );

    // The core research pipeline now owns source-first extraction.
    // Keep QA audit details in the persisted run summary for every candidate,
    // including unresolved model/MY, without creating financial findings.
    const sourceCandidates = resolveGwmPageCandidates(result.targets,
      result.research.sourceFirstCandidates ?? []);
    const officialCoverage = officialGwmProductPriceCoverage(result.targets, sourceCandidates);
    if (brand.toUpperCase() === 'GWM') {
      log('PRICE_GWM_PRODUCT_PAGE_COVERAGE ' + JSON.stringify(officialCoverage));
    }
    const shadow = {
      extracted: sourceCandidates.length,
      matched: sourceCandidates.filter(c => c.status === 'MATCHED').length,
      ambiguous: sourceCandidates.filter(c => c.status === 'AMBIGUOUS').length,
      unresolved: sourceCandidates.filter(c => c.status === 'UNRESOLVED').length,
    };
    const rawSeen = new Set(result.research.snapshots.map(s => s.finalUrl + '|' + s.contentHash));
    log('PRICE_SOURCE_FIRST_AUDIT ' + JSON.stringify(shadow));

    if (telemetry) {
      const fingerprintSnapshots = await supplementalMappingSnapshots(result);
      await telemetry.persistMappings(
        'BR',
        brand,
        result.targets,
        result.research.mappings ?? [],
        fingerprintSnapshots,
      );
      await telemetry.persistUsage({
        runId: result.bundle.run.id,
        market: 'BR',
        brand,
        usage: result.research.usage ?? [],
      });
    }

    const clean = JSON.parse(
      redactSecrets(JSON.stringify(result), [
        env.SUPABASE_SERVER_KEY ?? '',
        ...agentOpenAiSecrets(env),
      ]),
    ) as typeof result;

    // Persist experimental coverage metrics with the run, not only worker stdout.
    // This does not affect the canonical findings or approved public prices.
    const audited = {
      ...clean,
      bundle: {
        ...clean.bundle,
        run: {
          ...clean.bundle.run,
          summary: {
            ...clean.bundle.run.summary,
            sourceFirstExtracted: shadow.extracted,
            sourceFirstMatched: shadow.matched,
            sourceFirstAmbiguous: shadow.ambiguous,
            sourceFirstUnresolved: shadow.unresolved,
            sourceFirstSnapshots: rawSeen.size,
            compactAiDecisionCount: result.research.compactMatchDecisions?.length ?? 0,
            compactAiIdentityMatches:
              result.research.compactMatchDecisions?.filter(
                c => c.status === 'IDENTITY_MATCHED_MY_UNVERIFIED' || c.status === 'VERIFIED_IDENTITY'
              ).length ?? 0,
            compactAiDecisions: (result.research.compactMatchDecisions ?? []).map(
              decision => ({
                candidateIndex: decision.candidateIndex,
                sourceUrl: sourceCandidates[decision.candidateIndex]?.sourceUrl ?? null,
                productId: decision.productId,
                status: decision.status,
                reason: decision.reason,
              }),
            ),

            gwmProductPagesExpected: officialCoverage.expected,
            gwmProductPagesPriced: officialCoverage.priced,
            gwmProductPagesMissing: officialCoverage.missing.length,
            gwmMissingProductPages: officialCoverage.missing,

            sourceFirstCandidates: sourceCandidates.slice(0, 40).map(item => ({
              sourceUrl: item.sourceUrl,
              amount: item.amount,
              kind: item.kind,
              method: item.method,
              status: item.status,
              candidateProductIds: [...item.candidateProductIds],
              reason: item.reason,
            })),

          },
        },
      },
    };

    const directory = resolve(root, '.local-reports/agents/price');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, clean.bundle.run.id + '.json'),
      JSON.stringify(audited, null, 2) + '\n',
    );

    if (auditOnly) {
      // QA operational audit: durable run metadata, zero review findings.
      await persistence!.persistRunBundle({ ...audited.bundle, findings: [] });
    }
    if (persistFindings) {
      await persistence!.persistRunBundle(audited.bundle);
      // Nonblocking price verification journal: a journal outage must not
      // invalidate a completed discovery or re-apply catalog changes.
      if (telemetry) {
        try {
          await telemetry.persistPriceObservations({
            runId: clean.bundle.run.id,
            targets: clean.targets,
            observations: clean.research.observations,
          });
        } catch {
          log('PRICE_OBSERVATION_JOURNAL_WRITE_FAILED');
        }
      }
    }
    try {
      const usages = clean.research.usage ?? [];
      await recordEngineeringRunEvent(resolve(root,'.local-reports/agents/engineering/run-events.jsonl'),{
        schemaVersion:'engineering-run-event-v1',runId:clean.bundle.run.id,agent:'price',
        environment:'qa',timestamp:new Date().toISOString(),status:'SUCCESS',
        durationMs:Math.max(0,performance.now()-started),
        estimatedCostUsd:usages.length ? usages.reduce((sum,item)=>sum+item.estimatedCostUsd,0) : null,
        llmCalls:usages.length ? usages.length : null,sourceFingerprint:null,
        findingCount:clean.bundle.findings.length,failures:[],
      });
    } catch { /* Engineering telemetry never changes the canonical run outcome. */ }

    log(
      [
        'Run: ' + clean.bundle.run.id,
        'Brand: ' + brand,
        ...Object.entries(clean.bundle.run.summary).map(([key, value]) => key + ': ' + value),
        ...(clean.research.usage?.length
          ? [
              '',
              'AI usage:',
              ...clean.research.usage.map(
                (item) =>
                  item.model +
                  ': input=' +
                  item.inputTokens +
                  ' cached=' +
                  item.cachedInputTokens +
                  ' output=' +
                  item.outputTokens +
                  ' reasoning=' +
                  item.reasoningTokens +
                  ' web=' +
                  item.webSearchCount +
                  ' cost=$' +
                  item.estimatedCostUsd.toFixed(6),
              ),
            ]
          : []),
        ...(clean.research.diagnostics?.length
          ? [
              '',
              'Diagnostics:',
              ...clean.research.diagnostics.map(
                (item) =>
                  item.reason +
                  ' | ' +
                  item.target +
                  ' | ' +
                  item.sourceUrl +
                  ' | ' +
                  item.sample.replace(/[\r\n]+/gu, ' ').slice(0, 900),
              ),
            ]
          : []),
        persistFindings
          ? 'Findings persisted for review. Canonical pricing unchanged.'
          : 'Dry-run complete. Reconciliation cache/usage may be updated; canonical pricing unchanged.',
      ].join('\n'),
    );
    return 0;
  } catch (error) {
    try { await recordEngineeringRunEvent(resolve(root,'.local-reports/agents/engineering/run-events.jsonl'),{
      schemaVersion:'engineering-run-event-v1',runId:attemptId,agent:'price',environment:'qa',
      timestamp:new Date().toISOString(),status:'FAILED',durationMs:Math.max(0,performance.now()-started),
      estimatedCostUsd:null,llmCalls:null,sourceFingerprint:null,findingCount:null,
      failures:[{targetId:attemptId,brand:attemptedBrand,model:'unknown',sourceType:'agent',
        reason:engineeringFailureReason(error,'price'),sourceStructure:'unknown'}],
    }); } catch { /* preserve original failure */ }
    log(safePriceFailure(error));
    return 1;
  }
}
