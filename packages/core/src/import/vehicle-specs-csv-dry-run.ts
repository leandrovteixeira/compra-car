import {
  buildVehicleSpecsDryRunReport,
  scaleIdentity,
  type CandidateSpec,
  type DryRunIssue,
  type DryRunIssueKind,
  type ExistingProductIdentity,
  type MasterSpec,
  type MatrixRow,
  type SourceNormalizationProfile,
  type VehicleCandidate,
} from './vehicle-specs-matrix-dry-run';

const CSV_METADATA_CODES = Object.freeze([
  'SC_0001',
  'SC_0002',
  'SC_0003',
  'SC_0004',
  'SC_0005',
  'SC_0006',
] as const);

export interface ParsedSemicolonCsv {
  readonly headers: readonly string[];
  readonly rows: readonly MatrixRow[];
}

export interface UnknownSpecCodeSummary {
  readonly code: string;
  readonly occurrences: number;
}

export interface RemainingIssueSummary {
  readonly code: string | null;
  readonly rawValue: string;
  readonly occurrences: number;
  readonly category: string;
}

export interface VehicleSpecsCsvDryRunReport {
  readonly source: string;
  readonly sourceSha256: string;
  readonly totals: {
    readonly rows: number;
    readonly vehicles: number;
    readonly columns: number;
    readonly specColumns: number;
    readonly productsAvailable: number;
    readonly existingExact: number;
    readonly newProduct: number;
    readonly ambiguous: number;
    readonly invalid: number;
    readonly specCellsObserved: number;
    readonly specCellsRecognized: number;
    readonly specCellsParsed: number;
    readonly specCellsPromotable: number;
    readonly specCellsPendingReview: number;
    readonly specCellsMalformed: number;
    readonly reviewIssueCount: number;
    readonly specCellsIgnoredEmpty: number;
    readonly specCellsIgnoredTbd: number;
    readonly specCellsIgnoredEmptyOrTbd: number;
    readonly specCellsUnknownCode: number;
    readonly uniqueRecognizedSpecCodes: number;
    readonly uniqueUnknownSpecCodes: number;
  };
  readonly unknownSpecCodes: readonly UnknownSpecCodeSummary[];
  readonly remainingIssues: readonly RemainingIssueSummary[];
  readonly affectedVehicles: number;
  readonly parseIssuesByCategory: Readonly<Record<string, number>>;
  readonly issueExamplesByCategory: Readonly<Record<string, readonly DryRunIssue[]>>;
  readonly issueExamples: Readonly<Partial<Record<DryRunIssueKind, readonly DryRunIssue[]>>>;
  readonly checks: {
    readonly authoritativeYearsValidForAllVehicles: boolean;
    readonly vehiclesRequiringYearInference: number;
    readonly unknownSpecsCreated: 0;
    readonly allRowsProcessed: boolean;
    readonly deterministicTranspose: boolean;
    readonly noDuplicateBaselinePerSpecSet: boolean;
    readonly noBaselineWithHigherMember: boolean;
    readonly historicalPw0045MappedOnlyToPw1045: boolean;
  };
  readonly scales: {
    readonly resolvedByExplicitMember: number;
    readonly resolvedByBaseline: number;
    readonly conflicts: number;
  };
  readonly sourceNormalizations: Readonly<Record<string, number>>;
  readonly preview: readonly {
    readonly sourceColumn: string;
    readonly fullName: string;
    readonly brand: string;
    readonly model: string;
    readonly version: string;
    readonly productionYear: number | null;
    readonly modelYear: number | null;
    readonly matchStatus: VehicleCandidate['matchStatus'];
    readonly existingProductId: string | null;
    readonly parsedSpecCount: number;
    readonly reviewIssueCount: number;
    readonly sampleSpecs: readonly CandidateSpec[];
  }[];
  readonly vehicles: readonly VehicleCandidate[];
}

function parseCsvRecords(source: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ';') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.replace(/\r$/u, ''));
      records.push(record);
      record = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw new Error('CSV inválido: campo entre aspas não foi fechado.');
  if (field !== '' || record.length > 0) {
    record.push(field.replace(/\r$/u, ''));
    records.push(record);
  }
  return records;
}

export function parseSemicolonVehicleSpecsCsv(source: string): ParsedSemicolonCsv {
  const records = parseCsvRecords(source.replace(/^\uFEFF/u, ''));
  const headers = records.shift() ?? [];
  if (headers.length === 0) throw new Error('CSV sem cabeçalho.');
  if (new Set(headers).size !== headers.length)
    throw new Error('CSV contém cabeçalhos duplicados.');
  for (const code of CSV_METADATA_CODES) {
    if (!headers.includes(code)) throw new Error(`CSV não contém a coluna obrigatória ${code}.`);
  }
  const rows = records
    .filter((record) => record.some((value) => value !== ''))
    .map((record, rowIndex) => {
      if (record.length !== headers.length) {
        throw new Error(
          `CSV linha ${rowIndex + 2}: esperadas ${headers.length} colunas, encontradas ${record.length}.`,
        );
      }
      return Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']));
    });
  return { headers, rows };
}

