const MINIMUM_VEHICLE_YEAR = 2001;

export function createProductionYearOptions(currentYear: number): readonly number[] {
  const maximumYear = currentYear + 2;
  return Array.from(
    { length: maximumYear - MINIMUM_VEHICLE_YEAR + 1 },
    (_, index) => maximumYear - index,
  );
}

export function createModelYearOptions(
  productionYear: string,
  currentYear: number,
): readonly number[] {
  const parsed = Number(productionYear);
  const maximumYear = currentYear + 2;
  if (!Number.isInteger(parsed) || parsed < MINIMUM_VEHICLE_YEAR || parsed > maximumYear) return [];
  return [parsed + 1, parsed].filter((year) => year <= maximumYear);
}

export function modelYearAfterProductionYearChange(
  productionYear: string,
  currentModelYear: string,
  currentYear: number,
): string {
  return createModelYearOptions(productionYear, currentYear).includes(Number(currentModelYear))
    ? currentModelYear
    : '';
}
