import type { ComparisonItem } from './comparison-item';
import type { Vehicle } from './vehicle';
import type { ComparisonItemCode } from '../value-objects/comparison-item-code';
import type { ComparisonItemType } from '../value-objects/comparison-item-type';
import type { VehicleId } from '../value-objects/vehicle-id';

export interface PresenceComparisonValue {
  readonly vehicleId: VehicleId;
  readonly itemCode: ComparisonItemCode;
  readonly type: Exclude<ComparisonItemType, 'numeric'>;
  readonly present: boolean;
}

export interface NumericComparisonValue {
  readonly vehicleId: VehicleId;
  readonly itemCode: ComparisonItemCode;
  readonly type: 'numeric';
  readonly value: number | null;
  readonly unit: string | null;
}

export type VehicleComparisonValue = PresenceComparisonValue | NumericComparisonValue;
export type ComparisonValue = VehicleComparisonValue;

export interface VehicleComparisonData {
  readonly vehicles: readonly Vehicle[];
  readonly items: readonly ComparisonItem[];
  readonly values: readonly VehicleComparisonValue[];
}

export interface ComparisonRow {
  readonly item: ComparisonItem;
  readonly valuesByVehicle: Readonly<Record<string, VehicleComparisonValue>>;
  readonly isDifferent: boolean;
}

export interface ComparisonCategory {
  readonly category: string;
  readonly rows: readonly ComparisonRow[];
}

export interface ComparisonResult {
  readonly vehicles: readonly Vehicle[];
  readonly categories: readonly ComparisonCategory[];
}
