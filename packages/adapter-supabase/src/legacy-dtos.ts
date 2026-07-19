export interface LegacyProductRow {
  readonly id: number;
  readonly brand: string | null;
  readonly model: string | null;
  readonly version: string | null;
  readonly model_year: string | number | null;
  readonly production_year: string | number | null;
  readonly is_active: boolean | null;
  readonly is_public: boolean | null;
}

export interface LegacySpecRow {
  readonly id: number;
  readonly code: string | null;
  readonly type: string | null;
  readonly group_name: string | null;
  readonly equipment_group: string | null;
  readonly spec_set: string | null;
  readonly detail: string | null;
  readonly unit: string | null;
  readonly value_direction: string | null;
  readonly is_active: boolean | null;
}

export interface LegacyProductSpecRow {
  readonly product_id: number;
  readonly equipment_id: number;
  readonly value: string | number | null;
  readonly is_present: boolean | null;
  readonly input_unit: string | null;
}

export interface LegacyComparisonJoinRow {
  readonly association: LegacyProductSpecRow;
  readonly spec: LegacySpecRow;
}
