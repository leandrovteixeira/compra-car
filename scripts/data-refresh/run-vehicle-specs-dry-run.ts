import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  buildVehicleSpecsCsvDryRunReport,
  buildVehicleSpecsRecordDryRunReport,
  type ExistingProductIdentity,
  type MasterSpec,
  type MatrixRow,
} from '../../packages/core/src/index';

async function main(): Promise<void> {
  const repositoryRoot = resolve(__dirname, '../..');
  const sourceArgument = process.argv.find((argument) => argument.startsWith('--source='));
  const sourceMode = sourceArgument?.slice('--source='.length) ?? 'legacy-csv';
  if (sourceMode !== 'legacy-csv' && sourceMode !== 'staging') {
    throw new Error('Use --source=legacy-csv ou --source=staging.');
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serverKey = process.env.SUPABASE_SERVER_KEY?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const readKey = sourceMode === 'legacy-csv' ? (publishableKey ?? serverKey) : serverKey;
  if (!supabaseUrl || !readKey) {
    throw new Error(
      sourceMode === 'staging'
        ? 'SUPABASE_URL e SUPABASE_SERVER_KEY são obrigatórias para ler a staging com RLS.'
        : 'SUPABASE_URL e uma publishable/server key são obrigatórias para ler o catálogo.',
    );
  }

  const headers = { apikey: readKey, Authorization: `Bearer ${readKey}` };
  async function readTable<T>(table: string, select: string): Promise<readonly T[]> {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1000`,
      { headers },
    );
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`);
    return response.json() as Promise<readonly T[]>;
  }

  const [specRows, productRows] = await Promise.all([
    readTable<{ id: string | number; code: string; type: MasterSpec['type']; unit: string | null }>(
      'specs',
      'id,code,type,unit',
    ),
    readTable<{
      id: string | number;
      brand: string;
      model: string;
      version: string;
      production_year: number;
      model_year: number;
    }>('products', 'id,brand,model,version,production_year,model_year'),
  ]);
  const specs: readonly MasterSpec[] = specRows.map((spec) => ({ ...spec, id: String(spec.id) }));
  const products: readonly ExistingProductIdentity[] = productRows.map((product) => ({
    id: String(product.id),
    brand: product.brand,
    model: product.model,
    version: product.version,
    productionYear: Number(product.production_year),
    modelYear: Number(product.model_year),
  }));

  let report;
  if (sourceMode === 'legacy-csv') {
    const sourcePath = resolve(repositoryRoot, 'Legacy/staging.csv');
    const bytes = await readFile(sourcePath);
    report = buildVehicleSpecsCsvDryRunReport({
      source: 'Legacy/staging.csv',
      sourceSha256: createHash('sha256').update(bytes).digest('hex').toUpperCase(),
      csv: bytes.toString('utf8'),
      specs,
      products,
    });
  } else {
    const [rows, openApiResponse] = await Promise.all([
      readTable<MatrixRow>('product_specs_matrix_staging', '*'),
      fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { ...headers, Accept: 'application/openapi+json' },
      }),
    ]);
    if (!openApiResponse.ok) {
      throw new Error(`OpenAPI: HTTP ${openApiResponse.status} ${await openApiResponse.text()}`);
    }
    const openApi = (await openApiResponse.json()) as {
      definitions?: { product_specs_matrix_staging?: { properties?: Record<string, unknown> } };
    };
    const stagingHeaders = Object.keys(
      openApi.definitions?.product_specs_matrix_staging?.properties ?? {},
    );
    report = buildVehicleSpecsRecordDryRunReport({
      source: 'public.product_specs_matrix_staging',
      sourceSha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex').toUpperCase(),
      headers: stagingHeaders,
      rows,
      specs,
      products,
    });
  }

  await mkdir(resolve(repositoryRoot, 'temp'), { recursive: true });
  const artifactPath = resolve(repositoryRoot, 'temp/vehicle-specs-dry-run-preview.json');
  await writeFile(artifactPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ artifactPath, sourceMode, totals: report.totals, checks: report.checks }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
