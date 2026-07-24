const MINIMUM_VEHICLE_YEAR = 2001;

export function createModelYearOptions(currentYear: number): readonly number[] {
  const maximumYear = currentYear + 2;
  return Array.from(
    { length: maximumYear - MINIMUM_VEHICLE_YEAR + 1 },
    (_, index) => maximumYear - index,
  );
}

export function createProductionYearOptions(modelYear: string): readonly number[] {
  const parsed = Number(modelYear);
  if (!Number.isInteger(parsed) || parsed <= MINIMUM_VEHICLE_YEAR - 1) return [];
  return [parsed, parsed - 1];
}

export function productionYearAfterModelYearChange(
  modelYear: string,
  currentProductionYear: string,
): string {
  return createProductionYearOptions(modelYear).includes(Number(currentProductionYear))
    ? currentProductionYear
    : '';
}
