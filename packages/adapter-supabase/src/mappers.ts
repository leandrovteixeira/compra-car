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

export function mapLegacySpecToComparisonItem(row: LegacySpecRow): ComparisonItem {
  if (row.type !== 'binary' && row.type !== 'scale' && row.type !== 'numeric') {
    throw new UnknownLegacySpecTypeError(row.type, row.id);
  }

  return createComparisonItem({
    id: requiredText(row.id, 'specs.id', row.id),
    code: requiredText(row.code, 'specs.code', row.id),
    type: row.type,
    category: requiredText(row.group_name, 'specs.group_name', row.id),
    equipmentGroup: requiredText(row.equipment_group, 'specs.equipment_group', row.id),
    specSet: requiredText(row.spec_set, 'specs.spec_set', row.id),
    label: requiredText(row.detail, 'specs.detail', row.id),
    unit: row.type === 'numeric' && row.unit?.trim() ? row.unit.trim() : null,
    sortOrder: null,
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
          present: association !== undefined,
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
