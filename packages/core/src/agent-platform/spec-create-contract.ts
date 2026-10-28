/**
 * Full operator-authored specification definition, for the future Spec Agent.
 * No implicit values, no vehicle assignment, and no persistence side effects.
 */
export type SpecKind = 'binary' | 'numeric' | 'scale';
export type SpecDirection = 'Positive' | 'Negative';

export type SpecSharedFields = Readonly<{
  groupName: string;
  equipmentGroup: string;
  specSet: string;
  groupNamePt: string;
  equipmentGroupPt: string;
  specSetPt: string;
  displayPt: string;
  commercialCategory: string;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
}>;

export type SpecValueFields = Readonly<{
  code: string;
  detail: string;
  detailPt: string;
  /** User-authored commercial valuation — never taken blindly from the agent. */
  unitPerceivedValue: number;
  relativeValue: number;
}>;

export type BinarySpecCreate = SpecSharedFields & SpecValueFields & Readonly<{
  type: 'binary';
}>;

export type NumericSpecCreate = SpecSharedFields & SpecValueFields & Readonly<{
  type: 'numeric';
  unit: string;
  valueDirection: SpecDirection;
  displayUnitPt: string | null;
  displayDecimals: number;
  displayMultiplier: number;
}>;

export type ScaleOptionCreate = SpecValueFields & Readonly<{ isBaseline: boolean }>;
export type ScaleSpecCreate = SpecSharedFields & Readonly<{
  type: 'scale';
  /** A scale is a family, backed by multiple specs rows, never one arbitrary value. */
  options: readonly ScaleOptionCreate[];
}>;

export type SpecCreateInput = BinarySpecCreate | NumericSpecCreate | ScaleSpecCreate;

export type SpecRowDraft = Readonly<{
  code: string;
  type: SpecKind;
  group_name: string;
  equipment_group: string;
  spec_set: string;
  detail: string;
  group_name_pt: string;
  equipment_group_pt: string;
  spec_set_pt: string;
  detail_pt: string;
  display_pt: string;
  commercial_category: string;
  unit: string | null;
  value_direction: SpecDirection | null;
  unit_perceived_value: number;
  relative_value: number;
  is_baseline: boolean;
  is_active: boolean;
  notes: string | null;
  display_order: number;
  display_unit_pt: string | null;
  display_decimals: number | null;
  display_multiplier: number;
}>;

export class SpecCreateContractError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SpecCreateContractError'; }
}
const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 300)
    throw new SpecCreateContractError('REQUIRED_' + field.toUpperCase());
  return value.trim();
};
const valuation = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new SpecCreateContractError('INVALID_VALUATION');
  return value;
};
const code = (value: unknown): string => {
  const text = requiredText(value, 'code');
  if (!/^[A-Z][A-Z0-9_]{2,39}$/u.test(text)) throw new SpecCreateContractError('INVALID_SPEC_CODE');
  return text;
};
const field = (input: SpecValueFields) => ({
  code: code(input.code),
  detail: requiredText(input.detail, 'detail'),
  detail_pt: requiredText(input.detailPt, 'detailPt'),
  unit_perceived_value: valuation(input.unitPerceivedValue),
  relative_value: valuation(input.relativeValue),
});

/**
 * Generates the exact existing public.specs column set as a checked draft.
 * All uniqueness, category compatibility and concurrent writes MUST be revalidated in SQL.
 */
