import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  buildVehicleSpecsCsvDryRunReport,
  reconcileVehicleSpecCatalog,
  type CatalogSpec,
  type ExcelMasterSpec,
  type ExistingProductIdentity,
  vehicleTextComparisonKey,
} from '../../packages/core/src/index';

const APP_REF = 'ltbeykzccckdwpzyeywu';
const STAGING_REF = 'shfsjyjxmgwnlexmdkcs';

function parseEnv(source: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    source
      .split(/\r?\n/gu)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) throw new Error('Declaração inválida em arquivo de ambiente.');
        const value = line.slice(separator + 1).trim();
        return [
          line.slice(0, separator).trim(),
          /^(['"]).*\1$/u.test(value) ? value.slice(1, -1) : value,
        ];
      }),
  );
}

function readTarget(env: Readonly<Record<string, string>>, expectedRef: string) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('URL/publishable key read-only indisponíveis.');
  if (new URL(url).hostname !== `${expectedRef}.supabase.co`) {
    throw new Error(`Projeto inesperado; esperado ${expectedRef}.`);
  }
  return { url: url.replace(/\/$/u, ''), key };
}

async function get<T>(target: { url: string; key: string }, path: string): Promise<readonly T[]> {
  if (!path.startsWith('/rest/v1/')) throw new Error('Somente GET REST é permitido.');
  const response = await fetch(`${target.url}${path}`, {
    method: 'GET',
    headers: { apikey: target.key, Authorization: `Bearer ${target.key}` },
  });
  if (!response.ok)
    throw new Error(`GET ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json() as Promise<readonly T[]>;
}

const numeric = (value: unknown): number => Number(value ?? 0);
const boolean = (value: unknown): boolean => value === true || value === 'true';
const nullable = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
};

function parseExcelMaster(source: string): readonly ExcelMasterSpec[] {
  const [headerLine, ...lines] = source.split(/\r?\n/gu).filter((line) => line !== '');
  if (!headerLine) throw new Error('Excel/master CSV vazio.');
  const headers = headerLine.split(';');
  const rows = lines.map((line) => {
    const values = line.split(';');
    if (values.length !== headers.length) throw new Error('Excel/master CSV com largura inválida.');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  return rows.map((row) => ({
    code: row.code,
    groupName: row.group_name,
    equipmentGroup: row.equipment_group,
    specSet: row.spec_set,
    detail: row.detail,
    type: row.type,
    unit: nullable(row.unit),
    valueDirection: nullable(row.value_direction),
    unitPerceivedValue: numeric(row.unit_perceived_value),
    relativeValue: numeric(row.relative_value),
    isBaseline: boolean(row.is_baseline),
    notes: nullable(row.notes),
  }));
}

function currentExcelAudit(
  localExcel: readonly ExcelMasterSpec[],
  appSpecs: readonly CatalogSpec[],
): readonly ExcelMasterSpec[] {
  const app = new Map(appSpecs.map((spec) => [spec.code, spec]));
  const excel = new Map(localExcel.map((spec) => [spec.code, spec]));
  const currentAt = excel.get('PW_0045');
  if (!currentAt) throw new Error('Excel local sem PW_0045.');
  excel.set('PW_0045', {
    ...currentAt,
    groupName: 'Powertrain',
    equipmentGroup: 'Engine type',
    specSet: 'Engine tech',
    detail: 'REEV',
    type: 'scale',
    unit: null,
    isBaseline: false,
    notes: 'Override autoral confirmado na auditoria do Excel atual.',
  });
  for (const [kgfmCode, nmCode] of [
    ['PW_0013', 'PW_0012'],
    ['PW_0024', 'PW_0023'],
    ['PW_0027', 'PW_0026'],
    ['PW_0034', 'PW_0033'],
  ] as const) {
    const canonical = app.get(nmCode);
    if (!canonical) throw new Error(`Spec canônico ausente: ${nmCode}.`);
    excel.set(kgfmCode, {
      code: kgfmCode,
      groupName: canonical.groupName,
      equipmentGroup: canonical.equipmentGroup,
      specSet: canonical.specSet,
      detail: `${canonical.detail} (kgfm)`,
      type: 'numeric',
      unit: 'kgfm',
      valueDirection: canonical.valueDirection,
      unitPerceivedValue: canonical.unitPerceivedValue,
      relativeValue: canonical.relativeValue,
      isBaseline: false,
      notes: `Representação redundante do canônico ${nmCode}; não criar.`,
    });
  }
  return [...excel.values()];
}

async function main(): Promise<void> {
  const root = resolve(__dirname, '../..');
  const [productionEnvText, stagingEnvText, matrixBytes, excelText] = await Promise.all([
    readFile(resolve(root, 'apps/web/env/production.env'), 'utf8'),
    readFile(resolve(root, 'apps/web/env/staging.env'), 'utf8'),
    readFile(resolve(root, 'Legacy/staging.csv')),
    readFile(resolve(root, 'Legacy/equipments.csv'), 'utf8'),
  ]);
  const appTarget = readTarget(parseEnv(productionEnvText), APP_REF);
  const stagingTarget = readTarget(parseEnv(stagingEnvText), STAGING_REF);
  const specSelect =
    'id,code,type,group_name,equipment_group,spec_set,detail,unit,value_direction,unit_perceived_value,relative_value,is_baseline,is_active,notes,commercial_category';
  const [appRows, appProducts, stagingRows, stagingProducts] = await Promise.all([
    get<Record<string, unknown>>(appTarget, `/rest/v1/specs?select=${specSelect}&limit=1000`),
    get<Record<string, unknown>>(
      appTarget,
      '/rest/v1/products?select=id,brand,model,version,production_year,model_year&limit=1000',
    ),
    get<Record<string, unknown>>(stagingTarget, `/rest/v1/specs?select=${specSelect}&limit=1000`),
    get<Record<string, unknown>>(
      stagingTarget,
      '/rest/v1/products?select=id,brand,model,version,production_year,model_year&limit=1000',
    ),
  ]);
  const toCatalogSpec = (row: Record<string, unknown>): CatalogSpec => ({
    id: String(row.id),
    code: String(row.code),
    type: String(row.type) as CatalogSpec['type'],
    groupName: String(row.group_name),
    equipmentGroup: String(row.equipment_group),
    specSet: String(row.spec_set),
    detail: String(row.detail),
    unit: nullable(row.unit),
    valueDirection: nullable(row.value_direction),
    unitPerceivedValue: numeric(row.unit_perceived_value),
    relativeValue: numeric(row.relative_value),
    isBaseline: boolean(row.is_baseline),
    isActive: boolean(row.is_active),
    notes: nullable(row.notes),
    commercialCategory: nullable(row.commercial_category),
  });
  const appSpecs = appRows.map(toCatalogSpec);
  const stagingSpecs = stagingRows.map(toCatalogSpec);
  const appPw0045 = appSpecs.find((spec) => spec.code === 'PW_0045');
  if (!appPw0045) throw new Error('Compra Car App sem PW_0045.');
  const pw0045Usage = await get<{ id: number }>(
    appTarget,
    `/rest/v1/product_specs?select=id&equipment_id=eq.${appPw0045.id}&limit=1000`,
  );
  const excelSpecs = currentExcelAudit(parseExcelMaster(excelText), appSpecs);
  const matrixHeader = matrixBytes.toString('utf8').split(/\r?\n/u, 1)[0]?.split(';') ?? [];
  const matrixSpecCodes = matrixHeader.filter((code) => !code.startsWith('SC_'));
  const reconciliation = reconcileVehicleSpecCatalog({
    appSpecs,
    excelSpecs,
    stagingSpecs,
    matrixSpecCodes,
    appPw0045UsageCount: pw0045Usage.length,
  });
  const products: readonly ExistingProductIdentity[] = stagingProducts.map((row) => ({
    id: String(row.id),
    brand: String(row.brand),
    model: String(row.model),
    version: String(row.version),
    productionYear: Number(row.production_year),
    modelYear: Number(row.model_year),
  }));
  const dryRun = buildVehicleSpecsCsvDryRunReport({
    source: 'Legacy/staging.csv + reconciled Compra Car App specs',
    sourceSha256: createHash('sha256').update(matrixBytes).digest('hex').toUpperCase(),
    csv: matrixBytes.toString('utf8'),
    specs: reconciliation.candidateCatalog,
    products,
    sourceCodeMap: reconciliation.sourceCodeMap,
    normalizationProfile: 'legacy-staging-csv',
  });
  const identityKey = (row: {
    readonly brand: string;
    readonly model: string;
    readonly version: string;
    readonly productionYear: number;
    readonly modelYear: number;
  }): string =>
    [
      vehicleTextComparisonKey(row.brand),
      vehicleTextComparisonKey(row.model),
      vehicleTextComparisonKey(row.version),
      row.productionYear,
      row.modelYear,
    ].join('\u001f');
  const appProductGroups = new Map<string, Record<string, unknown>[]>();
  for (const product of appProducts) {
    const key = identityKey({
      brand: String(product.brand),
      model: String(product.model),
      version: String(product.version),
      productionYear: Number(product.production_year),
      modelYear: Number(product.model_year),
    });
    appProductGroups.set(key, [...(appProductGroups.get(key) ?? []), product]);
  }
  const auditedCodes = new Set([
    'EX_1012',
    'EX_1006',
    'EX_0030',
    'EX_0031',
    'SF_1017',
    'SF_0034',
    'SF_0035',
    'SF_0036',
    'CO_0033',
    'SF_0041',
    'CO_0023',
  ]);
  const auditedSpecIds = appSpecs
    .filter((spec) => auditedCodes.has(spec.code))
    .map((spec) => spec.id);
  const affected = dryRun.vehicles.filter((vehicle) =>
    vehicle.issues.some(
      (issue) =>
        issue.category === 'SCALE_CONFLICT' ||
        issue.category === 'UNEXPECTED_BINARY_VALUE' ||
        issue.category === 'MALFORMED_SOURCE_VALUE',
    ),
  );
  const matchedProductIds = [
    ...new Set(
      affected.flatMap((vehicle) => {
        if (vehicle.productionYear === null || vehicle.modelYear === null) return [];
        const matches =
          appProductGroups.get(
            identityKey({
              brand: vehicle.brand,
              model: vehicle.model,
              version: vehicle.version,
              productionYear: vehicle.productionYear,
              modelYear: vehicle.modelYear,
            }),
          ) ?? [];
        return matches.length === 1 ? [String(matches[0]!.id)] : [];
      }),
    ),
  ];
  const appAssociations =
    matchedProductIds.length > 0 && auditedSpecIds.length > 0
      ? await get<Record<string, unknown>>(
          appTarget,
          `/rest/v1/product_specs?select=product_id,equipment_id,value,is_present,input_unit&product_id=in.(${matchedProductIds.join(',')})&equipment_id=in.(${auditedSpecIds.join(',')})&limit=1000`,
        )
      : [];
  const specById = new Map(appSpecs.map((spec) => [spec.id, spec]));
  const auditRows = affected.flatMap((vehicle) => {
    if (vehicle.productionYear === null || vehicle.modelYear === null) return [];
    const matches =
      appProductGroups.get(
        identityKey({
          brand: vehicle.brand,
          model: vehicle.model,
          version: vehicle.version,
          productionYear: vehicle.productionYear,
          modelYear: vehicle.modelYear,
        }),
      ) ?? [];
    return vehicle.issues
      .filter(
        (issue) =>
          issue.category === 'SCALE_CONFLICT' ||
          issue.category === 'UNEXPECTED_BINARY_VALUE' ||
          issue.category === 'MALFORMED_SOURCE_VALUE',
      )
      .map((issue) => {
        const productId = matches.length === 1 ? String(matches[0]!.id) : null;
        const issueCodes = String(issue.code ?? '').split(',');
        const structuralKeys = new Set(
          issueCodes.flatMap((code) => {
            const sourceSpec = appSpecs.find((spec) => spec.code === code);
            return sourceSpec
              ? [
                  [sourceSpec.groupName, sourceSpec.equipmentGroup, sourceSpec.specSet].join(
                    '\u001f',
                  ),
                ]
              : [];
          }),
        );
        const relevantCodes = new Set(
          issue.category === 'SCALE_CONFLICT'
            ? appSpecs
                .filter((spec) =>
                  structuralKeys.has(
                    [spec.groupName, spec.equipmentGroup, spec.specSet].join('\u001f'),
                  ),
                )
                .map((spec) => spec.code)
            : issueCodes,
        );
        const currentValues = productId
          ? appAssociations
              .filter(
                (association) =>
                  String(association.product_id) === productId &&
                  relevantCodes.has(specById.get(String(association.equipment_id))?.code ?? ''),
              )
              .map((association) => ({
                code: specById.get(String(association.equipment_id))?.code ?? null,
                detail: specById.get(String(association.equipment_id))?.detail ?? null,
                value: association.value,
                isPresent: association.is_present,
                inputUnit: association.input_unit,
              }))
          : [];
        return {
          vehicle: vehicle.fullName,
          identity: {
            brand: vehicle.brand,
            model: vehicle.model,
            version: vehicle.version,
            productionYear: vehicle.productionYear,
            modelYear: vehicle.modelYear,
          },
          category: issue.category,
          code: issue.code ?? null,
          rawValue: issue.value ?? null,
          specMeaning: issueCodes.map((code) => ({
            code,
            detail: appSpecs.find((spec) => spec.code === code)?.detail ?? null,
          })),
          appMatchStatus:
            matches.length === 0
              ? 'NO_EXACT_MATCH'
              : matches.length === 1
                ? 'EXISTING_EXACT'
                : 'AMBIGUOUS',
          appProductId: productId,
          currentProductSpecs: currentValues,
          currentResult:
            matches.length !== 1
              ? matches.length === 0
                ? 'NO_EXACT_MATCH'
                : 'AMBIGUOUS'
              : currentValues.length === 0
                ? 'NO_ASSOCIATION'
                : currentValues
                    .map((value) => `${value.code}:${String(value.isPresent ?? value.value)}`)
                    .sort()
                    .join('|'),
        };
      });
  });
  const auditFrequency = Object.entries(
    auditRows.reduce<Record<string, number>>((counts, row) => {
      counts[row.currentResult] = (counts[row.currentResult] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .map(([result, occurrences]) => ({ result, occurrences }))
    .sort((left, right) => left.result.localeCompare(right.result));
  const issueCounts = dryRun.parseIssuesByCategory;
  const nonPromotableValues = Object.values(issueCounts).reduce((sum, count) => sum + count, 0);
  const numericUnitConflicts = dryRun.vehicles
    .flatMap((vehicle) => vehicle.issues)
    .filter((issue) => issue.category === 'NUMERIC_INVALID');
  const artifact = {
    generatedAt: new Date().toISOString(),
    sources: {
      app: 'Compra Car App public.specs (read-only)',
      staging: 'Compra Car Staging public.specs/products (read-only)',
      matrix: 'Legacy/staging.csv',
      excel: 'Legacy/equipments.csv plus approved current-master audit overrides',
    },
    appPw0045UsageCount: pw0045Usage.length,
    reconciliation,
    dryRun,
    appProductSpecsAudit: {
      rows: auditRows,
      frequency: auditFrequency,
    },
    promotionAnalysis: {
      unknownSpecCodes: dryRun.totals.uniqueUnknownSpecCodes,
      scaleConflicts: issueCounts.SCALE_CONFLICT ?? 0,
      binaryConflicts: issueCounts.UNEXPECTED_BINARY_VALUE ?? 0,
      unitOrEmbeddedUnitConflicts: numericUnitConflicts.length,
      tbdValues: issueCounts.TBD ?? 0,
      nonPromotableValues,
      unitConflictExamples: numericUnitConflicts.slice(0, 10),
    },
  };
  await mkdir(resolve(root, 'temp'), { recursive: true });
  const artifactPath = resolve(root, 'temp/vehicle-specs-reconciled-dry-run.json');
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        artifactPath,
        appPw0045UsageCount: pw0045Usage.length,
        catalog: reconciliation.totals,
        dryRun: dryRun.totals,
        checks: dryRun.checks,
        promotionAnalysis: artifact.promotionAnalysis,
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
