import type { ComparisonCellDto, ComparisonOutcome } from '@compra-car/contracts';

export const COMPARISON_CELL_GRID_CLASS =
  'grid min-h-7 grid-cols-[minmax(0,1fr)_1.25rem] items-center gap-1.5';

export const COMPARISON_CHECK_SLOT_CLASS = 'grid w-5 shrink-0 place-items-center justify-self-end';

export interface ComparisonValuePresentation {
  readonly displayValue: string | null;
  readonly showPresenceDot: boolean;
  readonly showAdvantageCheck: boolean;
}

export function shouldShowAdvantageCheck(
  vehicleIndex: number,
  hasReferenceAdvantage: boolean,
  comparison: ComparisonOutcome,
): boolean {
  return vehicleIndex === 0 ? hasReferenceAdvantage : comparison === 'disadvantage';
}

export function getComparisonValuePresentation(
  value: ComparisonCellDto,
  isAdvantage: boolean,
): ComparisonValuePresentation {
  const showPresenceDot = value.type === 'binary' && value.displayValue === 'Sim';

  return Object.freeze({
    displayValue: showPresenceDot ? null : value.displayValue,
    showPresenceDot,
    showAdvantageCheck: isAdvantage,
  });
}
