import type { CatalogVehicleDto } from '@compra-car/contracts';

export interface VehicleSelectionState {
  readonly brand: string;
  readonly model: string;
  readonly vehicleId: string;
  readonly selectedVehicles: readonly CatalogVehicleDto[];
}

export const EMPTY_VEHICLE_SELECTION: VehicleSelectionState = Object.freeze({
  brand: '',
  model: '',
  vehicleId: '',
  selectedVehicles: [],
});

export function changeSelectedBrand(
  state: VehicleSelectionState,
  brand: string,
): VehicleSelectionState {
  return { ...state, brand, model: '', vehicleId: '' };
}

export function changeSelectedModel(
  state: VehicleSelectionState,
  model: string,
): VehicleSelectionState {
  return { ...state, model, vehicleId: '' };
}

export function changeSelectedVersion(
  state: VehicleSelectionState,
  vehicleId: string,
): VehicleSelectionState {
  return { ...state, vehicleId };
}

export function canAddSelectedVehicle(
  state: VehicleSelectionState,
  availableVehicles: readonly CatalogVehicleDto[],
): boolean {
  if (!state.vehicleId || state.selectedVehicles.length >= 3) return false;

  return (
    availableVehicles.some((vehicle) => vehicle.id === state.vehicleId) &&
    !state.selectedVehicles.some((vehicle) => vehicle.id === state.vehicleId)
  );
}

export function addSelectedVehicle(
  state: VehicleSelectionState,
  availableVehicles: readonly CatalogVehicleDto[],
): VehicleSelectionState {
  if (!canAddSelectedVehicle(state, availableVehicles)) return state;

  const vehicle = availableVehicles.find((candidate) => candidate.id === state.vehicleId);
  if (!vehicle) return state;

  return {
    brand: '',
    model: '',
    vehicleId: '',
    selectedVehicles: [...state.selectedVehicles, vehicle],
  };
}
