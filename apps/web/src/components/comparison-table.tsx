import type {
  ComparisonCategoryPresentationDto,
  ComparisonVehiclePresentationDto,
} from '@compra-car/contracts';
import { Fragment } from 'react';

import { shouldShowAdvantageCheck } from '@/application/comparison/comparison-value-presentation';
import { ComparisonState } from '@/components/comparison-state';
import { ComparisonValueCell } from '@/components/comparison-value-cell';
import { ComparisonVehicleHeader } from '@/components/comparison-vehicle-header';

interface ComparisonTableProps {
  readonly vehicles: readonly ComparisonVehiclePresentationDto[];
  readonly categories: readonly ComparisonCategoryPresentationDto[];
  readonly onlyHighlights: boolean;
}

export function ComparisonTable({ vehicles, categories, onlyHighlights }: ComparisonTableProps) {
  if (categories.length === 0) {
    return (
      <ComparisonState
        compact
        description={
          onlyHighlights
            ? 'Desative “Ver destaques” para consultar todos os equipamentos e especificações.'
            : 'Não encontramos itens comparáveis para os veículos selecionados.'
        }
        kind="empty"
        title={onlyHighlights ? 'Nenhuma vantagem encontrada' : 'Comparação sem equipamentos'}
      />
    );
  }

  const rowCount = categories.reduce((total, category) => total + category.rows.length, 0);

  return (
    <section aria-label="Tabela de comparação" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-4 px-1 text-xs text-slate-500">
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

      <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900 shadow-2xl shadow-slate-950/30">
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
                <col className="w-[7.25rem] min-[769px]:w-56" key={vehicle.id} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-40">
              <tr>
                <th
                  className="sticky left-0 z-50 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-slate-700/80 bg-slate-900/95 px-2.5 py-3 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-400 shadow-[8px_0_18px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-5 min-[769px]:text-xs min-[769px]:tracking-[0.14em] lg:w-72 lg:min-w-72 lg:max-w-72"
                  scope="col"
                >
                  Equipamento
                </th>
                {vehicles.map((vehicle, index) => (
                  <th
                    className="w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] border-b border-r border-slate-700/60 bg-slate-900/95 px-2 py-2 align-top backdrop-blur-xl last:border-r-0 min-[769px]:w-56 min-[769px]:min-w-56 min-[769px]:max-w-56 min-[769px]:px-4 min-[769px]:py-3"
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
                      className="sticky left-0 z-20 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-slate-700/70 bg-slate-800 px-2.5 py-2 text-[0.625rem] font-bold uppercase tracking-[0.09em] text-slate-200 shadow-[8px_0_18px_-16px_rgba(0,0,0,0.9)] min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-5 min-[769px]:py-2.5 min-[769px]:text-xs min-[769px]:tracking-[0.13em] lg:w-72 lg:min-w-72 lg:max-w-72"
                      scope="rowgroup"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg
                          aria-hidden="true"
                          className="size-3 shrink-0 text-cyan-300"
                          fill="none"
                          viewBox="0 0 16 16"
                        >
                          <circle cx="8" cy="8" r="5.5" stroke="currentColor" />
                          <path d="m9.8 6.2-1.1 2.5-2.5 1.1 1.1-2.5 2.5-1.1Z" fill="currentColor" />
                        </svg>
                        <span className="truncate" title={category.name}>
                          {category.name}
                        </span>
                      </span>
                    </th>
                    <td
                      className="border-b border-slate-700/70 bg-slate-800/80"
                      colSpan={vehicles.length}
                    />
                  </tr>
                  {category.rows.map((row) => (
                    <tr className="group" key={row.code}>
                      <th
                        className="sticky left-0 z-20 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-slate-800 bg-slate-900 px-2.5 py-2.5 align-middle shadow-[8px_0_18px_-16px_rgba(0,0,0,0.9)] transition-colors group-hover:bg-slate-800/95 min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-5 min-[769px]:py-3.5 lg:w-72 lg:min-w-72 lg:max-w-72"
                        scope="row"
                      >
                        <span
                          className="line-clamp-2 block text-xs font-medium leading-4 text-slate-100 min-[769px]:text-sm min-[769px]:leading-5"
                          title={row.label}
                        >
                          {row.label}
                        </span>
                        <span
                          className="mt-0.5 block truncate text-[0.625rem] font-normal leading-4 text-slate-500 min-[769px]:text-[0.6875rem]"
                          title={row.equipmentGroup}
                        >
                          {row.equipmentGroup}
                        </span>
                      </th>
                      {row.values.map((value, index) => {
                        const isAdvantage = shouldShowAdvantageCheck(
                          index,
                          row.hasReferenceAdvantage,
                          value.comparison,
                        );

                        return (
                          <td
                            className="w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] border-b border-r border-slate-800 bg-slate-900/60 px-2 py-2.5 text-center align-middle text-xs font-semibold tabular-nums text-slate-200 transition-colors last:border-r-0 group-hover:bg-slate-800/60 min-[769px]:w-56 min-[769px]:min-w-56 min-[769px]:max-w-56 min-[769px]:px-4 min-[769px]:py-3.5 min-[769px]:text-sm"
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
