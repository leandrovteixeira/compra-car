import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  NewProductCheckAgent,
  AdministrativeProductCatalogReader,
  FixtureProductCatalogReader,
  FixtureProductResearchProvider,
  officialBrandSource,
  productCheckFixture,
  benchmarkProductFixture,
} from '@compra-car/core/agents';
import {
  OpenAIProductResearchProvider,
  ProductResearchProviderError,
} from '@compra-car/adapter-openai';
import { LocalProductReportWriter } from './report-writer';

export function parseAgentArguments(args: readonly string[]) {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  const options = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index],
      value = values[index + 1];
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
  const scope = officialBrandSource({ country: 'BR', brand });
  return { scope: { country: scope.country, brand: scope.brand }, provider };
}

export async function runNewProductCheckCli(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  log: (message: string) => void = console.log,
  repositoryRoot = fileURLToPath(new URL('../../', import.meta.url)),
): Promise<number> {
  let stage = 'arguments';
  try {
    const { scope, provider } = parseAgentArguments(args);
    stage = 'configuration';
    if (
      provider === 'openai' &&
      (!env.OPENAI_API_KEY?.trim() ||
        !env.OPENAI_AGENT_MODEL?.trim() ||
        !env.SUPABASE_URL?.trim() ||
        !env.SUPABASE_SERVER_KEY?.trim())
    ) {
      log(
        'Configuration required: OPENAI_API_KEY, OPENAI_AGENT_MODEL, SUPABASE_URL, SUPABASE_SERVER_KEY.',
      );
      return 1;
    }
    const secrets = [env.OPENAI_API_KEY ?? '', env.SUPABASE_SERVER_KEY ?? ''];
    const reports = new LocalProductReportWriter(repositoryRoot, secrets);
    const research =
      provider === 'fixture'
        ? new FixtureProductResearchProvider()
        : new OpenAIProductResearchProvider({
            apiKey: env.OPENAI_API_KEY!,
            model: env.OPENAI_AGENT_MODEL!,
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
    stage = 'research/catalog/matching/report';
    const result = await new NewProductCheckAgent({ research, catalog, reports }).run(scope, runId);
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
    log('Reports: .local-reports/agents/new-product-check/' + runId + '.{json,md}');
    return 0;
  } catch (error) {
    // Never print error.message, cause, headers, environment or provider output.
    log(
      error instanceof ProductResearchProviderError
        ? error.code
        : 'NEW_PRODUCT_CHECK_FAILED (' + stage + ')',
    );
    return 1;
  }
}
