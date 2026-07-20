import type {
  ComparisonCellDto,
  ComparisonOutcome,
  ComparisonPageDataDto,
  ComparisonResult,
  VehicleComparisonValue,
} from '@compra-car/contracts';

import {
  formatComparisonNumber,
  type ComparisonNumberMetadata,
} from './comparison-number-formatter';

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

export function toComparisonPageData(result: ComparisonResult): ComparisonPageDataDto {
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
      rows: category.rows.map((row) =>
        Object.freeze({
          code: String(row.item.code),
          label: row.item.label,
          equipmentGroup: row.item.equipmentGroup,
          specSet: row.item.specSet,
          hasReferenceAdvantage: row.hasReferenceAdvantage,
          values: result.vehicles.map((vehicle) => {
            const value = row.valuesByVehicle[String(vehicle.id)];
            if (!value) throw new Error('Resultado de comparação incompleto.');
            const comparison = row.comparisonByVehicle[String(vehicle.id)];
            if (!comparison) throw new Error('Resultado de comparação incompleto.');
            return toComparisonCell(value, comparison, {
              code: String(row.item.code),
              label: row.item.label,
              specSet: row.item.specSet,
            });
          }),
        }),
      ),
    }),
  );

  return Object.freeze({ vehicles, categories });
}
