import type {
  ComparisonCellDto,
  ComparisonOutcome,
  ComparisonResult,
  VehicleComparisonValue,
} from '@compra-car/contracts';

import {
  formatComparisonNumber,
  type ComparisonNumberMetadata,
} from './comparison-number-formatter';
import type { ComparisonPageViewModel } from './comparison-view-model';

export const PRESENCE_DISPLAY_VALUE = '●';

export function toComparisonCell(
  value: VehicleComparisonValue,
  comparison: ComparisonOutcome = 'not-applicable',
  metadata: ComparisonNumberMetadata = { code: String(value.itemCode) },
): ComparisonCellDto {
  if (value.type !== 'numeric') {
    return Object.freeze({
      type: value.type,
      displayValue: value.present === true ? PRESENCE_DISPLAY_VALUE : '—',
      comparison,
    });
  }

  if (value.value === null) {
    return Object.freeze({ type: 'numeric', displayValue: '—', comparison });
  }

  return Object.freeze({
    type: 'numeric',
    displayValue: formatComparisonNumber(value.value, value.unit, metadata),
    comparison,
  });
}

function normalizeUnit(unit: string | null): string | null {
  return unit?.trim().toLocaleLowerCase('pt-BR') || null;
}

export function areComparisonValuesSemanticallyEqual(
  left: VehicleComparisonValue,
  right: VehicleComparisonValue,
): boolean {
  if (left.type !== right.type) return false;

  if (left.type === 'numeric' && right.type === 'numeric') {
    return left.value === right.value && normalizeUnit(left.unit) === normalizeUnit(right.unit);
  }

  if (left.type !== 'numeric' && right.type !== 'numeric') {
    return left.present === true ? right.present === true : right.present !== true;
  }

  return false;
}

function rowHasDifference(values: readonly VehicleComparisonValue[]): boolean {
  const reference = values[0];
  if (!reference) return false;
  return values.slice(1).some((value) => !areComparisonValuesSemanticallyEqual(reference, value));
}

export function toComparisonPageData(result: ComparisonResult): ComparisonPageViewModel {
  const vehicles = result.vehicles.map((vehicle) =>
    Object.freeze({
      id: String(vehicle.id),
      brand: vehicle.brand,
      model: vehicle.model,
      version: vehicle.version,
      modelYear: vehicle.modelYear,
      productionYear: vehicle.productionYear,
    }),
  );

  const categories = result.categories.map((category) =>
    Object.freeze({
      name: category.category,
      rows: category.rows.map((row) => {
        const rawValues = result.vehicles.map((vehicle) => {
          const value = row.valuesByVehicle[String(vehicle.id)];
          if (!value) throw new Error('Resultado de comparação incompleto.');
          return value;
        });
        const values = rawValues.map((value, index) => {
          const vehicle = result.vehicles[index];
          if (!vehicle) throw new Error('Resultado de comparação incompleto.');
          const comparison = row.comparisonByVehicle[String(vehicle.id)];
          if (!comparison) throw new Error('Resultado de comparação incompleto.');
          return toComparisonCell(value, comparison, {
            code: String(row.item.code),
            label: row.item.label,
            specSet: row.item.specSet,
          });
        });

        return Object.freeze({
          code: String(row.item.code),
          label: row.item.label,
          equipmentGroup: row.item.equipmentGroup,
          specSet: row.item.specSet,
          hasReferenceAdvantage: row.hasReferenceAdvantage,
          hasDifference: rowHasDifference(rawValues),
          hasAnyAdvantage:
            row.hasReferenceAdvantage ||
            values.some((value) => value.comparison === 'disadvantage'),
          values,
        });
      }),
    }),
  );

  return Object.freeze({ vehicles, categories });
}
