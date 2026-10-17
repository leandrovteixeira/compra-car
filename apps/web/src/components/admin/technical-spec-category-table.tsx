'use client';

import { useState } from 'react';

export interface TechnicalCategory {
  readonly name: string;
  readonly rows: readonly { readonly id: number; readonly label: string; readonly values: readonly string[] }[];
}
export interface TechnicalVersion {
  readonly id: number;
  readonly version: string;
  readonly modelYear: number;
  readonly price: string;
}
export function TechnicalSpecCategoryTable({ categories, versions }: {
  readonly categories: readonly TechnicalCategory[];
  readonly versions: readonly TechnicalVersion[];
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (name: string) => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });
  return <div className="mt-3 max-h-[calc(100dvh-13rem)] overflow-auto rounded-lg border border-[#D6DEE3] bg-white">
    <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
      <thead className="sticky top-0 z-20 bg-[#DCE8ED] text-[#1A1D21]">
        <tr><th className="sticky left-0 w-64 bg-[#DCE8ED] px-4 py-4 text-left">Especificação</th>
          {versions.map(version => <th key={version.id} className="min-w-44 px-3 py-4 text-center">
            <div className="font-semibold">{version.version}</div>
            <div className="mt-1 text-xs font-normal">{version.modelYear}</div>
            <div className="mt-2 text-sm">{version.price}</div>
          </th>)}
        </tr>
      </thead>
      {categories.map(category => {
        const isCollapsed = collapsed.has(category.name);
        return <tbody key={category.name}>
          <tr className="bg-[#EAF1F4]">
            <th colSpan={versions.length + 1} className="sticky left-0 border-b border-[#D6DEE3] p-0 text-left text-[0.8125rem] font-semibold text-[#1A1D21]">
              <button type="button" aria-expanded={!isCollapsed} onClick={() => toggle(category.name)}
                className="flex min-h-9 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-[#DCE8ED] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#9ABCC8]">
                <span>{category.name}</span>
                <img src="/carboot/arrow.svg" alt="" aria-hidden="true"
                  className={`size-4 shrink-0 object-contain transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </th>
          </tr>
          {!isCollapsed && category.rows.map((row, index) => <tr key={row.id} className={index % 2 ? 'bg-[#F8FAFB]' : 'bg-white'}>
            <th scope="row" className={`sticky left-0 border-b border-[#E5EBEE] px-4 py-3 text-left text-xs font-medium ${index % 2 ? 'bg-[#F8FAFB]' : 'bg-white'}`}>{row.label}</th>
            {row.values.map((value, index) => <td key={versions[index]?.id ?? index} className="border-b border-[#E5EBEE] px-3 py-3 text-center text-xs">{(value === "spec_available" || value === "spec_not_available") ? <img src={`/carboot/${value}.svg`} alt={value === "spec_available" ? "Disponível" : "Indisponível"} title={value === "spec_available" ? "Disponível" : "Indisponível"} className="mx-auto size-5 object-contain" /> : value}</td>)}
          </tr>)}
        </tbody>;
      })}
    </table>
  </div>;
}
