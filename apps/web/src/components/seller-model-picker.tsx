'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { SellerModelOption, SellerScoreRadius } from '@/server/seller-model-score-service';

interface SellerModelPickerProps {
  readonly options: readonly SellerModelOption[];
  readonly radius: SellerScoreRadius;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

export function SellerModelPicker({ options, radius }: SellerModelPickerProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return options.slice(0, 12);
    return options.filter((option) => normalize(option.label).includes(query)).slice(0, 12);
  }, [options, search]);

  return (
    <div className="ui-surface">
      <label className="ui-label block" htmlFor="seller-model-search">Ver modelo</label>
      <input
        id="seller-model-search"
        className="ui-field mt-1"
        autoComplete="off"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar marca, modelo ou versão..."
        type="search"
        value={search}
      />
      <div className="mt-2 grid max-h-64 gap-1 overflow-auto">
        {filtered.map((option) => (
          <Link
            className="rounded-md px-2.5 py-2 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            href={`/ver-modelo?product=${option.id}&radius=${radius}`}
            key={option.id}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
