import { parseCanonicalNumeric } from '../admin/canonical-numeric';
import {
  normalizeVehicleText,
  vehicleTextComparisonKey,
} from '../admin/vehicle-text-normalization';

export type MatrixCell = string | number | null | undefined;
export type MatrixRow = Readonly<Record<string, MatrixCell>>;
export type SourceNormalizationProfile = 'legacy-staging-csv';
export type VehicleMatchStatus = 'EXISTING_EXACT' | 'NEW_PRODUCT' | 'AMBIGUOUS' | 'INVALID';
export type DryRunIssueKind =
  | 'invalid_vehicle'
  | 'year_review'
  | 'unknown_spec_code'
  | 'spec_value_review'
  | 'ambiguous_product';

export interface VehicleSpecsMatrixLayout {
  readonly codeColumn: string;
  readonly fullNameCode: string;
  readonly brandCode: 'SC_0002';
  readonly modelCode: 'SC_0003';
  readonly versionCode: 'SC_0004';
  readonly yearCode: 'SC_0005';
  /** When present, SC_0005/SC_0006 are authoritative production/model years. */
  readonly modelYearCode?: 'SC_0006';
}

export const DEFAULT_VEHICLE_SPECS_MATRIX_LAYOUT: VehicleSpecsMatrixLayout = Object.freeze({
  codeColumn: 'code',
  fullNameCode: 'SC_0001',
  brandCode: 'SC_0002',
  modelCode: 'SC_0003',
  versionCode: 'SC_0004',
  yearCode: 'SC_0005',
});

export interface MasterSpec {
  readonly id: string;
  readonly code: string;
  readonly type: 'numeric' | 'binary' | 'scale';
  readonly unit: string | null;
  readonly specSet?: string;
  readonly isBaseline?: boolean;
  readonly groupName?: string;
  readonly equipmentGroup?: string;
}

export interface ExistingProductIdentity {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly productionYear: number;
  readonly modelYear: number;
}

export interface DryRunIssue {
  readonly kind: DryRunIssueKind;
  readonly category?: string;
  readonly sourceColumn: string;
  readonly code?: string;
  readonly value?: MatrixCell;
  readonly message: string;
}

export type CandidateSpec =
  | {
      readonly code: string;
      readonly specId: string;
      readonly kind: 'numeric';
      readonly value: number;
      readonly calculatedValue?: number;
      readonly numericCanonicalization?: 'numeric(14,4)';
      readonly rawValue?: MatrixCell;
      readonly sourceNormalization?: string;
    }
  | {
      readonly code: string;
      readonly specId: string;
      readonly kind: 'binary';
      readonly isPresent: boolean;
      readonly rawValue?: MatrixCell;
      readonly sourceNormalization?: string;
    }
  | {
      readonly code: string;
      readonly specId: string;
      readonly kind: 'scale';
      readonly isPresent: true;
      readonly resolution: 'explicit' | 'baseline';
      readonly rawValue?: MatrixCell;
      readonly sourceNormalization?: string;
    };

export interface VehicleCandidate {
  readonly sourceColumn: string;
  readonly fullName: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly productionYear: number | null;
  readonly modelYear: number | null;
  readonly specs: readonly CandidateSpec[];
  readonly matchStatus: VehicleMatchStatus;
  readonly existingProductId: string | null;
  readonly issues: readonly DryRunIssue[];
}

export interface VehicleSpecsDryRunReport {
  readonly source: string;
  readonly totals: {
    readonly vehicles: number;
    readonly existing: number;
    readonly new: number;
    readonly ambiguous: number;
    readonly invalid: number;
    readonly specCells: number;
    readonly recognizedSpecs: number;
    readonly unknownSpecCodes: number;
    readonly normalized: number;
    readonly reviewRequired: number;
  };
  readonly issueExamples: Readonly<Partial<Record<DryRunIssueKind, readonly DryRunIssue[]>>>;
  readonly vehicles: readonly VehicleCandidate[];
}

export type YearParseResult =
  | {
      readonly ok: true;
      readonly productionYear: number;
      readonly modelYear: number;
      readonly corrected: boolean;
    }
  | { readonly ok: false; readonly needsReview: true; readonly message: string };

const text = (value: MatrixCell): string => String(value ?? '').trim();
const expandYear = (year: string): number => 2000 + Number(year);

