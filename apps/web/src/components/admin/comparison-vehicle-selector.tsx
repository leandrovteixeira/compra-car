'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { ComparisonLoadingOverlay } from './comparison-loading-overlay';
import { useRouter } from 'next/navigation';

export interface ComparisonVehicleOption {
  readonly id: number;
  readonly label: string;
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function ComparisonVehicleSelector({ options, initialIds = [], maxVehicles = 3, compact = false, basePath = '/admin/comparar-especificacoes', actionLabel = 'Comparar especificações' }: {
  readonly options: readonly ComparisonVehicleOption[];
  readonly initialIds?: readonly string[];
  readonly maxVehicles?: number;
  readonly compact?: boolean;
  readonly basePath?: string;
  readonly actionLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(() => [...new Set(initialIds.filter(id => options.some(option => String(option.id) === id)))].slice(0, maxVehicles));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selected);
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return (term ? options.filter(option => normalize(option.label).includes(term)) : options)
      .filter(option => !selectedSet.has(String(option.id))).slice(0, 12);
  }, [options, query, selected.join('|')]);
  const add = (id: string) => {
    if (!id || selected.length >= maxVehicles || selectedSet.has(id)) return;
    setSelected(current => [...current, id]);
    setQuery('');
    setOpen(false);
    root.current?.querySelector('input')?.focus();
  };
  const remove = (id: string) => setSelected(current => current.filter(value => value !== id));
  return <section className={'min-w-0'}>
    {pending && <ComparisonLoadingOverlay />}
    <div className="flex min-w-0 flex-wrap items-center gap-2 py-3">
      <div ref={root} className={`relative min-w-[15rem] flex-1 ${open && selected.length < maxVehicles ? 'z-[70]' : ''}`}><img src="/carboot/search.svg" alt="" aria-hidden="true" className="pointer-events-none absolute left-3 top-5 z-10 size-[18px] -translate-y-1/2 object-contain" />
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={event => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && filtered[0]) { event.preventDefault(); add(String(filtered[0].id)); } }}
          disabled={selected.length >= maxVehicles}
          aria-label="Adicionar veículo à comparação" aria-expanded={open}
          placeholder={selected.length >= maxVehicles ? `Limite de ${maxVehicles} veículos atingido` : 'Buscar marca, modelo ou versão...'}
          className="ui-field !h-10 !min-h-10 w-full !pl-10 !pr-4 text-[0.8125rem]" />
        {open && selected.length < maxVehicles && <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-[#D6DEE3] bg-white p-1 shadow-lg">
          {filtered.length ? filtered.map(option => <button type="button" key={option.id}
            onMouseDown={event => event.preventDefault()} onClick={() => add(String(option.id))}
            className="block min-h-9 w-full rounded px-3 py-2 text-left text-[0.8125rem] hover:bg-[#EAF1F4]">
            {option.label}
          </button>) : <p className="px-3 py-2 text-xs text-[#61747B]">Nenhuma versão encontrada.</p>}
        </div>}
      </div>
      <span className="whitespace-nowrap text-xs text-[#61747B]">{selected.length} / {maxVehicles} veículos</span>
      <button type="button" disabled={selected.length < 2}
        onClick={() => startTransition(() => router.push(`${basePath}?vehicles=${selected.join(',')}`))}
        className="cc-btn cc-btn--m cc-btn--primary">{actionLabel}</button>
    </div>
    {selected.length > 0 && <div className={`mb-1 grid grid-cols-1 gap-2 md:grid-cols-2 ${selected.length === 2 ? "xl:grid-cols-2" : selected.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
      {selected.map((id, index) => {
        const option = options.find(item => String(item.id) === id);
        return <div key={id} className="flex min-w-0 items-center gap-2 rounded-md border border-[#D6DEE3] bg-[#F8FAFB] px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#61747B]">{index === 0 ? 'Principal' : 'Veículo ' + (index + 1)}</span>
            <span className="block truncate text-[0.8125rem] font-medium" title={option?.label}>{option?.label ?? id}</span>
          </div>
          <button type="button" onClick={() => remove(id)} aria-label={`Remover ${option?.label ?? id}`}
            className="shrink-0 rounded p-1 hover:bg-[#DCE8ED]"><img src="/carboot/close.svg" alt="" aria-hidden="true" className="size-4 object-contain" /></button>
        </div>;
      })}
    </div>}
  </section>;
}
