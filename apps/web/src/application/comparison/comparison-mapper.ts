import type {
  ComparisonCellDto,
  ComparisonOutcome,
  ComparisonResult,
  ComparisonRow,
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

function rowOrder(row: ComparisonRow): number {
  return row.item.sortOrder ?? Number.MAX_SAFE_INTEGER;
}

function compareRows(
  left: { readonly order: number; readonly row: { readonly label: string } },
  right: { readonly order: number; readonly row: { readonly label: string } },
): number {
  return left.order - right.order || left.row.label.localeCompare(right.row.label, 'pt-BR');
}

function scaleGroupKey(row: ComparisonRow): string {
  return [
    row.item.category,
    row.item.equipmentGroup,
    row.item.specSet,
    row.item.label,
    String(row.item.sortOrder ?? ''),
  ].join('\u0000');
}

function standardPresentationRow(row: ComparisonRow, result: ComparisonResult) {
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

  return {
    order: rowOrder(row),
    row: Object.freeze({
      code: String(row.item.code),
      label: row.item.label,
      equipmentGroup: row.item.equipmentGroup,
      specSet: row.item.specSet,
      hasReferenceAdvantage: row.hasReferenceAdvantage,
      hasDifference: rowHasDifference(rawValues),
      values,
    }),
  };
}

function scalePresentationRow(rows: readonly ComparisonRow[], result: ComparisonResult) {
  const members = [...rows].sort((left, right) =>
    String(left.item.code).localeCompare(String(right.item.code)),
  );
  const first = members[0];
  if (!first) throw new Error('Grupo scale vazio.');

  const selectedCodes: Array<string | null> = [];
  const values = result.vehicles.map((vehicle) => {
    const selected = members.filter((row) => {
      const value = row.valuesByVehicle[String(vehicle.id)];
      return value?.type === 'scale' && value.present === true;
    });
    if (selected.length > 1) {
      throw new Error(
        `Resultado de comparação inválido: múltiplas alternativas scale em ${first.item.specSet}.`,
      );
    }

    const selectedRow = selected[0] ?? null;
    selectedCodes.push(selectedRow ? String(selectedRow.item.code) : null);
    return Object.freeze({
      type: 'scale' as const,
      displayValue: selectedRow ? (selectedRow.item.optionLabel ?? selectedRow.item.label) : '—',
      comparison: 'not-applicable' as const,
    });
  });

  const referenceCode = selectedCodes[0] ?? null;
  const hasDifference = selectedCodes.slice(1).some((code) => code !== referenceCode);

  return {
    order: Math.min(...members.map(rowOrder)),
    row: Object.freeze({
      code: `scale:${members.map((row) => String(row.item.code)).join('+')}`,
      label: first.item.label,
      equipmentGroup: first.item.equipmentGroup,
      specSet: first.item.specSet,
      hasReferenceAdvantage: false,
      hasDifference,
      values,
    }),
  };
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

  const categories = result.categories
    .map((category) => {
      const scaleGroups = new Map<string, ComparisonRow[]>();
      const presented = category.rows.flatMap((row) => {
        if (row.item.type !== 'scale') return [standardPresentationRow(row, result)];
        const key = scaleGroupKey(row);
        const group = scaleGroups.get(key) ?? [];
        group.push(row);
        scaleGroups.set(key, group);
        return [];
      });

      for (const rows of scaleGroups.values()) presented.push(scalePresentationRow(rows, result));
      presented.sort(compareRows);

      return {
        order: presented[0]?.order ?? Number.MAX_SAFE_INTEGER,
        category: Object.freeze({
          name: category.category,
          rows: presented.map((entry) => entry.row),
        }),
      };
    })
    .filter((entry) => entry.category.rows.length > 0)
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.category.name.localeCompare(right.category.name, 'pt-BR'),
    )
    .map((entry) => entry.category);

  return Object.freeze({ vehicles, categories });
}