function yearsInEvidence(evidence: string): readonly number[] {
  return [...evidence.matchAll(/\b20\d{2}\b/gu)].map((match) => Number(match[0]));
}

export function parseVehicleYears(value: MatrixCell, vehicleEvidence = ''): YearParseResult {
  const raw = text(value);
  const pair = /^(\d{2})\s*\/\s*(\d{2})$/u.exec(raw);
  if (pair) {
    return {
      ok: true,
      productionYear: expandYear(pair[1]!),
      modelYear: expandYear(pair[2]!),
      corrected: false,
    };
  }

  if (/^2\.\d{3}$/u.test(raw)) {
    const evidenceYears = yearsInEvidence(vehicleEvidence);
    const distinctEvidenceYears = [...new Set(evidenceYears)];
    if (distinctEvidenceYears.length === 1) {
      const evidencedYear = distinctEvidenceYears[0]!;
      return {
        ok: true,
        productionYear: evidencedYear,
        modelYear: evidencedYear,
        corrected: true,
      };
    }
    return {
      ok: false,
      needsReview: true,
      message: `Ano anômalo ${raw} sem evidência inequívoca no nome/cabeçalho do veículo.`,
    };
  }

  return { ok: false, needsReview: true, message: `Ano não reconhecido: ${raw || '(vazio)'}.` };
}

export function parseAuthoritativeVehicleYears(
  productionValue: MatrixCell,
  modelValue: MatrixCell,
): YearParseResult {
  const productionRaw = text(productionValue);
  const modelRaw = text(modelValue);
  if (!/^20\d{2}$/u.test(productionRaw) || !/^20\d{2}$/u.test(modelRaw)) {
    return {
      ok: false,
      needsReview: true,
      message: `Anos autorais inválidos: produção=${productionRaw || '(vazio)'}, modelo=${modelRaw || '(vazio)'}.`,
    };
  }
  const productionYear = Number(productionRaw);
  const modelYear = Number(modelRaw);
  if (modelYear !== productionYear && modelYear !== productionYear + 1) {
    return {
      ok: false,
      needsReview: true,
      message: `Conflito nos anos autorais: produção=${productionYear}, modelo=${modelYear}.`,
    };
  }
  return { ok: true, productionYear, modelYear, corrected: false };
}

function identityKey(identity: Omit<ExistingProductIdentity, 'id'>): string {
  return [
    vehicleTextComparisonKey(identity.brand),
    vehicleTextComparisonKey(identity.model),
    vehicleTextComparisonKey(identity.version),
    identity.productionYear,
    identity.modelYear,
  ].join('\u001f');
}

function reviewIssue(
  spec: MasterSpec,
  value: MatrixCell,
  category: string,
  message: string,
): DryRunIssue {
  return { kind: 'spec_value_review', category, sourceColumn: '', code: spec.code, value, message };
}

function expandDecimal(value: number): {
  readonly negative: boolean;
  readonly digits: string;
  readonly scale: number;
} {
  if (!Number.isFinite(value)) throw new Error('Valor numeric não finito.');
  const negative = value < 0 || Object.is(value, -0);
  const source = Math.abs(value).toString().toLocaleLowerCase('en-US');
  const [coefficient, exponentText = '0'] = source.split('e');
  const exponent = Number(exponentText);
  const [integer, fraction = ''] = coefficient!.split('.');
  const rawDigits = `${integer}${fraction}`.replace(/^0+(?=\d)/u, '') || '0';
  const scale = fraction.length - exponent;
  return scale < 0
    ? { negative, digits: `${rawDigits}${'0'.repeat(-scale)}`, scale: 0 }
    : { negative, digits: rawDigits, scale };
}

/** PostgreSQL numeric rounds ties away from zero when reducing scale. */
export function canonicalizeProductSpecNumeric(value: number): number {
  const targetScale = 4;
  const decimal = expandDecimal(value);
  let magnitude = BigInt(decimal.digits);
  if (decimal.scale > targetScale) {
    const divisor = 10n ** BigInt(decimal.scale - targetScale);
    const quotient = magnitude / divisor;
    const remainder = magnitude % divisor;
    magnitude = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  } else if (decimal.scale < targetScale) {
    magnitude *= 10n ** BigInt(targetScale - decimal.scale);
  }
  if (magnitude >= 10n ** 14n) throw new Error('Valor excede a precisão de numeric(14,4).');
  return Number(decimal.negative ? -magnitude : magnitude) / 10 ** targetScale;
}

