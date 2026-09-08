import type { MasterSpec } from './vehicle-specs-matrix-dry-run';

export type ReconciledSpecType = 'numeric' | 'binary' | 'scale';

export interface CatalogSpec extends MasterSpec {
  readonly groupName: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly detail: string;
  readonly valueDirection: string | null;
  readonly unitPerceivedValue: number;
  readonly relativeValue: number;
  readonly isBaseline: boolean;
  readonly isActive: boolean;
  readonly notes: string | null;
  readonly commercialCategory: string | null;
}

export interface ExcelMasterSpec {
  readonly code: string;
  readonly groupName: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly detail: string;
  readonly type: string;
  readonly unit: string | null;
  readonly valueDirection: string | null;
  readonly unitPerceivedValue: number;
  readonly relativeValue: number;
  readonly isBaseline: boolean;
  readonly notes: string | null;
}

export type SpecMappingClassification =
  | 'COPY_1_TO_1'
  | 'DELIBERATE_OVERRIDE'
  | 'DELIBERATE_ADDITION'
  | 'APP_ONLY'
  | 'EXCEL_ONLY_REVIEW'
  | 'EXCLUDED_REDUNDANT_UNIT'
  | 'STAGING_ONLY_CONFLICT';

export interface SpecMappingEntry {
  readonly code: string;
  readonly classification: SpecMappingClassification;
  readonly inApp: boolean;
  readonly inExcel: boolean;
  readonly inMatrix: boolean;
  readonly inStaging: boolean;
  readonly isBaseline: boolean;
  readonly isScaleMember: boolean;
  readonly conflicts: readonly string[];
}

export interface CatalogReconciliationReport {
  readonly candidateCatalog: readonly CatalogSpec[];
  readonly mappings: readonly SpecMappingEntry[];
  readonly sourceCodeMap: Readonly<Record<string, string>>;
  readonly totals: {
    readonly app: number;
    readonly excel: number;
    readonly staging: number;
    readonly matrix: number;
    readonly reconciled: number;
    readonly numeric: number;
    readonly binary: number;
    readonly scale: number;
    readonly baselines: number;
    readonly copyOneToOne: number;
    readonly deliberateOverrides: number;
    readonly deliberateAdditions: number;
    readonly appOnly: number;
    readonly excelOnlyReview: number;
    readonly excludedRedundantUnit: number;
    readonly unresolvedConflicts: number;
  };
  readonly specialRules: {
    readonly reevCode: 'PW_0045';
    readonly atProposedCode: 'PW_1045';
    readonly historicalMatrixAtCode: 'PW_0045';
    readonly canonicalTorqueUnit: 'Nm';
    readonly derivedTorqueUnit: 'kgfm';
    readonly excludedTorqueCodes: readonly ['PW_0013', 'PW_0024', 'PW_0027', 'PW_0034'];
  };
}

export const EXCLUDED_KGFM_TORQUE_CODES = Object.freeze([
  'PW_0013',
  'PW_0024',
  'PW_0027',
  'PW_0034',
] as const);

const uniqueByCode = <T extends { readonly code: string }>(
  rows: readonly T[],
  source: string,
): Map<string, T> => {
  const result = new Map<string, T>();
  for (const row of rows) {
    if (!row.code) throw new Error(`${source}: spec sem code.`);
    if (result.has(row.code)) throw new Error(`${source}: code duplicado ${row.code}.`);
    result.set(row.code, row);
  }
  return result;
};

function structuralConflicts(app: CatalogSpec, excel: ExcelMasterSpec): readonly string[] {
  const conflicts: string[] = [];
  if (app.groupName !== excel.groupName) conflicts.push('group_name');
  if (app.equipmentGroup !== excel.equipmentGroup) conflicts.push('equipment_group');
  if (app.specSet !== excel.specSet) conflicts.push('spec_set');
  if (app.detail !== excel.detail) conflicts.push('detail');
  if (app.unit !== excel.unit) conflicts.push('unit');
  // App remains authoritative for type; a mismatch is reported, never auto-applied.
  if (app.type !== excel.type) conflicts.push('type');
  return conflicts;
}

