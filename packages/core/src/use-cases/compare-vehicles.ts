import type { ComparisonItem } from '../entities/comparison-item';
import type {
  ComparisonCategory,
  ComparisonOutcome,
  ComparisonResult,
  ComparisonRow,
  VehicleComparisonData,
  VehicleComparisonValue,
} from '../entities/comparison';
import {
  ComparisonVehicleCountError,
  DuplicateComparisonItemCodeError,
  DuplicateVehicleSelectionError,
  InvalidComparisonDataError,
  VehicleNotEligibleError,
  VehicleNotFoundError,
} from '../errors/domain-errors';
import type { ComparisonRepository } from '../repositories/comparison-repository';
import type { VehicleRepository } from '../repositories/vehicle-repository';
import type { ComparisonItemCode } from '../value-objects/comparison-item-code';
import { createVehicleId, type VehicleId } from '../value-objects/vehicle-id';

export interface CompareVehiclesInput {
  readonly vehicleIds: readonly string[];
}

function comparisonValueKey(vehicleId: VehicleId, itemCode: ComparisonItemCode): string {
  return `${vehicleId}\u0000${itemCode}`;
}

function assertUniqueItems(items: readonly ComparisonItem[]): void {
  const itemCodes = new Set<ComparisonItemCode>();

  for (const item of items) {
    if (itemCodes.has(item.code)) {
      throw new DuplicateComparisonItemCodeError(item.code);
    }
    itemCodes.add(item.code);
  }
}

function assertValueMatchesItem(value: VehicleComparisonValue, item: ComparisonItem): void {
  if (value.type !== item.type) {
    throw new InvalidComparisonDataError(
      `O valor de ${item.code} usa o tipo ${value.type}, mas o item usa ${item.type}.`,
    );
  }

  if (value.type === 'numeric' && value.value !== null && !Number.isFinite(value.value)) {
    throw new InvalidComparisonDataError(
      `O valor numeric de ${item.code} deve ser finito ou null.`,
    );
  }
}

function missingValue(vehicleId: VehicleId, item: ComparisonItem): VehicleComparisonValue {
  if (item.type === 'numeric') {
    return Object.freeze({
      vehicleId,
      itemCode: item.code,
      type: 'numeric',
      value: null,
      unit: item.unit,
    });
  }

  return Object.freeze({
    vehicleId,
    itemCode: item.code,
    type: item.type,
    present: null,
  });
}

function compareWithReference(
  item: ComparisonItem,
  reference: VehicleComparisonValue,
  competitor: VehicleComparisonValue,
): ComparisonOutcome {
  if (item.type === 'scale') return 'not-applicable';

  if (reference.type === 'binary' && competitor.type === 'binary') {
    if (reference.present === null || competitor.present === null) return 'unknown';
    if (reference.present === competitor.present) return 'tie';
    return reference.present ? 'advantage' : 'disadvantage';
  }

  if (reference.type === 'numeric' && competitor.type === 'numeric') {
    if (reference.value === null || competitor.value === null) return 'unknown';
    if (reference.value === competitor.value) return 'tie';

    const referenceIsGreater = reference.value > competitor.value;
    const referenceWins =
      item.valueDirection === 'positive' ? referenceIsGreater : !referenceIsGreater;
    return referenceWins ? 'advantage' : 'disadvantage';
  }

  throw new InvalidComparisonDataError(`Não foi possível comparar o item ${item.code}.`);
}

