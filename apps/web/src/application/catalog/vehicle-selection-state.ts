import type { CatalogVehicleDto } from '@compra-car/contracts';

import { matchesVehicleSearch } from './vehicle-search';

export const MAX_SELECTED_VEHICLES = 4;

export interface VehicleSelectionState {
  readonly selectedVehicles: readonly CatalogVehicleDto[];
}

export const EMPTY_VEHICLE_SELECTION: VehicleSelectionState = Object.freeze({
  selectedVehicles: [],
});

export function canAddSelectedVehicle(
  state: VehicleSelectionState,
  vehicle: CatalogVehicleDto,
): boolean {
  return (
    state.selectedVehicles.length < MAX_SELECTED_VEHICLES &&
    !state.selectedVehicles.some((selected) => selected.id === vehicle.id)
  );
}

export function addSelectedVehicle(
  state: VehicleSelectionState,
  vehicle: CatalogVehicleDto,
): VehicleSelectionState {
  if (!canAddSelectedVehicle(state, vehicle)) return state;

  return {
    selectedVehicles: [...state.selectedVehicles, vehicle],
  };
}

export function removeSelectedVehicle(
  state: VehicleSelectionState,
  vehicleId: string,
): VehicleSelectionState {
  return {
    selectedVehicles: state.selectedVehicles.filter((vehicle) => vehicle.id !== vehicleId),
  };
}

export function findAvailableVehicles(
  vehicles: readonly CatalogVehicleDto[],
  query: string,
  selectedVehicles: readonly CatalogVehicleDto[],
): readonly CatalogVehicleDto[] {
  if (!query.trim()) return [];
  const selectedIds = new Set(selectedVehicles.map((vehicle) => vehicle.id));

  return vehicles.filter(
    (vehicle) =>
      !selectedIds.has(vehicle.id) &&
      matchesVehicleSearch([vehicle.brand, vehicle.model, vehicle.version].join(' '), query),
  );
}
