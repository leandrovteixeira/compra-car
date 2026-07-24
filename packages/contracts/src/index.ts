import type {
  AdministrativeVehicleFieldErrors,
  AvailableVehicleFilters,
  ComparisonItem,
  ComparisonOutcome,
  ComparisonResult,
  Vehicle,
  VehicleComparisonValue,
} from '@compra-car/core';

export type {
  AdministrativeVehicle,
  AdministrativeVehicleField,
  AdministrativeVehicleFieldErrors,
  AdministrativeVehicleFilters,
  AdministrativeVehicleInput,
  AvailableVehicleFilters,
  ComparisonCategory,
  ComparisonItem,
  ComparisonItemCode,
  ComparisonItemType,
  ComparisonOutcome,
  ComparisonRepository,
  ComparisonResult,
  ComparisonRow,
  ComparisonValue,
  Vehicle,
  VehicleComparisonData,
  VehicleComparisonValue,
  VehicleDisplayName,
  VehicleId,
  VehicleRepository,
} from '@compra-car/core';

export interface AdministrativeVehicleFormValuesDto {
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly isActive: boolean;
  readonly isPublic: boolean;
}

export type AdministrativeVehicleActionStateDto =
  | {
      readonly status: 'idle';
      readonly values: AdministrativeVehicleFormValuesDto;
      readonly fieldErrors: AdministrativeVehicleFieldErrors;
    }
  | {
      readonly status: 'error';
      readonly values: AdministrativeVehicleFormValuesDto;
      readonly fieldErrors: AdministrativeVehicleFieldErrors;
      readonly message?: string;
    }
  | {
      readonly status: 'success';
      readonly id: string;
      readonly values: AdministrativeVehicleFormValuesDto;
      readonly fieldErrors: AdministrativeVehicleFieldErrors;
      readonly message?: string;
    };

export type CreateAdministrativeVehicleActionStateDto = AdministrativeVehicleActionStateDto;
export type UpdateAdministrativeVehicleActionStateDto = AdministrativeVehicleActionStateDto;

export type VehicleDto = Vehicle;
export type ComparisonItemDto = ComparisonItem;
export type VehicleComparisonValueDto = VehicleComparisonValue;

export type ListAvailableBrandsResponse = readonly string[];

export interface ListAvailableModelsRequest {
  readonly brand: string;
}

export type ListAvailableModelsResponse = readonly string[];

export type ListAvailableVehiclesRequest = AvailableVehicleFilters;
export type ListAvailableVehiclesResponse = readonly VehicleDto[];

export interface GetVehiclesByIdsRequest {
  readonly vehicleIds: readonly string[];
}

export type GetVehiclesByIdsResponse = readonly VehicleDto[];

export interface CompareVehiclesRequest {
  readonly vehicleIds: readonly string[];
}

export type CompareVehiclesResponse = ComparisonResult;

export interface CatalogOptionDto {
  readonly value: string;
  readonly label: string;
}

export interface CatalogVehicleDto {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
  readonly displayName: string;
}

export type CatalogActionErrorCode = 'INVALID_INPUT' | 'CATALOG_UNAVAILABLE';

export interface CatalogActionErrorDto {
  readonly code: CatalogActionErrorCode;
  readonly message: string;
}

export type CatalogActionResultDto<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: CatalogActionErrorDto };

export const APP_ROLES = ['seller', 'admin'] as const;
export const USER_STATUSES = ['pending', 'active', 'disabled'] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

export interface AuthProfile {
  readonly id: string;
  readonly fullName: string | null;
  readonly role: AppRole;
  readonly status: UserStatus;
}

export interface ComparisonVehiclePresentationDto {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly version: string;
  readonly modelYear: string;
  readonly productionYear: string;
}

export interface ComparisonCellDto {
  readonly type: 'binary' | 'numeric' | 'scale';
  readonly displayValue: string;
  readonly comparison: ComparisonOutcome;
}

export interface ComparisonRowPresentationDto {
  readonly code: string;
  readonly label: string;
  readonly equipmentGroup: string;
  readonly specSet: string;
  readonly hasReferenceAdvantage: boolean;
  readonly values: readonly ComparisonCellDto[];
}

export interface ComparisonCategoryPresentationDto {
  readonly name: string;
  readonly rows: readonly ComparisonRowPresentationDto[];
}

export interface ComparisonPageDataDto {
  readonly vehicles: readonly ComparisonVehiclePresentationDto[];
  readonly categories: readonly ComparisonCategoryPresentationDto[];
}

export type ComparisonPageErrorCode =
  | 'MISSING_VEHICLES'
  | 'TOO_FEW_VEHICLES'
  | 'DUPLICATE_VEHICLES'
  | 'INVALID_VEHICLE_IDS'
  | 'VEHICLES_UNAVAILABLE'
  | 'COMPARISON_UNAVAILABLE';

export interface ComparisonPageErrorDto {
  readonly code: ComparisonPageErrorCode;
  readonly message: string;
}

export type ComparisonPageResultDto =
  | { readonly ok: true; readonly data: ComparisonPageDataDto }
  | { readonly ok: false; readonly error: ComparisonPageErrorDto };