function buildRows(data: VehicleComparisonData): readonly ComparisonRow[] {
  assertUniqueItems(data.items);

  const itemCodes = new Set(data.items.map((item) => item.code));
  const vehicleIds = new Set(data.vehicles.map((vehicle) => vehicle.id));
  const valuesByKey = new Map<string, VehicleComparisonValue>();

  for (const value of data.values) {
    if (!itemCodes.has(value.itemCode) || !vehicleIds.has(value.vehicleId)) {
      throw new InvalidComparisonDataError('O repositório retornou um valor fora da comparação.');
    }

    const key = comparisonValueKey(value.vehicleId, value.itemCode);
    if (valuesByKey.has(key)) {
      throw new InvalidComparisonDataError(
        `O repositório retornou mais de um valor para ${value.vehicleId}/${value.itemCode}.`,
      );
    }
    valuesByKey.set(key, value);
  }

  return data.items.map((item) => {
    const entries = data.vehicles.map((vehicle) => {
      const value = valuesByKey.get(comparisonValueKey(vehicle.id, item.code));
      if (value) {
        assertValueMatchesItem(value, item);
      }
      return [vehicle.id, value ?? missingValue(vehicle.id, item)] as const;
    });
    const valuesByVehicle = Object.freeze(Object.fromEntries(entries));
    const referenceVehicle = data.vehicles[0];
    if (!referenceVehicle) {
      throw new InvalidComparisonDataError('A comparação não possui veículo de referência.');
    }
    const referenceValue = valuesByVehicle[String(referenceVehicle.id)];
    if (!referenceValue) {
      throw new InvalidComparisonDataError('A comparação não possui valor de referência.');
    }

    const comparisonEntries = data.vehicles.map((vehicle, index) => {
      if (index === 0) return [vehicle.id, 'not-applicable'] as const;
      const competitorValue = valuesByVehicle[String(vehicle.id)];
      if (!competitorValue) {
        throw new InvalidComparisonDataError(`Valor ausente para o veículo ${vehicle.id}.`);
      }
      return [vehicle.id, compareWithReference(item, referenceValue, competitorValue)] as const;
    });
    const comparisonByVehicle = Object.freeze(Object.fromEntries(comparisonEntries));
    const hasReferenceAdvantage = Object.values(comparisonByVehicle).some(
      (outcome) => outcome === 'advantage',
    );

    return Object.freeze({
      item,
      valuesByVehicle,
      comparisonByVehicle,
      hasReferenceAdvantage,
    });
  });
}

function groupRowsByCategory(rows: readonly ComparisonRow[]): readonly ComparisonCategory[] {
  const rowsByCategory = new Map<string, ComparisonRow[]>();

  for (const row of rows) {
    const categoryRows = rowsByCategory.get(row.item.category) ?? [];
    categoryRows.push(row);
    rowsByCategory.set(row.item.category, categoryRows);
  }

  return [...rowsByCategory.entries()].map(([category, categoryRows]) =>
    Object.freeze({ category, rows: Object.freeze(categoryRows) }),
  );
}

export class CompareVehicles {
  constructor(
    private readonly vehicleRepository: VehicleRepository,
    private readonly comparisonRepository: ComparisonRepository,
  ) {}

  async execute(input: CompareVehiclesInput): Promise<ComparisonResult> {
    if (input.vehicleIds.length < 2) {
      throw new ComparisonVehicleCountError(input.vehicleIds.length);
    }

    const vehicleIds = input.vehicleIds.map(createVehicleId);
    if (new Set(vehicleIds).size !== vehicleIds.length) {
      throw new DuplicateVehicleSelectionError();
    }

    const [foundVehicles, items, values] = await Promise.all([
      this.vehicleRepository.getVehiclesByIds(vehicleIds),
      this.comparisonRepository.getComparisonItemsByVehicleIds(vehicleIds),
      this.comparisonRepository.getComparisonValuesByVehicleIds(vehicleIds),
    ]);
    const foundById = new Map(foundVehicles.map((vehicle) => [vehicle.id, vehicle]));
    const vehicles = vehicleIds.map((vehicleId) => {
      const vehicle = foundById.get(vehicleId);
      if (!vehicle) {
        throw new VehicleNotFoundError(vehicleId);
      }
      if (!vehicle.isActive || !vehicle.isPublic) {
        throw new VehicleNotEligibleError(vehicleId);
      }
      return vehicle;
    });

    const rows = buildRows({ vehicles, items, values });
    return Object.freeze({
      vehicles: Object.freeze(vehicles),
      categories: Object.freeze(groupRowsByCategory(rows)),
    });
  }
}
