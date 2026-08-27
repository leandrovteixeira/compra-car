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
      <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 12 12">
        <path
          d="m2.5 6.2 2.1 2.1 4.9-4.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.25"
        />
      </svg>
    </span>
  );
}

export function ComparisonValueCell({ value, isAdvantage }: ComparisonValueCellProps) {
  const presentation = getComparisonValuePresentation(value, isAdvantage);

  return (
    <div className={COMPARISON_CELL_GRID_CLASS}>
      <span className="min-w-0 justify-self-center truncate text-center">
        {presentation.showPresenceDot ? (
          <span
            aria-label="Presente"
            className="block size-2 rounded-full bg-text-primary"
            data-presence-value="true"
            role="img"
            title="Presente"
          />
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
