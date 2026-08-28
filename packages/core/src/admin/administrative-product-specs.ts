import { parseCanonicalNumeric } from './canonical-numeric';

export type AdministrativeSpecType = 'numeric' | 'binary' | 'scale';

export interface AdministrativeSpecCatalogItem {
  readonly id: string;
  readonly code: string;
  readonly type: AdministrativeSpecType;
  readonly groupName: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly detail: string;
  readonly unit: string | null;
}

export interface AdministrativeProductSpecValue {
  readonly specId: string;
  readonly value: number | null;
  readonly isPresent: boolean | null;
  readonly inputUnit: string | null;
}

export interface UnitConversion {
  readonly unitFrom: string;
  readonly unitTo: string;
  readonly multiplier: number;
  readonly offset: number;
}

interface AdministrativeSpecBase {
  readonly groupName: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly searchText: string;
}

export interface AdministrativeNumericSpec extends AdministrativeSpecBase {
  readonly kind: 'numeric';
  readonly specId: string;
  readonly code: string;
  readonly label: string;
  readonly unit: string | null;
  readonly inputUnit: string | null;
  readonly value: string;
  readonly supportsTorqueUnit: boolean;
}

export interface AdministrativeBinarySpec extends AdministrativeSpecBase {
  readonly kind: 'binary';
  readonly specId: string;
  readonly code: string;
  readonly label: string;
  readonly present: boolean | null;
}

export interface AdministrativeScaleSpec extends AdministrativeSpecBase {
  readonly kind: 'scale';
  readonly key: string;
  readonly label: string;
  readonly options: readonly {
    readonly specId: string;
    readonly code: string;
    readonly label: string;
  }[];
  readonly selectedSpecId: string | null;
}

export type AdministrativeSpecField =
  AdministrativeNumericSpec | AdministrativeBinarySpec | AdministrativeScaleSpec;

export interface AdministrativeSpecGroup {
  readonly name: string;
  readonly fields: readonly AdministrativeSpecField[];
  readonly filled: number;
  readonly total: number;
}

export interface AdministrativeProductSpecsModel {
  readonly groups: readonly AdministrativeSpecGroup[];
  readonly filled: number;
  readonly total: number;
}

export type AdministrativeSpecSubmission =
  | {
      readonly kind: 'numeric';
      readonly specId: string;
      readonly value: string;
      readonly inputUnit: string | null;
    }
  | { readonly kind: 'binary'; readonly specId: string; readonly present: boolean | null }
  | {
      readonly kind: 'scale';
      readonly specIds: readonly string[];
      readonly selectedSpecId: string | null;
    };

export interface AdministrativeProductSpecWrite {
  readonly specId: string;
  readonly value: number | null;
  readonly isPresent: boolean | null;
  readonly inputUnit: string | null;
}

export interface AdministrativeProductSpecsBatch {
  readonly upserts: readonly AdministrativeProductSpecWrite[];
  readonly deleteSpecIds: readonly string[];
}

export interface AdministrativeProductSpecsRepository {
  listActiveAdministrativeSpecs(): Promise<readonly AdministrativeSpecCatalogItem[]>;
  listAdministrativeProductSpecValues(
    productId: string,
  ): Promise<readonly AdministrativeProductSpecValue[]>;
  listUnitConversions(): Promise<readonly UnitConversion[]>;
  saveAdministrativeProductSpecs(
    productId: string,
    batch: AdministrativeProductSpecsBatch,
  ): Promise<void>;
}

export const TORQUE_SPEC_CODES = Object.freeze([
  'PW_0012',
  'PW_0023',
  'PW_0026',
  'PW_0033',
] as const);

export function isFilledAdministrativeSpec(field: AdministrativeSpecField): boolean {
  if (field.kind === 'binary') return field.present !== null;
  if (field.kind === 'scale') return field.selectedSpecId !== null;
  return field.value !== '';
}

export function parseAdministrativeNumeric(value: string): number | null {
  const compact = value.trim();
  const decimalPart = compact.includes(',')
    ? compact.split(',')[1]
    : /^-?\d+\.\d{1,2}$/u.test(compact)
      ? compact.split('.')[1]
      : undefined;
  if (decimalPart !== undefined && decimalPart.length > 2) {
    throw new Error('Informe um número com no máximo duas casas decimais.');
  }
  const sourceFormat =
    compact.includes(',') || /^-?\d{1,3}(?:\.\d{3})+$/u.test(compact) ? 'pt-BR' : 'canonical';
  const parsed = parseCanonicalNumeric(value, sourceFormat);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
}

export function formatAdministrativeNumeric(value: number | null): string {
  if (value === null) return '';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

export function convertUnit(
  value: number,
  unitFrom: string,
  unitTo: string,
  conversions: readonly UnitConversion[],
): number {
  if (unitFrom === unitTo) return value;
  const conversion = conversions.find(
    (item) =>
      item.unitFrom.toLocaleLowerCase() === unitFrom.toLocaleLowerCase() &&
      item.unitTo.toLocaleLowerCase() === unitTo.toLocaleLowerCase(),
  );
  if (!conversion) throw new Error(`Conversão de ${unitFrom} para ${unitTo} não encontrada.`);
  return value * conversion.multiplier + conversion.offset;
}