export function buildSpecCreateRows(input: SpecCreateInput): readonly SpecRowDraft[] {
  if (!input || !['binary', 'numeric', 'scale'].includes(input.type))
    throw new SpecCreateContractError('INVALID_SPEC_TYPE');
  const shared = {
    group_name: requiredText(input.groupName, 'groupName'),
    equipment_group: requiredText(input.equipmentGroup, 'equipmentGroup'),
    spec_set: requiredText(input.specSet, 'specSet'),
    group_name_pt: requiredText(input.groupNamePt, 'groupNamePt'),
    equipment_group_pt: requiredText(input.equipmentGroupPt, 'equipmentGroupPt'),
    spec_set_pt: requiredText(input.specSetPt, 'specSetPt'),
    display_pt: requiredText(input.displayPt, 'displayPt'),
    commercial_category: requiredText(input.commercialCategory, 'commercialCategory'),
    display_order: input.displayOrder,
    is_active: input.isActive,
    notes: input.notes,
  };
  if (!Number.isSafeInteger(shared.display_order) || shared.display_order < 0 ||
      typeof shared.is_active !== 'boolean' ||
      (shared.notes !== null && (typeof shared.notes !== 'string' || shared.notes.length > 2000)))
    throw new SpecCreateContractError('INVALID_SPEC_METADATA');

  let rows: SpecRowDraft[];
  if (input.type === 'scale') {
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 100)
      throw new SpecCreateContractError('INVALID_SCALE_OPTIONS');
    if (input.options.filter((option) => option.isBaseline === true).length !== 1 ||
        input.options.some((option) => typeof option.isBaseline !== 'boolean'))
      throw new SpecCreateContractError('SCALE_REQUIRES_ONE_BASELINE');
    rows = input.options.map((option) => ({
      ...shared, ...field(option), type: 'scale',
      unit: null, value_direction: null,
      is_baseline: option.isBaseline,
      display_unit_pt: null, display_decimals: null, display_multiplier: 1,
    }));
  } else if (input.type === 'numeric') {
    const unit = requiredText(input.unit, 'unit');
    if (!['Positive', 'Negative'].includes(input.valueDirection) ||
        !Number.isInteger(input.displayDecimals) ||
        input.displayDecimals < 0 || input.displayDecimals > 6 ||
        !Number.isFinite(input.displayMultiplier) || input.displayMultiplier <= 0 ||
        (input.displayUnitPt !== null && typeof input.displayUnitPt !== 'string'))
      throw new SpecCreateContractError('INVALID_NUMERIC_METADATA');
    rows = [{
      ...shared, ...field(input), type: 'numeric', unit,
      value_direction: input.valueDirection, is_baseline: false,
      display_unit_pt: input.displayUnitPt?.trim() || null,
      display_decimals: input.displayDecimals, display_multiplier: input.displayMultiplier,
    }];
  } else {
    rows = [{
      ...shared, ...field(input), type: 'binary', unit: null,
      value_direction: null, is_baseline: false,
      display_unit_pt: null, display_decimals: null, display_multiplier: 1,
    }];
  }

  const codes = new Set<string>(), structures = new Set<string>();
  for (const row of rows) {
    const structure = JSON.stringify([
      row.group_name, row.equipment_group, row.spec_set, row.detail,
    ]);
    if (codes.has(row.code) || structures.has(structure))
      throw new SpecCreateContractError('DUPLICATE_SPEC_DEFINITION');
    codes.add(row.code);
    structures.add(structure);
  }
  return rows;
}

/** A scale field and one of its values require different alias target kinds. */
export type SpecMergeTarget =
  | Readonly<{ kind: 'SPEC_FIELD'; specId: number; type: 'binary' | 'numeric' }>
  | Readonly<{ kind: 'SPEC_FIELD'; scaleFamilyId: string; type: 'scale' }>
  | Readonly<{ kind: 'SCALE_OPTION'; specId: number; scaleFamilyId: string }>;

export function validateSpecMergeTarget(target: SpecMergeTarget): SpecMergeTarget {
  if (!target || !['SPEC_FIELD', 'SCALE_OPTION'].includes(target.kind))
    throw new SpecCreateContractError('INVALID_SPEC_MERGE_TARGET');
  if (target.kind === 'SCALE_OPTION') {
    if (!Number.isSafeInteger(target.specId) || target.specId <= 0 ||
        !target.scaleFamilyId?.trim())
      throw new SpecCreateContractError('INVALID_SPEC_MERGE_TARGET');
  } else if (target.type === 'scale') {
    if (!target.scaleFamilyId?.trim())
      throw new SpecCreateContractError('INVALID_SPEC_MERGE_TARGET');
  } else if (!Number.isSafeInteger(target.specId) || target.specId <= 0 ||
             !['numeric', 'binary'].includes(target.type))
    throw new SpecCreateContractError('INVALID_SPEC_MERGE_TARGET');
  return target;
}
