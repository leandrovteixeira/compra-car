import {
  createComparisonItem,
  createVehicle,
  type ComparisonItem,
  type Vehicle,
  type VehicleComparisonValue,
  type VehicleId,
} from '@compra-car/core';

import {
  InvalidLegacyNumericValueError,
  LegacyAdapterMappingError,
  UnknownLegacySpecTypeError,
} from './errors';
import type { LegacyProductRow, LegacyProductSpecRow, LegacySpecRow } from './legacy-dtos';

function requiredText(value: unknown, field: string, rowId: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || !String(value).trim()) {
    throw new LegacyAdapterMappingError(
      `Campo legado obrigatório inválido: ${field} na linha ${String(rowId)}.`,
    );
  }

  return String(value).trim();
}

export function mapLegacyProductToVehicle(row: LegacyProductRow): Vehicle {
  return createVehicle({
    id: requiredText(row.id, 'products.id', row.id),
    brand: requiredText(row.brand, 'products.brand', row.id),
    model: requiredText(row.model, 'products.model', row.id),
    version: requiredText(row.version, 'products.version', row.id),
    modelYear: requiredText(row.model_year, 'products.model_year', row.id),
    productionYear: requiredText(row.production_year, 'products.production_year', row.id),
    isActive: row.is_active === true,
    isPublic: row.is_public === true,
  });
}

function preferredText(
  localized: string | null | undefined,
  fallback: string | null,
  field: string,
  rowId: unknown,
): string {
  return requiredText(localized?.trim() || fallback, field, rowId);
}

function optionalSortOrder(value: string | number | null | undefined, rowId: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new LegacyAdapterMappingError(
      `Ordem de exibição inválida para specs.id ${String(rowId)}.`,
    );
  }
  return parsed;
}

export function mapLegacySpecToComparisonItem(row: LegacySpecRow): ComparisonItem {
  if (row.type !== 'binary' && row.type !== 'scale' && row.type !== 'numeric') {
    throw new UnknownLegacySpecTypeError(row.type, row.id);
  }

  let valueDirection: 'positive' | 'negative' | null = null;
  if (row.type === 'numeric') {
    if (row.value_direction === 'Positive') valueDirection = 'positive';
    else if (row.value_direction === 'Negative') valueDirection = 'negative';
    else {
      throw new LegacyAdapterMappingError(
        `Direção de valor inválida para specs.id ${String(row.id)}.`,
      );
    }
  }

  return createComparisonItem({
    id: requiredText(row.id, 'specs.id', row.id),
    code: requiredText(row.code, 'specs.code', row.id),
    type: row.type,
    category: preferredText(row.group_name_pt, row.group_name, 'specs.group_name', row.id),
    equipmentGroup: preferredText(
      row.equipment_group_pt,
      row.equipment_group,
      'specs.equipment_group',
      row.id,
    ),
    specSet: preferredText(row.spec_set_pt, row.spec_set, 'specs.spec_set', row.id),
    label: preferredText(
      row.display_pt,
      row.detail_pt?.trim() || row.detail,
      'specs.display_pt',
      row.id,
    ),
    optionLabel:
      row.type === 'scale'
        ? preferredText(row.detail_pt, row.detail, 'specs.detail_pt', row.id)
        : null,
    unit: row.type === 'numeric' && row.unit?.trim() ? row.unit.trim() : null,
    valueDirection,
    sortOrder: optionalSortOrder(row.display_order, row.id),
  });
}

function numericValue(row: LegacyProductSpecRow, spec: LegacySpecRow): number | null {
  if (row.value === null || (typeof row.value === 'string' && row.value.trim() === '')) {
    return null;
  }

  const value = typeof row.value === 'number' ? row.value : Number(row.value);
  if (!Number.isFinite(value)) {
    throw new InvalidLegacyNumericValueError(row.value, row.product_id, spec.id);
  }

  return value;
}

export function mapLegacyRowsToComparisonValues(
  vehicleIds: readonly VehicleId[],
  specs: readonly LegacySpecRow[],
  associations: readonly LegacyProductSpecRow[],
): readonly VehicleComparisonValue[] {
  const specById = new Map(specs.map((spec) => [spec.id, spec]));
  const associationByPair = new Map<string, LegacyProductSpecRow>();

  for (const association of associations) {
    const pair = `${association.product_id}:${association.equipment_id}`;
    if (associationByPair.has(pair)) {
      throw new LegacyAdapterMappingError(`Associação legada duplicada: ${pair}.`);
    }
    associationByPair.set(pair, association);
  }

  const values: VehicleComparisonValue[] = [];
  for (const vehicleId of vehicleIds) {
    for (const spec of specs) {
      const item = mapLegacySpecToComparisonItem(spec);
      const association = associationByPair.get(`${String(vehicleId)}:${spec.id}`);

      if (item.type === 'numeric') {
        values.push({
          vehicleId,
          itemCode: item.code,
          type: 'numeric',
          value: association ? numericValue(association, spec) : null,
          unit: association?.input_unit?.trim() || spec.unit?.trim() || null,
        });
      } else {
        values.push({
          vehicleId,
          itemCode: item.code,
          type: item.type,
          present: association?.is_present ?? null,
        });
      }
    }
  }

  for (const association of associations) {
    if (!specById.has(association.equipment_id)) {
      throw new LegacyAdapterMappingError(
        `Associação aponta para spec não carregado: ${association.equipment_id}.`,
      );
    }
  }

  return values;
}
