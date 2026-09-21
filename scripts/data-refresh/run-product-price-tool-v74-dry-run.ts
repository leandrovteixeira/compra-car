import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  buildVehicleSpecsDryRunReport,
  parseProductPriceToolV74,
  type ExistingProductIdentity,
  type MasterSpec,
} from '../../packages/core/src/index';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const repositoryRoot = resolve(__dirname, '../..');
  const sourcePath = resolve(process.cwd(), argument('file') ?? 'Product Price Tool V.74.xlsm');
  const bytes = await readFile(sourcePath);

  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serverKey =
    process.env.SUPABASE_SERVER_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !serverKey) {
    throw new Error(
      'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e uma server/publishable key são obrigatórias para o dry-run read-only.',
    );
  }

  const headers = { apikey: serverKey, Authorization: `Bearer ${serverKey}` };
  async function readTable<T>(table: string, select: string): Promise<readonly T[]> {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/u, '')}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1000`,
      { method: 'GET', headers },
    );
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`);
    return response.json() as Promise<readonly T[]>;
  }

  const [specRows, productRows] = await Promise.all([
    readTable<{
      id: number | string;
      code: string;
      type: MasterSpec['type'];
      unit: string | null;
      spec_set: string | null;
      is_baseline: boolean | null;
      group_name: string | null;
      equipment_group: string | null;
    }>('specs', 'id,code,type,unit,spec_set,is_baseline,group_name,equipment_group'),
    readTable<{
      id: number | string;
      brand: string;
      model: string;
      version: string;
      production_year: number;
      model_year: number;
    }>('products', 'id,brand,model,version,production_year,model_year'),
  ]);

  const specs: readonly MasterSpec[] = specRows.map((row) => ({
    id: String(row.id),
    code: row.code,
    type: row.type,
    unit: row.unit,
    specSet: row.spec_set ?? undefined,
    isBaseline: row.is_baseline === true,
    groupName: row.group_name ?? undefined,
    equipmentGroup: row.equipment_group ?? undefined,
  }));
  const products: readonly ExistingProductIdentity[] = productRows.map((row) => ({
    id: String(row.id),
    brand: row.brand,
    model: row.model,
    version: row.version,
    productionYear: Number(row.production_year),
    modelYear: Number(row.model_year),
  }));

  const matrix = parseProductPriceToolV74(bytes);
  const dryRun = buildVehicleSpecsDryRunReport({
    source: `${basename(sourcePath)} / Spec DB / profile product-price-tool-v74`,
    rows: matrix.normalizedRows,
    specs,
    products,
  });

  const knownCodes = new Set(specs.map((spec) => spec.code));
  const mappingAudit = matrix.mappings.map((mapping) => {
    const targets = (mapping.targetCode ?? '')
      .split('/')
      .map((item) => item.trim())
      .filter(Boolean);
    const missingTargets = targets.filter((code) => !knownCodes.has(code));
    return {
      ...mapping,
      status:
        mapping.action === 'EXCLUDE_REDUNDANT_ALIAS'
          ? 'AUTO_EXCLUDE'
          : missingTargets.length
            ? 'TARGET_NOT_IN_DB'
            : mapping.action === 'DIRECT'
              ? 'OK_DIRECT'
              : 'OK_NORMALIZED',
      missingTargets,
    };
  });

  const issues = dryRun.vehicles.flatMap((vehicle) =>
    vehicle.issues.map((issue) => ({
      vehicle: vehicle.fullName,
      sourceColumn: issue.sourceColumn,
      category: issue.category ?? issue.kind.toLocaleUpperCase('pt-BR'),
      code: issue.code ?? null,
      rawValue: issue.value ?? null,
      message: issue.message,
    })),
  );
  const groupedIssues = [...new Map(
    issues.map((issue) => {
      const key = JSON.stringify([issue.category, issue.code, String(issue.rawValue ?? '')]);
      return [key, { ...issue, occurrences: 0, vehicles: [] as string[] }];
    }),
  ).values()];
  for (const group of groupedIssues) {
    const matches = issues.filter(
      (issue) =>
        issue.category === group.category &&
        issue.code === group.code &&
        String(issue.rawValue ?? '') === String(group.rawValue ?? ''),
    );
    group.occurrences = matches.length;
    group.vehicles = matches.slice(0, 20).map((item) => item.vehicle);
  }

  const aliasBlockingWarnings = matrix.warnings.filter(
    (warning) => warning.category === 'ALIAS_WITHOUT_CANONICAL',
  );
  const targetMappingBlockers = mappingAudit.filter((mapping) => mapping.status === 'TARGET_NOT_IN_DB');
  const importReady =
    dryRun.totals.reviewRequired === 0 &&
    aliasBlockingWarnings.length === 0 &&
    targetMappingBlockers.length === 0;

  const artifact = {
    generatedAt: new Date().toISOString(),
    source: {
      file: basename(sourcePath),
      sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase(),
      sheet: 'Spec DB',
      profile: 'product-price-tool-v74',
    },
    database: {
      specs: specs.length,
      products: products.length,
    },
    matrix: {
      vehicles: matrix.sourceColumns.length,
      sourceRows: matrix.sourceRows.length,
      normalizedRows: matrix.normalizedRows.length,
    },
    gate: {
      importReady,
      reviewIssueCount: dryRun.totals.reviewRequired,
      targetMappingBlockers: targetMappingBlockers.length,
      aliasBlockingWarnings: aliasBlockingWarnings.length,
    },
    mappingAudit,
    sourceWarnings: matrix.warnings,
    dryRunTotals: dryRun.totals,
    issueSummary: groupedIssues.sort(
      (left, right) =>
        left.category.localeCompare(right.category) ||
        (left.code ?? '').localeCompare(right.code ?? ''),
    ),
    vehicles: dryRun.vehicles,
  };

  await mkdir(resolve(repositoryRoot, 'temp'), { recursive: true });
  const artifactPath = resolve(repositoryRoot, 'temp/product-price-tool-v74-spec-audit.json');
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        artifactPath,
        source: artifact.source,
        matrix: artifact.matrix,
        gate: artifact.gate,
        issueSummary: artifact.issueSummary,
        sourceWarnings: artifact.sourceWarnings,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
