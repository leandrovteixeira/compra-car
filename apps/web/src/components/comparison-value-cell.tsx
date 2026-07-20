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
      className="grid size-4 place-items-center rounded-full bg-emerald-400/90 text-[0.625rem] text-emerald-950 shadow-[0_0_10px_-3px_rgba(74,222,128,0.8)]"
      role="img"
      title="Vantagem"
    >
      <svg aria-hidden="true" className="size-2.5" fill="none" viewBox="0 0 12 12">
        <path
          d="m2.5 6.2 2.1 2.1 4.9-4.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
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
            className="block size-2 rounded-full bg-slate-100 shadow-[0_0_6px_rgba(248,250,252,0.28)]"
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