function pendingValue(spec: MasterSpec, value: MatrixCell): DryRunIssue | null {
  const raw = text(value);
  const upper = raw.toLocaleUpperCase('pt-BR');
  if (upper === 'TBD' || upper === 'TBC') {
    return reviewIssue(spec, value, upper, `${upper} representa valor pendente/não autoral.`);
  }
  if (/\b(?:TBD|TBC)\b/u.test(upper)) {
    return reviewIssue(
      spec,
      value,
      'QUALIFIED_PENDING_VALUE',
      'Valor qualificado contém indicação explícita de pendência e não pode ser promovido.',
    );
  }
  if (/^,+$/u.test(raw)) {
    return reviewIssue(
      spec,
      value,
      'MALFORMED_SOURCE_VALUE',
      'Valor sem conteúdo semântico válido.',
    );
  }
  return null;
}

function parseSpecCell(
  spec: MasterSpec,
  value: MatrixCell,
  normalizationProfile?: SourceNormalizationProfile,
): CandidateSpec | DryRunIssue | null {
  let raw = text(value);
  if (raw === '') return null;
  const pending = pendingValue(spec, value);
  if (pending) return pending;
  if (spec.type === 'binary') {
    const normalized = raw.toLocaleLowerCase('pt-BR');
    if (
      normalizationProfile === 'legacy-staging-csv' &&
      spec.code === 'CO_0033' &&
      normalized === 'alert&can be closed'
    ) {
      return {
        code: spec.code,
        specId: spec.id,
        kind: 'binary',
        isPresent: true,
        rawValue: value,
        sourceNormalization: 'LEGACY_CO_0033_ALERT_CAN_BE_CLOSED_TRUE',
      };
    }
    if (
      normalizationProfile === 'legacy-staging-csv' &&
      spec.code === 'SF_0041' &&
      normalized === 'usb'
    ) {
      return {
        code: spec.code,
        specId: spec.id,
        kind: 'binary',
        isPresent: false,
        rawValue: value,
        sourceNormalization: 'LEGACY_SF_0041_USB_FALSE',
      };
    }
    if (normalized === 's' || normalized === 'true' || normalized === '1') {
      return { code: spec.code, specId: spec.id, kind: 'binary', isPresent: true };
    }
    if (normalized === '0') {
      return { code: spec.code, specId: spec.id, kind: 'binary', isPresent: false };
    }
    return reviewIssue(spec, value, 'UNEXPECTED_BINARY_VALUE', 'Conteúdo binary inesperado.');
  }
  if (spec.type === 'scale') {
    return reviewIssue(
      spec,
      value,
      'UNEXPECTED_SCALE_VALUE',
      'Scale deve ser resolvida por spec_set.',
    );
  }

  if (spec.code === 'EX_0004') {
    const tire = /^\s*\d{2,3}\s*\/\s*(\d{2})\s*R\s*\d{2}\s*$/iu.exec(raw);
    if (tire) raw = tire[1]!;
  }
  if (
    spec.unit?.trim().toLocaleLowerCase('en-US') === 'inch' &&
    /^-?\d+(?:[.,]\d+)?\s*"$/u.test(raw)
  ) {
    raw = raw.replace(/\s*"$/u, '');
  }

  const sourceFormat =
    raw.includes(',') || /^-?\d{1,3}(?:\.\d{3})+$/u.test(raw) ? 'pt-BR' : 'canonical';
  const parsed = parseCanonicalNumeric(raw, sourceFormat);
  if (!parsed.ok || parsed.kind === 'empty') {
    return {
      kind: 'spec_value_review',
      category: parsed.ok ? 'EMPTY_NUMERIC_VALUE' : `NUMERIC_${parsed.kind.toUpperCase()}`,
      sourceColumn: '',
      code: spec.code,
      value,
      message: parsed.ok ? 'Valor numérico vazio.' : parsed.message,
    };
  }
  try {
    const canonical = canonicalizeProductSpecNumeric(parsed.value);
    return canonical === parsed.value
      ? { code: spec.code, specId: spec.id, kind: 'numeric', value: canonical }
      : {
          code: spec.code,
          specId: spec.id,
          kind: 'numeric',
          value: canonical,
          calculatedValue: parsed.value,
          numericCanonicalization: 'numeric(14,4)',
        };
  } catch (error) {
    return reviewIssue(
      spec,
      value,
      'NUMERIC_PRECISION_OVERFLOW',
      error instanceof Error ? error.message : 'Valor incompatível com numeric(14,4).',
    );
  }
}

interface ScaleCell {
  readonly spec: MasterSpec;
  readonly value: MatrixCell;
}

export function scaleIdentity(spec: MasterSpec): string | null {
  const specSet = spec.specSet?.trim();
  if (!specSet) return null;
  return [spec.groupName?.trim() ?? '', spec.equipmentGroup?.trim() ?? '', specSet].join('\u001f');
}

function resolveScaleGroups(
  cells: readonly ScaleCell[],
  specs: readonly MasterSpec[],
  sourceColumn: string,
  candidateSpecs: CandidateSpec[],
  issues: DryRunIssue[],
  normalizationProfile?: SourceNormalizationProfile,
): void {
  const groups = new Map<string, ScaleCell[]>();
  for (const cell of cells) {
    const group = scaleIdentity(cell.spec);
    if (!group) {
      issues.push({
        ...reviewIssue(cell.spec, cell.value, 'SCALE_WITHOUT_SPEC_SET', 'Scale sem spec_set.'),
        sourceColumn,
      });
      continue;
    }
    groups.set(group, [...(groups.get(group) ?? []), cell]);
  }
  for (const [scaleKey, members] of groups) {
    const specSet = members[0]!.spec.specSet!.trim();
    const relevant = members.filter((member) => text(member.value) !== '');
    const valid: ScaleCell[] = [];
    for (const member of relevant) {
      const pending = pendingValue(member.spec, member.value);
      if (pending) issues.push({ ...pending, sourceColumn });
      else valid.push(member);
    }
    const selected = valid.filter((member) =>
      ['s', 'true', '1'].includes(text(member.value).toLocaleLowerCase('pt-BR')),
    );
    const explicitNonBaseline = selected.filter((member) => member.spec.isBaseline !== true);
    const unexpected = valid.filter(
      (member) => !['s', 'true', '1', '0'].includes(text(member.value).toLocaleLowerCase('pt-BR')),
    );
    for (const member of unexpected) {
      issues.push({
        ...reviewIssue(
          member.spec,
          member.value,
          'UNEXPECTED_SCALE_VALUE',
          'Conteúdo scale inesperado.',
        ),
        sourceColumn,
      });
    }
    if (explicitNonBaseline.length > 1) {
      const selectedCodes = new Set(explicitNonBaseline.map((member) => member.spec.code));
      const historicalChoice =
        normalizationProfile === 'legacy-staging-csv' &&
        selectedCodes.size === 2 &&
        selectedCodes.has('EX_0030') &&
        selectedCodes.has('EX_0031')
          ? {
              code: 'EX_0031',
              rule: 'LEGACY_MIRROR_TILT_RIGHT_BOTH_TO_BOTH',
            }
          : normalizationProfile === 'legacy-staging-csv' &&
              selectedCodes.size === 2 &&
              selectedCodes.has('SF_0034') &&
              selectedCodes.has('SF_0035')
            ? {
                code: 'SF_0035',
                rule: 'LEGACY_PARKING_CAMERA_RVM_360_TO_360',
              }
            : null;
      if (historicalChoice) {
        const chosen = explicitNonBaseline.find(
          (member) => member.spec.code === historicalChoice.code,
        )!.spec;
        candidateSpecs.push({
          code: chosen.code,
          specId: chosen.id,
          kind: 'scale',
          isPresent: true,
          resolution: 'explicit',
          rawValue: explicitNonBaseline.map((member) => text(member.value)).join(','),
          sourceNormalization: historicalChoice.rule,
        });
        continue;
      }
      issues.push({
        kind: 'spec_value_review',
        category: 'SCALE_CONFLICT',
        sourceColumn,
        code: explicitNonBaseline.map((member) => member.spec.code).join(','),
        value: explicitNonBaseline.map((member) => text(member.value)).join(','),
        message: `Múltiplos membros não-baseline selecionados em ${specSet}.`,
      });
      continue;
    }
    if (explicitNonBaseline.length === 1) {
      const chosen = explicitNonBaseline[0]!.spec;
      candidateSpecs.push({
        code: chosen.code,
        specId: chosen.id,
        kind: 'scale',
        isPresent: true,
        resolution: 'explicit',
      });
      continue;
    }
    const hasBaselineSignal =
      selected.some((member) => member.spec.isBaseline === true) ||
      valid.some((member) => text(member.value) === '0');
    if (!hasBaselineSignal) continue;
    const baselines = specs
      .filter(
        (spec) =>
          spec.type === 'scale' && scaleIdentity(spec) === scaleKey && spec.isBaseline === true,
      )
      .map((spec) => ({ spec, value: '' }));
    if (baselines.length !== 1) {
      issues.push({
        kind: 'spec_value_review',
        category: 'SCALE_BASELINE_INVALID',
        sourceColumn,
        code: baselines.map((member) => member.spec.code).join(','),
        message: `Spec set ${specSet} não possui exatamente um baseline.`,
      });
      continue;
    }
    const baseline = baselines[0]!.spec;
    candidateSpecs.push({
      code: baseline.code,
      specId: baseline.id,
      kind: 'scale',
      isPresent: true,
      resolution: 'baseline',
    });
  }
}

export function transposeVehicleSpecsMatrix(
  rows: readonly MatrixRow[],
  specs: readonly MasterSpec[],
  products: readonly ExistingProductIdentity[],
  layout: VehicleSpecsMatrixLayout = DEFAULT_VEHICLE_SPECS_MATRIX_LAYOUT,
  normalizationProfile?: SourceNormalizationProfile,
): readonly VehicleCandidate[] {
  const rowsByCode = new Map(rows.map((row) => [text(row[layout.codeColumn]), row]));
  const metadataCodes = new Set([
    layout.fullNameCode,
    layout.brandCode,
    layout.modelCode,
    layout.versionCode,
    layout.yearCode,
    ...(layout.modelYearCode ? [layout.modelYearCode] : []),
  ]);
  const specByCode = new Map(specs.map((spec) => [spec.code, spec]));
  const productGroups = new Map<string, ExistingProductIdentity[]>();
  for (const product of products) {
    const key = identityKey(product);
    productGroups.set(key, [...(productGroups.get(key) ?? []), product]);
  }
  const sourceColumns = Object.keys(rowsByCode.get(layout.brandCode) ?? {}).filter(
    (column) => column !== layout.codeColumn,
  );

  return sourceColumns.map((sourceColumn) => {
    const fullName = text(rowsByCode.get(layout.fullNameCode)?.[sourceColumn]);
    const brand = normalizeVehicleText(text(rowsByCode.get(layout.brandCode)?.[sourceColumn]));
    const model = normalizeVehicleText(text(rowsByCode.get(layout.modelCode)?.[sourceColumn]));
    const version = normalizeVehicleText(text(rowsByCode.get(layout.versionCode)?.[sourceColumn]));
    const year = layout.modelYearCode
      ? parseAuthoritativeVehicleYears(
          rowsByCode.get(layout.yearCode)?.[sourceColumn],
          rowsByCode.get(layout.modelYearCode)?.[sourceColumn],
        )
      : parseVehicleYears(
          rowsByCode.get(layout.yearCode)?.[sourceColumn],
          `${sourceColumn} ${fullName}`,
        );
    const issues: DryRunIssue[] = [];
    if (!year.ok)
      issues.push({
        kind: 'year_review',
        category: layout.modelYearCode ? 'AUTHORITATIVE_YEAR_INVALID' : 'YEAR_REVIEW',
        sourceColumn,
        value: rowsByCode.get(layout.yearCode)?.[sourceColumn],
        message: year.message,
      });
    if (!brand || !model || !version)
      issues.push({
        kind: 'invalid_vehicle',
        category: 'INVALID_VEHICLE_IDENTITY',
        sourceColumn,
        message: 'Marca, modelo e versão são obrigatórios.',
      });
    const candidateSpecs: CandidateSpec[] = [];
    const scaleCells: ScaleCell[] = [];

    for (const [code, row] of rowsByCode) {
      if (!code || metadataCodes.has(code)) continue;
      const value = row[sourceColumn];
      if (text(value) === '') continue;
      const spec = specByCode.get(code);
      if (!spec) {
        issues.push({
          kind: 'unknown_spec_code',
          category: 'UNKNOWN_SPEC_CODE',
          sourceColumn,
          code,
          value,
          message: `Spec code ${code} não encontrado no catálogo mestre.`,
        });
        continue;
      }
      if (spec.type === 'scale') {
        scaleCells.push({ spec, value });
        continue;
      }
      const parsed = parseSpecCell(spec, value, normalizationProfile);
      if (parsed && 'message' in parsed) issues.push({ ...parsed, sourceColumn });
      else if (parsed) candidateSpecs.push(parsed);
    }
    resolveScaleGroups(
      scaleCells,
      specs,
      sourceColumn,
      candidateSpecs,
      issues,
      normalizationProfile,
    );

    let matchStatus: VehicleMatchStatus = 'INVALID';
    let existingProductId: string | null = null;
    if (brand && model && version && year.ok) {
      const matches =
        productGroups.get(
          identityKey({
            brand,
            model,
            version,
            productionYear: year.productionYear,
            modelYear: year.modelYear,
          }),
        ) ?? [];
      if (matches.length === 0) matchStatus = 'NEW_PRODUCT';
      else if (matches.length === 1) {
        matchStatus = 'EXISTING_EXACT';
        existingProductId = matches[0]!.id;
      } else {
        matchStatus = 'AMBIGUOUS';
        issues.push({
          kind: 'ambiguous_product',
          category: 'AMBIGUOUS_PRODUCT',
          sourceColumn,
          message: `Mais de um produto corresponde à identidade normalizada (${matches.map((item) => item.id).join(', ')}).`,
        });
      }
    }

    return {
      sourceColumn,
      fullName,
      brand,
      model,
      version,
      productionYear: year.ok ? year.productionYear : null,
      modelYear: year.ok ? year.modelYear : null,
      specs: candidateSpecs,
      matchStatus,
      existingProductId,
      issues,
    };
  });
}

export function buildVehicleSpecsDryRunReport(input: {
  readonly source: string;
  readonly rows: readonly MatrixRow[];
  readonly specs: readonly MasterSpec[];
  readonly products: readonly ExistingProductIdentity[];
  readonly layout?: VehicleSpecsMatrixLayout;
  readonly normalizationProfile?: SourceNormalizationProfile;
}): VehicleSpecsDryRunReport {
  const layout = input.layout ?? DEFAULT_VEHICLE_SPECS_MATRIX_LAYOUT;
  const vehicles = transposeVehicleSpecsMatrix(
    input.rows,
    input.specs,
    input.products,
    layout,
    input.normalizationProfile,
  );
  const issues = vehicles.flatMap((vehicle) => vehicle.issues);
  const nonMetadataRows = input.rows.filter((row) => {
    const code = text(row[layout.codeColumn]);
    return (
      code &&
      !new Set([
        layout.fullNameCode,
        layout.brandCode,
        layout.modelCode,
        layout.versionCode,
        layout.yearCode,
        ...(layout.modelYearCode ? [layout.modelYearCode] : []),
      ]).has(code)
    );
  });
  const specCells = vehicles.reduce(
    (total, vehicle) =>
      total + nonMetadataRows.filter((row) => text(row[vehicle.sourceColumn]) !== '').length,
    0,
  );
  const issueExamples: Partial<Record<DryRunIssueKind, DryRunIssue[]>> = {};
  for (const issue of issues) {
    const examples = (issueExamples[issue.kind] ??= []);
    if (examples.length < 5) examples.push(issue);
  }
  return {
    source: input.source,
    totals: {
      vehicles: vehicles.length,
      existing: vehicles.filter((item) => item.matchStatus === 'EXISTING_EXACT').length,
      new: vehicles.filter((item) => item.matchStatus === 'NEW_PRODUCT').length,
      ambiguous: vehicles.filter((item) => item.matchStatus === 'AMBIGUOUS').length,
      invalid: vehicles.filter((item) => item.matchStatus === 'INVALID').length,
      specCells,
      recognizedSpecs: vehicles.reduce((total, item) => total + item.specs.length, 0),
      unknownSpecCodes: issues.filter((item) => item.kind === 'unknown_spec_code').length,
      normalized: vehicles.reduce(
        (total, item) => total + item.specs.filter((spec) => spec.kind === 'numeric').length,
        0,
      ),
      reviewRequired: issues.length,
    },
    issueExamples,
    vehicles,
  };
}
