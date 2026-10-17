'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ComparisonVehicleOption {
  readonly id: number;
  readonly label: string;
}

export function ComparisonVehicleSelector({ options, initialIds = [] }: {
  readonly options: readonly ComparisonVehicleOption[];
  readonly initialIds?: readonly string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() => [
    initialIds[0] ?? '', initialIds[1] ?? '',
    ...(initialIds[2] ? [initialIds[2]] : []),
  ]);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const term = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!term) return options;
    return options.filter(option => option.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(term));
  }, [options, query]);
  const valid = selected.length >= 2 && selected.every(Boolean) && new Set(selected).size === selected.length;
  const choose = (index: number, id: string) => setSelected(previous => previous.map((value, i) => i === index ? id : value));
  return <section className="mt-5 rounded-lg border border-[#D6DEE3] bg-white p-4">
    <h2 className="text-base font-semibold">Selecionar veículos</h2>
    <p className="mt-1 text-xs text-[#61747B]">Escolha pelo menos dois veículos. O primeiro será a referência para vantagens e diferenças.</p>
    <label className="mt-4 block text-xs font-medium text-[#526670]">
      Filtrar catálogo
      <input type="search" value={query} onChange={event => setQuery(event.target.value)}
        className="ui-field mt-1 w-full" placeholder="Buscar marca, modelo ou versão..." />
    </label>
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      {selected.map((value, index) => <label key={index} className="min-w-0 text-xs font-medium text-[#526670]">
        {index === 0 ? 'Principal' : `Concorrente ${index}`}
        <select className="ui-field mt-1 w-full min-w-0" value={value} onChange={event => choose(index, event.target.value)}>
          <option value="">Selecione um veículo</option>
          {options.filter(option => option.id.toString() === value || (filtered.some(item => item.id === option.id) && !selected.some((id, i) => i !== index && id === option.id.toString())))
            .map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>)}
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {selected.length < 3 && <button type="button" className="cc-btn cc-btn--p cc-btn--secondary" onClick={() => setSelected(previous => [...previous, ''])}>Adicionar concorrente</button>}
      {selected.length === 3 && <button type="button" className="cc-btn cc-btn--p cc-btn--secondary" onClick={() => setSelected(previous => previous.slice(0, 2))}>Remover terceiro</button>}
      <button type="button" disabled={!valid} className="cc-btn cc-btn--m cc-btn--primary"
        onClick={() => router.push(`/admin/comparar-especificacoes?vehicles=${selected.join(',')}`)}>
        Comparar especificações
      </button>
      {!valid && <span className="text-xs text-[#61747B]">Selecione dois ou três veículos diferentes.</span>}
    </div>
  </section>;
}