export function reconcileVehicleSpecCatalog(input: {
  readonly appSpecs: readonly CatalogSpec[];
  readonly excelSpecs: readonly ExcelMasterSpec[];
  readonly stagingSpecs: readonly MasterSpec[];
  readonly matrixSpecCodes: readonly string[];
  readonly appPw0045UsageCount: number;
}): CatalogReconciliationReport {
  const app = uniqueByCode(input.appSpecs, 'Compra Car App');
  const excel = uniqueByCode(input.excelSpecs, 'Excel/master');
  const staging = uniqueByCode(input.stagingSpecs, 'Compra Car Staging');
  const matrixCodes = new Set(input.matrixSpecCodes);
  if (app.size !== 320)
    throw new Error(`Compra Car App: esperados 320 specs, encontrados ${app.size}.`);
  if (input.appPw0045UsageCount !== 0) {
    throw new Error('PW_0045 possui associações em product_specs; override não é seguro.');
  }
  const currentAt = app.get('PW_0045');
  if (
    !currentAt ||
    currentAt.type !== 'scale' ||
    currentAt.specSet !== 'Transmission type' ||
    currentAt.detail !== 'AT'
  ) {
    throw new Error('PW_0045 atual não corresponde ao AT esperado em Transmission type.');
  }
  if (app.has('PW_1045') || excel.has('PW_1045') || matrixCodes.has('PW_1045')) {
    throw new Error('PW_1045 já está ocupado em uma fonte autoral/histórica.');
  }
  const stagingAt = staging.get('PW_1045') as CatalogSpec | undefined;
  if (
    stagingAt &&
    (stagingAt.type !== 'scale' ||
      stagingAt.specSet !== 'Transmission type' ||
      stagingAt.detail !== 'AT')
  ) {
    throw new Error('PW_1045 no Staging não corresponde ao AT reconciliado.');
  }

  const candidate = new Map(app);
  candidate.set('PW_0045', {
    ...currentAt,
    equipmentGroup: 'Engine type',
    specSet: 'Engine tech',
    detail: 'REEV',
    type: 'scale',
    unit: null,
    isBaseline: false,
    notes: 'Override candidato: PW_0045 realocado de AT para REEV; não persistido.',
  });
  candidate.set('PW_1045', {
    ...currentAt,
    id: 'candidate:PW_1045',
    code: 'PW_1045',
    notes: 'Código candidato para AT deslocado de PW_0045; não persistido.',
  });

  const allCodes = new Set([
    ...app.keys(),
    ...excel.keys(),
    ...staging.keys(),
    ...matrixCodes,
    ...EXCLUDED_KGFM_TORQUE_CODES,
    'PW_1045',
  ]);
  const mappings = [...allCodes]
    .sort((left, right) => left.localeCompare(right))
    .map((code): SpecMappingEntry => {
      const appSpec = app.get(code);
      const excelSpec = excel.get(code);
      let classification: SpecMappingClassification;
      if (
        EXCLUDED_KGFM_TORQUE_CODES.includes(code as (typeof EXCLUDED_KGFM_TORQUE_CODES)[number])
      ) {
        classification = 'EXCLUDED_REDUNDANT_UNIT';
      } else if (code === 'PW_0045') classification = 'DELIBERATE_OVERRIDE';
      else if (code === 'PW_1045') classification = 'DELIBERATE_ADDITION';
      else if (!appSpec && staging.has(code)) classification = 'STAGING_ONLY_CONFLICT';
      else if (!appSpec && excelSpec) classification = 'EXCEL_ONLY_REVIEW';
      else if (appSpec && !excelSpec) classification = 'APP_ONLY';
      else classification = 'COPY_1_TO_1';
      const conflicts =
        appSpec && excelSpec && code !== 'PW_0045' ? structuralConflicts(appSpec, excelSpec) : [];
      const reconciled = candidate.get(code);
      return {
        code,
        classification,
        inApp: appSpec !== undefined,
        inExcel: excelSpec !== undefined,
        inMatrix: matrixCodes.has(code),
        inStaging: staging.has(code),
        isBaseline: reconciled?.isBaseline === true,
        isScaleMember: reconciled?.type === 'scale',
        conflicts,
      };
    });
  const candidateCatalog = [...candidate.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  );
  const count = (classification: SpecMappingClassification): number =>
    mappings.filter((mapping) => mapping.classification === classification).length;
  return {
    candidateCatalog,
    mappings,
    sourceCodeMap: Object.freeze({ PW_0045: 'PW_1045' }),
    totals: {
      app: app.size,
      excel: excel.size,
      staging: staging.size,
      matrix: matrixCodes.size,
      reconciled: candidateCatalog.length,
      numeric: candidateCatalog.filter((spec) => spec.type === 'numeric').length,
      binary: candidateCatalog.filter((spec) => spec.type === 'binary').length,
      scale: candidateCatalog.filter((spec) => spec.type === 'scale').length,
      baselines: candidateCatalog.filter((spec) => spec.isBaseline).length,
      copyOneToOne: count('COPY_1_TO_1'),
      deliberateOverrides: count('DELIBERATE_OVERRIDE'),
      deliberateAdditions: count('DELIBERATE_ADDITION'),
      appOnly: count('APP_ONLY'),
      excelOnlyReview: count('EXCEL_ONLY_REVIEW'),
      excludedRedundantUnit: count('EXCLUDED_REDUNDANT_UNIT'),
      unresolvedConflicts: mappings.filter(
        (mapping) =>
          mapping.conflicts.length > 0 ||
          mapping.classification === 'EXCEL_ONLY_REVIEW' ||
          mapping.classification === 'STAGING_ONLY_CONFLICT',
      ).length,
    },
    specialRules: {
      reevCode: 'PW_0045',
      atProposedCode: 'PW_1045',
      historicalMatrixAtCode: 'PW_0045',
      canonicalTorqueUnit: 'Nm',
      derivedTorqueUnit: 'kgfm',
      excludedTorqueCodes: EXCLUDED_KGFM_TORQUE_CODES,
    },
  };
}
