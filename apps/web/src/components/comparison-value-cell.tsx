import type { ComparisonCellDto } from '@compra-car/contracts';

import {
  COMPARISON_CELL_GRID_CLASS,
  COMPARISON_CHECK_SLOT_CLASS,
  getComparisonValuePresentation,
} from '@/application/comparison/comparison-value-presentation';

interface ComparisonValueCellProps {
  readonly value: ComparisonCellDto;
  readonly isAdvantage: boolean;
}

function AdvantageCheck() {
  return (
    <span
      aria-label="Vantagem"
      className="grid size-4 place-items-center text-attention"
      data-advantage-marker="true"
      role="img"
      title="Vantagem"
    >
      <img src="/carboot/check_bold.svg" alt="" aria-hidden="true" className="size-4 object-contain" />
    </span>
  );
}

export function ComparisonValueCell({ value, isAdvantage }: ComparisonValueCellProps) {
  const presentation = getComparisonValuePresentation(value, isAdvantage);

  return (
    <div className={COMPARISON_CELL_GRID_CLASS}>
      <span className="min-w-0 justify-self-center truncate text-center">
        {presentation.showPresenceDot ? (
          <img src="/carboot/spec_available.svg" className="size-4 object-contain" alt="Disponível" title="Disponível" data-presence-value="true" />
        ) : (
          presentation.displayValue
        )}
      </span>
      <span className={COMPARISON_CHECK_SLOT_CLASS} data-comparison-check-slot="true">
        {presentation.showAdvantageCheck ? <AdvantageCheck /> : null}
      </span>
    </div>
  );
}
