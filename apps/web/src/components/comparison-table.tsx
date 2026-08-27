import type { ComparisonVehiclePresentationDto } from '@compra-car/contracts';
import { Fragment } from 'react';

import type {
  ComparisonCategoryViewModel,
  ComparisonMode,
} from '@/application/comparison/comparison-view-model';
import { shouldShowAdvantageCheck } from '@/application/comparison/comparison-value-presentation';
import { ComparisonValueCell } from '@/components/comparison-value-cell';
import { ComparisonVehicleHeader } from '@/components/comparison-vehicle-header';

interface ComparisonTableProps {
  readonly vehicles: readonly ComparisonVehiclePresentationDto[];
  readonly categories: readonly ComparisonCategoryViewModel[];
  readonly mode: ComparisonMode;
}

const emptyCopy: Record<ComparisonMode, { title: string; description: string }> = {
  complete: {
    title: 'Comparação sem equipamentos',
    description: 'Não encontramos itens comparáveis para os veículos selecionados.',
  },
  differences: {
    title: 'Nenhuma diferença encontrada',
    description: 'Os valores comparáveis são semanticamente iguais.',
  },
  advantages: {
    title: 'Nenhuma vantagem objetiva encontrada',
    description: 'O engine atual não determinou uma vantagem nos itens comparáveis.',
  },
};

export function ComparisonTable({ vehicles, categories, mode }: ComparisonTableProps) {
  if (categories.length === 0) {
    return (
      <section
        aria-live="polite"
        className="border-y border-border bg-surface-muted px-3 py-3 text-sm"
      >
        <p className="font-semibold text-text-primary">{emptyCopy[mode].title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{emptyCopy[mode].description}</p>
      </section>
    );
  }

  const rowCount = categories.reduce((total, category) => total + category.rows.length, 0);
  const showAdvantageMarkers = mode !== 'differences';

  return (
    <section aria-label="Tabela de comparação" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-4 px-1 text-xs text-text-muted">
        <p>
          {rowCount} {rowCount === 1 ? 'item comparado' : 'itens comparados'}
        </p>
        <p className="flex items-center gap-1.5 sm:hidden">
          <svg aria-hidden="true" className="size-3.5" fill="none" viewBox="0 0 16 16">
            <path
              d="M2.5 8h11M5 5.5 2.5 8 5 10.5m6-5L13.5 8 11 10.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Deslize para comparar
        </p>
      </div>

      <div className="overflow-hidden border border-border bg-surface">
        <div
          aria-label="Comparação rolável de veículos"
          className="comparison-scroll max-h-[min(72dvh,52rem)] overflow-auto overscroll-contain"
          role="region"
          tabIndex={0}
        >
          <table className="w-max min-w-full table-fixed border-separate border-spacing-0 text-left">
            <caption className="sr-only">
              Comparação de equipamentos e especificações entre os veículos selecionados
            </caption>
            <colgroup>
              <col className="w-[8.25rem] min-[769px]:w-64 lg:w-72" />
              {vehicles.map((vehicle) => (
                <col className="w-[7.5rem] min-[769px]:w-56" key={vehicle.id} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-40">
              <tr>
                <th
                  className="sticky left-0 z-50 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-border bg-surface px-2.5 py-2 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-text-muted shadow-[6px_0_12px_-12px_rgba(26,29,33,0.45)] min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-4 min-[769px]:text-xs lg:w-72 lg:min-w-72 lg:max-w-72"
                  scope="col"
                >
                  Equipamento
                </th>
                {vehicles.map((vehicle, index) => (
                  <th
                    className="w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] border-b border-r border-border bg-surface px-2 py-2 align-top last:border-r-0 min-[769px]:w-56 min-[769px]:min-w-56 min-[769px]:max-w-56 min-[769px]:px-3"
                    key={vehicle.id}
                    scope="col"
                  >
                    <ComparisonVehicleHeader isReference={index === 0} vehicle={vehicle} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <Fragment key={category.name}>
                  <tr>
                    <th
                      className="sticky left-0 z-20 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-border bg-surface-muted px-2.5 py-2 text-[0.625rem] font-bold uppercase tracking-[0.08em] text-text-secondary shadow-[6px_0_12px_-12px_rgba(26,29,33,0.45)] min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-4 min-[769px]:text-xs lg:w-72 lg:min-w-72 lg:max-w-72"
                      scope="rowgroup"
                    >
                      <span className="block truncate" title={category.name}>
                        {category.name}
                      </span>
                    </th>
                    <td
                      className="border-b border-border bg-surface-muted"
                      colSpan={vehicles.length}
                    />
                  </tr>
                  {category.rows.map((row) => (
                    <tr className="group" key={row.code}>
                      <th
                        className="sticky left-0 z-20 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-border bg-surface px-2.5 py-2 align-middle shadow-[6px_0_12px_-12px_rgba(26,29,33,0.45)] transition-colors group-hover:bg-selection min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-4 lg:w-72 lg:min-w-72 lg:max-w-72"
                        scope="row"
                      >
                        <span
                          className="line-clamp-2 block text-xs font-medium leading-4 text-text-primary min-[769px]:text-sm min-[769px]:leading-5"
                          title={row.label}
                        >
                          {row.label}
                        </span>
                        <span
                          className="mt-0.5 block truncate text-[0.625rem] font-normal leading-3 text-text-muted min-[769px]:text-[0.6875rem]"
                          title={row.equipmentGroup}
                        >
                          {row.equipmentGroup}
                        </span>
                      </th>
                      {row.values.map((value, index) => {
                        const isAdvantage =
                          showAdvantageMarkers &&
                          shouldShowAdvantageCheck(
                            index,
                            row.hasReferenceAdvantage,
                            value.comparison,
                          );

                        return (
                          <td
                            className="w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] border-b border-r border-border bg-surface px-2 py-2 text-center align-middle text-xs font-semibold tabular-nums text-text-secondary transition-colors last:border-r-0 group-hover:bg-selection min-[769px]:w-56 min-[769px]:min-w-56 min-[769px]:max-w-56 min-[769px]:px-3 min-[769px]:text-sm"
                            key={vehicles[index]?.id}
                          >
                            <ComparisonValueCell isAdvantage={isAdvantage} value={value} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
