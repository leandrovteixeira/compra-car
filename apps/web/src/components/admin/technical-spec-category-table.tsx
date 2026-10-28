'use client';

import { useState } from 'react';
import { ComparisonScrollRegion } from '@/components/comparison-scroll-region';

export interface TechnicalCategory {
  readonly name: string;
  readonly rows: readonly {
    readonly id: number;
    readonly label: string;
    readonly values: readonly string[];
  }[];
}
export interface TechnicalVersion {
  readonly id: number;
  readonly version: string;
  readonly modelYear: number;
  readonly price: string;
}
export function TechnicalSpecCategoryTable({
  categories,
  versions,
}: {
  readonly categories: readonly TechnicalCategory[];
  readonly versions: readonly TechnicalVersion[];
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (name: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-[#61747B] sm:hidden">Deslize para consultar as versões</p>
      <div className="technical-sheet-table-scroll min-w-0 border border-[#D6DEE3] bg-white">
        <ComparisonScrollRegion>
          <table className="cc-technical-table w-max min-w-full table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col className="w-[8.25rem] min-[769px]:w-64" />
              {versions.map((version) => (
                <col key={version.id} className="w-[7.5rem] min-[769px]:w-56" />
              ))}
            </colgroup>
            <thead className="bg-[#DCE8ED] text-[#1A1D21]">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-r border-[#D6DEE3] bg-[#DCE8ED] px-2.5 py-3 text-left text-xs min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-4"
                >
                  Especificação
                </th>
                {versions.map((version) => (
                  <th
                    scope="col"
                    key={version.id}
                    className="w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] border-r border-[#D6DEE3] bg-[#DCE8ED] px-2 py-3 text-center text-xs min-[769px]:w-56 min-[769px]:min-w-56 min-[769px]:max-w-56"
                  >
                    <div className="font-semibold">{version.version}</div>
                    <div className="mt-1 text-xs font-normal">{version.modelYear}</div>
                    <div className="mt-2 text-sm">{version.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            {categories.map((category) => {
              const isCollapsed = collapsed.has(category.name);
              return (
                <tbody key={category.name}>
                  <tr className="bg-[#EAF1F4]">
                    <th
                      colSpan={versions.length + 1}
                      className="border-b border-[#D6DEE3] p-0 text-left cc-type-data !font-semibold text-[#1A1D21]"
                    >
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggle(category.name)}
                        className="sticky left-0 flex min-h-9 w-[calc(100vw-2.5rem)] max-w-full items-center justify-between gap-3 px-2.5 py-2 text-left min-[769px]:w-auto min-[769px]:px-4 hover:bg-[#EAF1F4] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#9ABCC8]"
                      >
                        <span>{category.name}</span>
                        <img
                          src="/carboot/arrow.svg"
                          alt=""
                          aria-hidden="true"
                          className={`size-4 shrink-0 object-contain transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                        />
                      </button>
                    </th>
                  </tr>
                  {!isCollapsed &&
                    category.rows.map((row, index) => (
                      <tr key={row.id} className={index % 2 ? 'bg-[#F8FAFB]' : 'bg-white'}>
                        <th
                          scope="row"
                          className={`sticky left-0 z-20 w-[8.25rem] min-w-[8.25rem] max-w-[8.25rem] border-b border-r border-[#E5EBEE] px-2.5 py-3 text-left text-xs font-medium min-[769px]:w-64 min-[769px]:min-w-64 min-[769px]:max-w-64 min-[769px]:px-4 ${index % 2 ? 'bg-[#F8FAFB]' : 'bg-white'}`}
                        >
                          {row.label}
                        </th>
                        {row.values.map((value, index) => (
                          <td
                            key={versions[index]?.id ?? index}
                            className="w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] border-b border-r border-[#E5EBEE] px-2 py-3 text-center text-xs min-[769px]:w-56 min-[769px]:min-w-56 min-[769px]:max-w-56"
                          >
                            {value === 'spec_available' || value === 'spec_not_available' ? (
                              <img
                                src={`/carboot/${value}.svg`}
                                alt={value === 'spec_available' ? 'Disponível' : 'Indisponível'}
                                title={value === 'spec_available' ? 'Disponível' : 'Indisponível'}
                                className="mx-auto size-5 object-contain"
                              />
                            ) : (
                              value
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </table>
        </ComparisonScrollRegion>
      </div>
    </div>
  );
}
