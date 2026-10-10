import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DeterministicFirstPriceResearch,
  PlatformPriceModelYearSelectionReader,
  PriceAgent,
  connectorEntryPriceKind,
  makePriceSnapshot,
  type PriceSourceKind,
} from '@compra-car/core/agents';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';
import {
  AgentPlatformSupabaseAdapter,
  PriceAgentSupabaseCatalogReader,
  PriceAgentSupabaseTelemetry,
  createLegacySupabaseClient,
} from '@compra-car/adapter-supabase';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { loadAgentEnvironment } from './agent-environment';
import { redactSecrets } from './report-writer';
import { appendEngineeringRunEvent } from './engineering-run-log';

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
    persistFindings = false;
  for (let i = 0; i < values.length; i++) {
    const token = values[i]!;
    if (token === '--persist-findings') {
      persistFindings = true;
      continue;
    }
    if (token === '--brand') {
      brand = values[++i]?.trim() || null;
      continue;
    }
    throw new Error('INVALID_AGENT_ARGUMENTS');
  }
  if (!brand) throw new Error('INVALID_AGENT_ARGUMENTS');
  return { brand, persistFindings };
}

function entryAppliesToTarget(
  entry: { readonly type: string; readonly url: string },
  model: string,
): boolean {
  if (entry.type === 'PRICE_LIST') return true;
  if (!['MODEL_PAGE', 'CONFIGURATOR'].includes(entry.type)) return true;
  try {
    const path = new URL(entry.url).pathname.toLowerCase();
    const needle = model.trim().toLowerCase();
    return path.includes('/' + needle) || path.includes(needle + '.');
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
  if (!Number.isFinite(value) || value <= 0 || value > 10) throw new Error('INVALID_AGENT_ARGUMENTS');
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

async function operationalResearch(env: Readonly<Record<string, string | undefined>>) {
  const requestCache = new Map<string, Promise<{ body: string; finalUrl: string } | null>>();
  const reconciliation = env.OPENAI_API_KEY?.trim()
    ? new (await import('@compra-car/adapter-openai')).OpenAIPriceReconciliationProvider({
        apiKey: env.OPENAI_API_KEY,
        models: ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'],
        maxToolCalls: 2,
        maxOutputTokens: 1800,
      })
    : undefined;

  return new DeterministicFirstPriceResearch({
    reconciliation,
    hardCostCapUsd: priceBudget(env.PRICE_AGENT_HARD_COST_CAP_USD),
    fetch: async (target, connector) => {
      const out = [];
      const entries = [
        ...connector.sourceEntries,
        ...(target.knownPriceReconciliations ?? [])
          .filter((item) => item.sourceFingerprint)
          .map((item) => ({
            type: 'MODEL_PAGE' as const,
            url: item.sourceUrl,
            priority: -100,
          })),
      ];
      const seen = new Set<string>();

      for (const entry of [...entries].sort((a, b) => a.priority - b.priority)) {
        if (seen.has(entry.url)) continue;
        seen.add(entry.url);
        if (!entryAppliesToTarget(entry, target.model)) continue;
        const sourceKind = connectorEntryPriceKind(entry as Parameters<typeof connectorEntryPriceKind>[0]) ?? kindForEntry(entry.type);
        if (!sourceKind) continue;

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
        if (!loaded) continue;
        out.push(
          makePriceSnapshot({
            target,
            sourceUrl: loaded.finalUrl,
            sourceKind,
            body: loaded.body,
          }),
        );
      }
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
    const { brand, persistFindings } = parse(args);
    attemptedBrand = brand;
    env = await loadAgentEnvironment(root, env);

    let agent = dependencies.agent;
    let persistence = dependencies.persistence;
    let telemetry: PriceAgentSupabaseTelemetry | undefined;

    if (!agent || (persistFindings && !persistence)) {
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

      agent ??= new PriceAgent({
        catalog: new PriceAgentSupabaseCatalogReader(
          client,
          new PlatformPriceModelYearSelectionReader(platform),
        ),
        connector: connectors,
        research: await operationalResearch(env),
      });
    }

    const result = await agent.run(
      brand,
      'BR',
      env.OPENAI_API_KEY?.trim() ? 'hybrid' : 'deterministic',
    );

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
        env.OPENAI_API_KEY ?? '',
      ]),
    ) as typeof result;

    const directory = resolve(root, '.local-reports/agents/price');
    await mkdir(directory, { recursive: true });
    await writeFile(
      resolve(directory, clean.bundle.run.id + '.json'),
      JSON.stringify(clean, null, 2) + '\n',
    );

    if (persistFindings) await persistence!.persistRunBundle(clean.bundle);
    try {
      const usages = clean.research.usage ?? [];
      await appendEngineeringRunEvent(resolve(root,'.local-reports/agents/engineering/run-events.jsonl'),{
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
    try { await appendEngineeringRunEvent(resolve(root,'.local-reports/agents/engineering/run-events.jsonl'),{
      schemaVersion:'engineering-run-event-v1',runId:attemptId,agent:'price',environment:'qa',
      timestamp:new Date().toISOString(),status:'FAILED',durationMs:Math.max(0,performance.now()-started),
      estimatedCostUsd:null,llmCalls:null,sourceFingerprint:null,findingCount:null,
      failures:[{targetId:attemptId,brand:attemptedBrand,model:'unknown',sourceType:'agent',
        reason:'PRICE_RUN_FAILED',sourceStructure:'unknown'}],
    }); } catch { /* preserve original failure */ }
    log(safePriceFailure(error));
    return 1;
  }
}
