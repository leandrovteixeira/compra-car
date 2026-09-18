import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSpecSourceTargets,
  connectorOfficialSource,
  modelYearFixture,
  specText,
  type SpecSemanticProvider,
  type DocumentIntelligenceProvider,
  type SpecDiscoveryProvider,
} from '@compra-car/core/agents';
import { loadAgentEnvironment } from './agent-environment';
import { redactSecrets } from './report-writer';
import { runSpecSources, type SpecRunOptions } from './spec-source-runtime';
import { SpecOfficialFetcher } from './spec-source-fetch';
export function parseSpecSourceArguments(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : [...args],
    flags = new Map<string, string>();
  const allowed = [
    'brand',
    'model',
    'version',
    'my',
    'provider',
    'mode',
    'max-targets',
    'max-sources',
    'max-discovery-depth',
    'max-semantic-calls',
    'discovery-run',
  ];
  for (let i = 0; i < values.length; i += 2) {
    const name = values[i]?.replace(/^--/u, ''),
      value = values[i + 1];
    if (
      !name ||
      !values[i]?.startsWith('--') ||
      !allowed.includes(name) ||
      !value ||
      value.startsWith('--') ||
      flags.has(name)
    )
      throw new Error('INVALID_AGENT_ARGUMENTS');
    flags.set(name, value);
  }
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = flags.get(key) ?? String(fallback),
      n = Number(raw);
    if (!/^\d+$/u.test(raw) || !Number.isSafeInteger(n) || n < min || n > max)
      throw new Error('INVALID_AGENT_ARGUMENTS');
    return n;
  };
  const brand = flags.get('brand'),
    model = flags.get('model'),
    version = flags.get('version');
  if (!brand || !model || !version || !flags.has('my'))
    throw new Error('EXACT_TARGET_FILTERS_REQUIRED');
  const provider = flags.get('provider') ?? 'fixture',
    mode = flags.get('mode') ?? 'baseline';
  if (
    !['fixture', 'structured', 'hybrid'].includes(provider) ||
    !['baseline', 'monitor'].includes(mode)
  )
    throw new Error('INVALID_AGENT_ARGUMENTS');
  const discoveryRun = flags.get('discovery-run');
  if (discoveryRun && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(discoveryRun))
    throw new Error('INVALID_AGENT_ARGUMENTS');
  return {
    brand,
    model,
    version,
    modelYear: integer('my', 0, 1000, 9999),
    discoveryRun,
    options: {
      provider,
      mode,
      maxTargets: integer('max-targets', 1, 1, 10),
      maxSources: integer('max-sources', 3, 1, 10),
      maxDiscoveryDepth: integer('max-discovery-depth', 2, 0, 2),
      maxSemanticCalls: integer('max-semantic-calls', 0, 0, 1),
    } as SpecRunOptions,
  };
}
export async function runSpecSourceCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (value: string) => void = console.log,
  root = fileURLToPath(new URL('../../', import.meta.url)),
) {
  try {
    const parsed = parseSpecSourceArguments(args),
      scope = { country: 'BR' as const, brand: parsed.brand };
    env = await loadAgentEnvironment(root, env);
    let context,
      fetcher: SpecOfficialFetcher | undefined,
      semantic: SpecSemanticProvider | undefined,
      discovery: SpecDiscoveryProvider | undefined,
      documentIntelligence: DocumentIntelligenceProvider | undefined;
    if (parsed.options.provider === 'fixture') {
      const fixture = modelYearFixture(parsed.brand);
      context = { connector: fixture.active, discovery: fixture.context, rows: fixture.rows };
      // Synthetic transport only; never falls through to global fetch.
      fetcher = new SpecOfficialFetcher(
        async () =>
          new Response(
            '<section data-model="' +
              parsed.model +
              '" data-version="' +
              parsed.version +
              '" data-model-year="' +
              parsed.modelYear +
              '"><dl><dt>Potência</dt><dd>128 cv</dd></dl></section>',
            { headers: { 'content-type': 'text/html' } },
          ),
      );
      context.connector = {
        ...context.connector,
        sourceEntries: [
          {
            type: 'MODEL_PAGE',
            url:
              'https://' +
              context.connector.allowedDomains[0] +
              '/' +
              specText(parsed.model).replace(/\s+/gu, '-'),
            priority: 1,
          },
        ],
      };
    } else {
      const { createSpecSourceContext } =
        await import('@compra-car/adapter-supabase/spec-source-context');
      context = await createSpecSourceContext({
        url: env.SUPABASE_URL ?? '',
        serverKey: env.SUPABASE_SERVER_KEY ?? '',
      }).read(scope, parsed.discoveryRun);
      if (parsed.options.provider === 'hybrid') {
        const { OpenAIDocumentIntelligenceProvider } = await import('@compra-car/adapter-openai');
        documentIntelligence = new OpenAIDocumentIntelligenceProvider({
          apiKey: env.OPENAI_API_KEY ?? '',
        });
      }
      if (parsed.options.provider === 'hybrid' && parsed.options.maxSemanticCalls > 0) {
        discovery = {
          async discover(target, source) {
            if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())
              throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
            const { OpenAISpecDiscoveryProvider } = await import('@compra-car/adapter-openai');
            return new OpenAISpecDiscoveryProvider({
              apiKey: env.OPENAI_API_KEY,
              model: env.OPENAI_AGENT_MODEL,
            }).discover(target, source);
          },
        };
        semantic = {
          async extract(input) {
            if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())
              throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');
            const { OpenAISpecSourceProvider } = await import('@compra-car/adapter-openai');
            return new OpenAISpecSourceProvider({
              apiKey: env.OPENAI_API_KEY,
              model: env.OPENAI_AGENT_MODEL,
            }).extract(input);
          },
        };
      }
    }
    const eligible = buildSpecSourceTargets(
      context.discovery,
      context.rows,
      scope,
      connectorOfficialSource(context.connector),
    );
    const targets = eligible.filter(
      (t) =>
        specText(t.model) === specText(parsed.model) &&
        specText(t.officialVersionLabel) === specText(parsed.version) &&
        t.modelYear === parsed.modelYear,
    );
    if (targets.length !== 1) throw new Error('EXACT_RESOLVED_TARGET_REQUIRED');
    const result = await runSpecSources(
      targets,
      context.connector,
      parsed.options,
      fetcher,
      semantic,
      discovery,
      (ranking) =>
        log(
          'RANKED_BEFORE_FETCH ' +
            JSON.stringify(
              ranking.slice(0, 15).map((c, i) => ({
                rank: i + 1,
                roles: c.roles,
                selectionReason: c.selectionReason,
                url: c.url,
                score: c.score,
                scoreReasons: c.scoreReasons,
                kind: c.sourceKindCandidate,
                target: c.targetBindingSignals,
                my: c.myBindingSignals,
              })),
            ),
        ),
      documentIntelligence,
    );
    const report = JSON.stringify(
      {
        ...result,
        discoveryRunId: context.discovery?.run.id,
        activeConnectorId: context.connector.id,
      },
      null,
      2,
    );
    const clean = redactSecrets(report, [env.OPENAI_API_KEY ?? '', env.SUPABASE_SERVER_KEY ?? '']);
    const directory = resolve(root, '.local-reports/agents/spec-source');
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, new Date().toISOString().replace(/[:.]/gu, '-') + '.json');
    await writeFile(path, clean + '\n');
    log(clean);
    log('Report: ' + path);
    return 0;
  } catch (error) {
    log(
      error instanceof Error && /^[A-Z_]+$/u.test(error.message)
        ? error.message
        : 'SPEC_SOURCE_FAILED',
    );
    return 1;
  }
}
