import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DeterministicFirstPriceResearch,
  PriceAgent,
  connectorEntryPriceKind,
  makePriceSnapshot,
  type PriceSourceKind,
} from '@compra-car/core/agents';
import type { AgentPlatformRepository } from '@compra-car/core/agent-platform';
import {
  AgentPlatformSupabaseAdapter,
  PriceAgentSupabaseCatalogReader,
  createLegacySupabaseClient,
} from '@compra-car/adapter-supabase';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { loadAgentEnvironment } from './agent-environment';
import { redactSecrets } from './report-writer';
import { safeAgentFailure } from './agent-diagnostics';

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

function kindForEntry(type: string): PriceSourceKind | null {
  if (type === 'PRICE_LIST') return 'OFFICIAL_PRICE_LIST';
  if (type === 'CONFIGURATOR') return 'OFFICIAL_CONFIGURATOR';
  if (type === 'MODEL_PAGE') return 'OFFICIAL_MODEL_PAGE';
  return null;
}

function operationalResearch() {
  const requestCache = new Map<string, Promise<{ body: string; finalUrl: string } | null>>();
  return new DeterministicFirstPriceResearch({
    fetch: async (target, connector) => {
      const out = [];
      for (const entry of [...connector.sourceEntries].sort((a, b) => a.priority - b.priority)) {
        const sourceKind = connectorEntryPriceKind(entry) ?? kindForEntry(entry.type);
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
) {
  try {
    const { brand, persistFindings } = parse(args);
    env = await loadAgentEnvironment(root, env);
    let agent = dependencies.agent,
      persistence = dependencies.persistence;

    if (!agent || (persistFindings && !persistence)) {
      if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
        throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
      const client = createLegacySupabaseClient({
        url: env.SUPABASE_URL,
        serverKey: env.SUPABASE_SERVER_KEY,
      });
      const connectors = new BrandConnectorSupabaseAdapter(client);
      persistence ??= new AgentPlatformSupabaseAdapter(client);
      agent ??= new PriceAgent({
        catalog: new PriceAgentSupabaseCatalogReader(client),
        connector: connectors,
        research: operationalResearch(),
      });
    }

    const result = await agent.run(brand, 'BR', 'deterministic');
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

    log(
      [
        'Run: ' + clean.bundle.run.id,
        'Brand: ' + brand,
        ...Object.entries(clean.bundle.run.summary).map(([key, value]) => key + ': ' + value),
        persistFindings
          ? 'Findings persisted for review. Pricing tables unchanged.'
          : 'Dry-run report written. Pricing tables unchanged.',
      ].join('\n'),
    );
    return 0;
  } catch (error) {
    log(safeAgentFailure('PRICE_AGENT_FAILED', error));
    return 1;
  }
}