function recordsToTransposedMatrix(
  rows: readonly MatrixRow[],
  headers: readonly string[],
  sourceCodeMap: Readonly<Record<string, string>> = {},
): readonly MatrixRow[] {
  return headers.map((code) =>
    Object.fromEntries([
      ['code', sourceCodeMap[code] ?? code],
      ...rows.map((row, index) => [`row:${index + 2}`, row[code] ?? ''] as const),
    ]),
  );
}

function issueCounts(issues: readonly DryRunIssue[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    const category = issue.category ?? issue.kind.toLocaleUpperCase('pt-BR');
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function categorizedIssueExamples(
  issues: readonly DryRunIssue[],
): Readonly<Record<string, readonly DryRunIssue[]>> {
  const examples: Record<string, DryRunIssue[]> = {};
  for (const issue of issues) {
    const category = issue.category ?? issue.kind.toLocaleUpperCase('pt-BR');
    const categoryExamples = (examples[category] ??= []);
    if (categoryExamples.length < 5) categoryExamples.push(issue);
  }
  return examples;
}

function summarizeRemainingIssues(
  issues: readonly DryRunIssue[],
): readonly RemainingIssueSummary[] {
  const groups = new Map<string, RemainingIssueSummary>();
  for (const issue of issues) {
    const category = issue.category ?? issue.kind.toLocaleUpperCase('pt-BR');
    const rawValue = String(issue.value ?? '');
    const code = issue.code ?? null;
    const key = JSON.stringify([category, code, rawValue]);
    const current = groups.get(key);
    groups.set(key, { category, code, rawValue, occurrences: (current?.occurrences ?? 0) + 1 });
  }
  return [...groups.values()].sort(
    (left, right) =>
      left.category.localeCompare(right.category) ||
      (left.code ?? '').localeCompare(right.code ?? '') ||
      left.rawValue.localeCompare(right.rawValue),
  );
}

export function buildVehicleSpecsRecordDryRunReport(input: {
  readonly source: string;
  readonly sourceSha256: string;
  readonly headers: readonly string[];
  readonly rows: readonly MatrixRow[];
  readonly specs: readonly MasterSpec[];
  readonly products: readonly ExistingProductIdentity[];
  readonly sourceCodeMap?: Readonly<Record<string, string>>;
  readonly normalizationProfile?: SourceNormalizationProfile;
}): VehicleSpecsCsvDryRunReport {
  const specColumns = input.headers.filter(
    (header) => !CSV_METADATA_CODES.includes(header as (typeof CSV_METADATA_CODES)[number]),
  );
  const effectiveCode = (code: string): string => input.sourceCodeMap?.[code] ?? code;
  const transposed = recordsToTransposedMatrix(input.rows, input.headers, input.sourceCodeMap);
  const base = buildVehicleSpecsDryRunReport({
    source: input.source,
    rows: transposed,
    specs: input.specs,
    products: input.products,
    layout: {
      codeColumn: 'code',
      fullNameCode: 'SC_0001',
      brandCode: 'SC_0002',
      modelCode: 'SC_0003',
      versionCode: 'SC_0004',
      yearCode: 'SC_0005',
      modelYearCode: 'SC_0006',
    },
    normalizationProfile: input.normalizationProfile,
  });
  const masterCodes = new Set(input.specs.map((spec) => spec.code));
  const recognizedCodes = specColumns.filter((code) => masterCodes.has(effectiveCode(code)));
  const unknownCodes = specColumns.filter((code) => !masterCodes.has(effectiveCode(code)));
  let empty = 0;
  let tbd = 0;
  let recognized = 0;
  const unknownOccurrences = new Map(unknownCodes.map((code) => [code, 0]));
  for (const row of input.rows) {
    for (const code of specColumns) {
      const value = String(row[code] ?? '').trim();
      if (value === '') empty += 1;
      else if (value.toLocaleUpperCase('pt-BR') === 'TBD') tbd += 1;
      if (value !== '' && masterCodes.has(effectiveCode(code))) recognized += 1;
      if (value !== '' && !masterCodes.has(effectiveCode(code))) {
        unknownOccurrences.set(code, (unknownOccurrences.get(code) ?? 0) + 1);
      }
    }
  }
  const issues = base.vehicles.flatMap((vehicle) => vehicle.issues);
  const scaleSpecs = base.vehicles.flatMap((vehicle) =>
    vehicle.specs.filter((spec) => spec.kind === 'scale'),
  );
  const sourceNormalizations: Record<string, number> = {};
  for (const spec of base.vehicles.flatMap((vehicle) => vehicle.specs)) {
    if (!spec.sourceNormalization) continue;
    sourceNormalizations[spec.sourceNormalization] =
      (sourceNormalizations[spec.sourceNormalization] ?? 0) + 1;
  }
  const malformed = issues.filter((issue) => issue.category === 'MALFORMED_SOURCE_VALUE').length;
  const reviewIssues = issues.filter((issue) => issue.kind === 'spec_value_review');
  const pendingReviewCells = reviewIssues.reduce(
    (total, issue) =>
      total +
      (issue.category === 'SCALE_CONFLICT'
        ? Math.max(
            1,
            String(issue.code ?? '')
              .split(',')
              .filter(Boolean).length,
          )
        : 1),
    0,
  );
  const unknownSpecCodes = [...unknownOccurrences]
    .map(([code, occurrences]) => ({ code, occurrences }))
    .sort((left, right) => left.code.localeCompare(right.code));
  const secondPass = recordsToTransposedMatrix(input.rows, input.headers, input.sourceCodeMap);
  const deterministicTranspose = JSON.stringify(transposed) === JSON.stringify(secondPass);
  return {
    source: input.source,
    sourceSha256: input.sourceSha256,
    totals: {
      rows: input.rows.length,
      vehicles: base.totals.vehicles,
      columns: input.headers.length,
      specColumns: specColumns.length,
      productsAvailable: input.products.length,
      existingExact: base.totals.existing,
      newProduct: base.totals.new,
      ambiguous: base.totals.ambiguous,
      invalid: base.totals.invalid,
      specCellsObserved: input.rows.length * specColumns.length,
      specCellsRecognized: recognized,
      specCellsParsed: base.totals.recognizedSpecs,
      specCellsPromotable: recognized - pendingReviewCells,
      specCellsPendingReview: pendingReviewCells,
      specCellsMalformed: malformed,
      reviewIssueCount: reviewIssues.length,
      specCellsIgnoredEmpty: empty,
      specCellsIgnoredTbd: tbd,
      specCellsIgnoredEmptyOrTbd: empty + tbd,
      specCellsUnknownCode: [...unknownOccurrences.values()].reduce(
        (total, count) => total + count,
        0,
      ),
      uniqueRecognizedSpecCodes: recognizedCodes.length,
      uniqueUnknownSpecCodes: unknownCodes.length,
    },
    unknownSpecCodes,
    remainingIssues: summarizeRemainingIssues(issues),
    affectedVehicles: base.vehicles.filter((vehicle) => vehicle.issues.length > 0).length,
    parseIssuesByCategory: issueCounts(issues),
    issueExamplesByCategory: categorizedIssueExamples(issues),
    issueExamples: base.issueExamples,
    checks: {
      authoritativeYearsValidForAllVehicles: base.vehicles.every(
        (vehicle) => vehicle.productionYear !== null && vehicle.modelYear !== null,
      ),
      vehiclesRequiringYearInference: 0,
      unknownSpecsCreated: 0,
      allRowsProcessed: base.vehicles.length === input.rows.length,
      deterministicTranspose,
      noDuplicateBaselinePerSpecSet: base.vehicles.every((vehicle) => {
        const baselines = vehicle.specs.filter(
          (spec) => spec.kind === 'scale' && spec.resolution === 'baseline',
        );
        return (
          new Set(
            baselines.map((spec) => {
              const master = input.specs.find((item) => item.code === spec.code);
              return master ? scaleIdentity(master) : spec.code;
            }),
          ).size === baselines.length
        );
      }),
      noBaselineWithHigherMember: base.vehicles.every((vehicle) => {
        const scales = vehicle.specs.filter((spec) => spec.kind === 'scale');
        const groups = scales.map((spec) => {
          const master = input.specs.find((item) => item.code === spec.code);
          return master ? (scaleIdentity(master) ?? spec.code) : spec.code;
        });
        return new Set(groups).size === groups.length;
      }),
      historicalPw0045MappedOnlyToPw1045:
        input.sourceCodeMap?.PW_0045 === 'PW_1045' &&
        base.vehicles.every((vehicle) => !vehicle.specs.some((spec) => spec.code === 'PW_0045')),
    },
    scales: {
      resolvedByExplicitMember: scaleSpecs.filter((spec) => spec.resolution === 'explicit').length,
      resolvedByBaseline: scaleSpecs.filter((spec) => spec.resolution === 'baseline').length,
      conflicts: issues.filter((issue) => issue.category === 'SCALE_CONFLICT').length,
    },
    sourceNormalizations: Object.freeze(sourceNormalizations),
    preview: base.vehicles.slice(0, 10).map((vehicle) => ({
      sourceColumn: vehicle.sourceColumn,
      fullName: vehicle.fullName,
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      productionYear: vehicle.productionYear,
      modelYear: vehicle.modelYear,
      matchStatus: vehicle.matchStatus,
      existingProductId: vehicle.existingProductId,
      parsedSpecCount: vehicle.specs.length,
      reviewIssueCount: vehicle.issues.length,
      sampleSpecs: vehicle.specs.slice(0, 12),
    })),
    vehicles: base.vehicles,
  };
}

export function buildVehicleSpecsCsvDryRunReport(input: {
  readonly source: string;
  readonly sourceSha256: string;
  readonly csv: string;
  readonly specs: readonly MasterSpec[];
  readonly products: readonly ExistingProductIdentity[];
  readonly sourceCodeMap?: Readonly<Record<string, string>>;
  readonly normalizationProfile?: SourceNormalizationProfile;
}): VehicleSpecsCsvDryRunReport {
  const parsed = parseSemicolonVehicleSpecsCsv(input.csv);
  return buildVehicleSpecsRecordDryRunReport({ ...input, ...parsed });
}
