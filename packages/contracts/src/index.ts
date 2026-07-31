import type {
  AdministrativeVehicleFieldErrors,
  AvailableVehicleFilters,
  ComparisonItem,
  ComparisonOutcome,
  ComparisonResult,
  Vehicle,
  VehicleComparisonValue,
  ProductPublicPriceMoney,
  ProductPublicPriceProduct,
  PricingWorkflowStatus,
  CommercialPolicyType,
} from '@compra-car/core';

export {
  COMMERCIAL_POLICY_TYPES,
  CURRENT_COMMERCIAL_POLICY_TYPES,
  DEALER_REBATE_ELIGIBLE_POLICY_TYPES,
  DEPRECATED_COMMERCIAL_POLICY_TYPES,
  DEPRECATED_POLICY_CALCULATION_METHODS,
  POLICY_CALCULATION_METHODS,
  PRICING_VOUCHER_TYPES,
} from './pricing';
export type {
  CommercialPolicyInput,
  CommercialPolicyType,
  PolicyCalculationMethod,
  PricingVoucherType,
} from './pricing';

export type {
  AdministrativeVehicle,
  AdministrativeVehicleField,
  AdministrativeVehicleFieldErrors,
  AdministrativeVehicleFilters,
  AdministrativeVehicleInput,
  AdministrativeProductSpecsModel,
  AdministrativeSpecField,
  AdministrativeSpecSubmission,
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
  ProductPublicPrice,
  CommercialPolicy,
  CommercialOffer,
  CommercialOfferPolicyMembership,
  CommercialPricingRepository,
  ProductPublicPriceMoney,
  ProductPublicPricePage,
  ProductPublicPriceProduct,
  ProductPublicPriceRepository,
  PricingWorkflowStatus,
  ListProductPublicPricesInput,
  ListProductPublicPricesResult,
  ProductPublicPriceWriteFieldErrors,
  ProductPublicPriceWriteInput,
  UpdateProductPublicPriceInput,
  CreateManualPriceBatchInput,
  ManualPriceBatchRepository,
  ManualPriceBatchResult,
  ManualPriceBatchRowInput,
  ManualPriceBatchValidationIssue,
  ManualPriceBatchProductOption,
} from '@compra-car/core';

export interface ProductPublicPriceListItemDto {
  readonly id: string;
  readonly product: ProductPublicPriceProduct;
  readonly money: ProductPublicPriceMoney;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly status: PricingWorkflowStatus;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lockVersion: number;
}

export interface ProductPublicPriceListPageDto {
  readonly items: readonly ProductPublicPriceListItemDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly total: number;
}

export interface ProductPublicPriceFormValuesDto {
  readonly id: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly lockVersion: string;
}

export type ProductPublicPriceFieldErrorsDto = Partial<
  Readonly<
    Record<'productId' | 'amount' | 'startsOn' | 'endsOn' | 'lockVersion', readonly string[]>
  >
>;

export type ProductPublicPriceActionStateDto =
  | {
      readonly status: 'idle';
      readonly values: ProductPublicPriceFormValuesDto;
      readonly fieldErrors: ProductPublicPriceFieldErrorsDto;
    }
  | {
      readonly status: 'error' | 'conflict';
      readonly values: ProductPublicPriceFormValuesDto;
      readonly fieldErrors: ProductPublicPriceFieldErrorsDto;
      readonly message: string;
    }
  | {
      readonly status: 'success';
      readonly values: ProductPublicPriceFormValuesDto;
      readonly fieldErrors: ProductPublicPriceFieldErrorsDto;
      readonly message: string;
    };

export interface ProductPublicPriceProductOptionDto {
  readonly id: string;
  readonly label: string;
}

