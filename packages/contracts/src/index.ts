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
  ProductPublicPriceSort,
  SortDirection,
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

export interface ImportBatchListItemDto {
  readonly id: string;
  readonly title: string;
  readonly pluginKey: 'commercial_letters';
  readonly competence: string;
  readonly status: string;
  readonly documentCount: number;
  readonly mmvCount: number;
  readonly createdByName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lockVersion: number;
}

export interface ImportDocumentDto {
  readonly id: string;
  readonly originalFileName: string;
  readonly fileSizeBytes: number;
  readonly contentSha256: string;
  readonly pageCount: number | null;
  readonly status: string;
  readonly sourceOrder: number;
  readonly documentRole: string;
  readonly lockVersion: number;
}

export interface ImportBatchDetailsDto extends ImportBatchListItemDto {
  readonly notes: string | null;
  readonly documents: readonly ImportDocumentDto[];
}

export interface ImportDuplicateDto {
  readonly contentSha256: string;
  readonly originalFileName: string;
  readonly batchId: string;
  readonly batchTitle: string;
  readonly batchStatus: string;
  readonly createdAt: string;
}

export interface ImportBatchFormValuesDto {
  readonly title: string;
  readonly competence: string;
  readonly notes: string;
  readonly idempotencyKey: string;
  readonly acknowledgeDuplicates: boolean;
}

export type ImportBatchActionStateDto =
  | {
      readonly status: 'idle';
      readonly values: ImportBatchFormValuesDto;
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly duplicates: readonly ImportDuplicateDto[];
    }
  | {
      readonly status: 'error' | 'duplicate';
      readonly values: ImportBatchFormValuesDto;
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly duplicates: readonly ImportDuplicateDto[];
      readonly message: string;
      readonly correlationId?: string;
    }
  | {
      readonly status: 'success';
      readonly values: ImportBatchFormValuesDto;
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly duplicates: readonly ImportDuplicateDto[];
      readonly message: string;
      readonly batchId: string;
    };

export interface ImportDocumentsFormValuesDto {
  readonly batchId: string;
  readonly expectedLockVersion: string;
  readonly operationId: string;
  readonly acknowledgeDuplicates: boolean;
}

export type ImportDocumentsActionStateDto =
  | {
      readonly status: 'idle';
      readonly values: ImportDocumentsFormValuesDto;
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly duplicates: readonly ImportDuplicateDto[];
    }
  | {
      readonly status: 'error' | 'duplicate';
      readonly values: ImportDocumentsFormValuesDto;
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly duplicates: readonly ImportDuplicateDto[];
      readonly message: string;
      readonly correlationId?: string;
    }
  | {
      readonly status: 'success';
      readonly values: ImportDocumentsFormValuesDto;
      readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
      readonly duplicates: readonly ImportDuplicateDto[];
      readonly message: string;
      readonly batchId: string;
    };

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
  readonly sort: ProductPublicPriceSort;
  readonly direction: SortDirection;
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
  readonly sourcePolicyId: string;
  readonly productId: string;
  readonly policyType: string;
  readonly title: string;
  readonly description: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly amount: string;
  readonly rebateAmount: string;
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
  readonly expectedPredecessorId: string;
  readonly expectedPredecessorLockVersion: string;
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
  readonly validTo: string | null;
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
  readonly dealerRebateAmount?: string | null;
  readonly status: PricingWorkflowStatus;
  readonly lockVersion: number;
  readonly fixedAmount?: string | null;
  readonly annualRate?: string | null;
  readonly coverageYears?: string | null;
  readonly remainingMonths?: number | null;
  readonly offerMonth?: number | null;
  readonly financedPrincipal?: string | null;
  readonly downPaymentPercentage?: string | null;
  readonly termMonths?: number | null;
  readonly customerInterestRateMonthly?: string | null;
  readonly voucherType?: string | null;
  readonly policyParameters?: Readonly<Record<string, unknown>>;
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
  readonly validTo: string | null;
  readonly status: 'draft' | 'published' | 'archived';
  readonly policyCount: number;
  readonly benefitAmount: string;
  readonly transactionalPrice: string;
  readonly policyIds: readonly string[];
  readonly lockVersion: number;
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
  readonly referenceDate?: string;
  readonly periodEnd?: string;
  readonly periodKind?: 'monthly' | 'special';
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
