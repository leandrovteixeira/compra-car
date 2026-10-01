import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadAgentEnvironment } from './agent-environment';
import { runBrandConnectorCli } from './run-brand-connector';
import { runNewProductCheckCli } from './run-new-product-check';

export const MMV_MULTI_BRAND_VALIDATION_BRANDS = [
  'Toyota',
  'Jeep',
  'Volkswagen',
  'Audi',
] as const;

export type MmvMultiBrandValidationStatus =
  | 'MMV_RUN_COMPLETED'
  | 'CONNECTOR_REVIEW_REQUIRED'
  | 'FAILED';

export interface MmvMultiBrandValidationItem {
  readonly brand: string;
  readonly status: MmvMultiBrandValidationStatus;
  readonly connectorWasActive: boolean;
  readonly exitCode: number;
  readonly logs: readonly string[];
}

export async function runMmvMultiBrandValidation(
  env: Readonly<Record<string, string | undefined>> = process.env,
  root = fileURLToPath(new URL('../../', import.meta.url)),
): Promise<{
  readonly exitCode: number;
  readonly items: readonly MmvMultiBrandValidationItem[];
}> {
  env = await loadAgentEnvironment(root, env);
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
    throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
  if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())
    throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');

  const { createLegacySupabaseClient } = await import('@compra-car/adapter-supabase');
  const { BrandConnectorSupabaseAdapter } =
    await import('@compra-car/adapter-supabase/brand-connectors');
  const connectorRepository = new BrandConnectorSupabaseAdapter(
    createLegacySupabaseClient({
      url: env.SUPABASE_URL,
      serverKey: env.SUPABASE_SERVER_KEY,
    }),
  );

  const items: MmvMultiBrandValidationItem[] = [];

  for (const brand of MMV_MULTI_BRAND_VALIDATION_BRANDS) {
    const logs: string[] = [];
    const active = await connectorRepository.getActiveConnector(brand, 'BR');
    if (!active) {
      const code = await runBrandConnectorCli(
        [
          '--brand',
          brand,
          '--market',
          'BR',
          '--mode',
          'discover',
          '--provider',
          'openai',
          '--persist-findings',
        ],
        env,
        (message) => logs.push(message),
        root,
      );
      items.push({
        brand,
        status: code === 0 ? 'CONNECTOR_REVIEW_REQUIRED' : 'FAILED',
        connectorWasActive: false,
        exitCode: code,
        logs,
      });
      continue;
    }

    const code = await runNewProductCheckCli(
      [
        '--brand',
        brand,
        '--provider',
        'openai',
        '--persist-findings',
      ],
      env,
      (message) => logs.push(message),
      root,
    );
    items.push({
      brand,
      status: code === 0 ? 'MMV_RUN_COMPLETED' : 'FAILED',
      connectorWasActive: true,
      exitCode: code,
      logs,
    });
  }

  const directory = resolve(root, '.local-reports/agents/mmv-multibrand-validation');
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const report = {
    schemaVersion: '20F.1',
    createdAt: new Date().toISOString(),
    brands: MMV_MULTI_BRAND_VALIDATION_BRANDS,
    items,
    productionMutation: false,
    canonicalApplyExecuted: false,
  };
  await writeFile(resolve(directory, stamp + '.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(
    resolve(directory, stamp + '.md'),
    [
      '# Sprint 20F — Multi-brand Validation',
      '',
      ...items.flatMap((item) => [
        '## ' + item.brand,
        '',
        '- Status: ' + item.status,
        '- Connector active before run: ' + item.connectorWasActive,
        '- Exit code: ' + item.exitCode,
        ...item.logs.map((line) => '- ' + line.replace(/[\r\n]+/gu, ' ')),
        '',
      ]),
      'No connector activation or canonical MMV apply was executed automatically.',
      'Production was not mutated.',
      '',
    ].join('\n'),
  );

  return {
    exitCode: items.some((item) => item.status === 'FAILED') ? 1 : 0,
    items,
  };
}
