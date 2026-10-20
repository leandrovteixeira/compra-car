import type { CatalogVehicleDto } from '@compra-car/contracts';

import { matchesVehicleSearch } from './vehicle-search';

export const MAX_SELECTED_VEHICLES = 3;

export interface VehicleSelectionState {
  readonly selectedVehicles: readonly CatalogVehicleDto[];
}

export const EMPTY_VEHICLE_SELECTION: VehicleSelectionState = Object.freeze({
  selectedVehicles: [],
});

export function canAddSelectedVehicle(
  state: VehicleSelectionState,
  vehicle: CatalogVehicleDto,
  maxSelectedVehicles = MAX_SELECTED_VEHICLES,
): boolean {
  return (
    state.selectedVehicles.length < maxSelectedVehicles &&
    !state.selectedVehicles.some((selected) => selected.id === vehicle.id)
  );
}

export function addSelectedVehicle(
  state: VehicleSelectionState,
  vehicle: CatalogVehicleDto,
  maxSelectedVehicles = MAX_SELECTED_VEHICLES,
): VehicleSelectionState {
  if (!canAddSelectedVehicle(state, vehicle, maxSelectedVehicles)) return state;

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