export interface ManualPriceBatchGridRowDto {
  readonly clientRowId: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

export type ManualPriceBatchRowFieldErrorsDto = Partial<
  Readonly<Record<'productId' | 'amount' | 'startsOn' | 'endsOn' | 'row', readonly string[]>>
>;

export type ManualPriceBatchActionStateDto =
  | {
      readonly status: 'idle';
      readonly rows: readonly ManualPriceBatchGridRowDto[];
      readonly rowErrors: Readonly<Record<string, ManualPriceBatchRowFieldErrorsDto>>;
    }
  | {
      readonly status: 'error' | 'conflict';
      readonly rows: readonly ManualPriceBatchGridRowDto[];
      readonly rowErrors: Readonly<Record<string, ManualPriceBatchRowFieldErrorsDto>>;
      readonly message: string;
    }
  | {
      readonly status: 'success';
      readonly rows: readonly ManualPriceBatchGridRowDto[];
      readonly rowErrors: Readonly<Record<string, ManualPriceBatchRowFieldErrorsDto>>;
      readonly message: string;
      readonly batchId: string;
      readonly createdCount: number;
    };

export interface ManualPriceBatchProductOptionDto {
  readonly id: string;
  readonly displayName: string;
  readonly isActive: boolean;
  readonly isPublic: boolean;
}

export interface ManualPolicyBatchGridRowDto {
  readonly clientRowId: string;
  readonly productId: string;
  readonly policyType: string;
  readonly title: string;
  readonly description: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly amount: string;
  readonly maintenanceCount: string;
  readonly coverageMonths: string;
  readonly coverageKm: string;
  readonly voucherType: string;
  readonly calculationBasePriceId: string;
  readonly annualRate: string;
  readonly offerMonth: string;
  readonly coverageYears: string;
  readonly termMonths: string;
  readonly customerInterestRateMonthly: string;
  readonly downPaymentPercentage: string;
}
export interface ManualPolicyBasePriceDto {
  readonly id: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}
export interface ManualPolicyFinancialReferenceDto {
  readonly id: string;
  readonly label: string;
  readonly effectiveFrom: string;
  readonly validTo: string | null;
  readonly monthlyReferenceRate: string;
}
export type ManualPolicyBatchActionStateDto =
  | {
      readonly status: 'idle';
      readonly rows: readonly ManualPolicyBatchGridRowDto[];
      readonly rowErrors: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
    }
  | {
      readonly status: 'error';
      readonly rows: readonly ManualPolicyBatchGridRowDto[];
      readonly rowErrors: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
      readonly message: string;
    }
  | {
      readonly status: 'success';
      readonly rows: readonly ManualPolicyBatchGridRowDto[];
      readonly rowErrors: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
      readonly message: string;
      readonly batchId: string;
      readonly createdCount: number;
    };

export interface OfferBuilderFormDto {
  readonly productId: string;
  readonly publicPriceId: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly policyIds: readonly string[];
}
export interface OfferBuilderPolicyDto {
  readonly id: string;
  readonly productId: string;
  readonly policyType: CommercialPolicyType;
  readonly title: string;
  readonly description: string | null;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly customerBenefitAmount: string | null;
  readonly status: PricingWorkflowStatus;
}
export interface OfferBuilderPriceDto {
  readonly id: string;
  readonly productId: string;
  readonly amount: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}
export interface OfferBuilderDraftDto {
  readonly id: string;
  readonly productId: string;
  readonly publicPriceAmount: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly status: 'draft';
  readonly policyCount: number;
  readonly benefitAmount: string;
  readonly transactionalPrice: string;
}
export type OfferBuilderActionStateDto =
  | {
      readonly status: 'idle';
      readonly rows: readonly PolicyCombinationGridRowDto[];
      readonly rowErrors: Readonly<Record<string, readonly string[]>>;
    }
  | {
      readonly status: 'error';
      readonly rows: readonly PolicyCombinationGridRowDto[];
      readonly rowErrors: Readonly<Record<string, readonly string[]>>;
      readonly message: string;
    }
  | {
      readonly status: 'success';
      readonly rows: readonly PolicyCombinationGridRowDto[];
      readonly rowErrors: Readonly<Record<string, readonly string[]>>;
      readonly message: string;
      readonly createdCount: number;
    };

export interface PolicyCombinationGridRowDto {
  readonly clientRowId: string;
  readonly productId: string;
  readonly policyIds: readonly string[];
}

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
