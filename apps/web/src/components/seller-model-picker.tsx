'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SellerModelOption, SellerScoreRadius } from '@/server/seller-model-score-service';

interface Props {
  readonly options: readonly SellerModelOption[];
  readonly radius: SellerScoreRadius;
  readonly showLabel?: boolean;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

export function SellerModelPicker({ options, radius, showLabel = true }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const query = normalize(search.trim());
  const filtered = useMemo(
    () => (query ? options.filter((option) => normalize(option.label).includes(query)).slice(0, 8) : []),
    [options, query],
  );

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (open && root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="relative w-full" ref={root}>
      {showLabel ? (
        <label className="ui-label block" htmlFor="seller-model-search">
          Buscar modelo
        </label>
      ) : null}
      <input
        id="seller-model-search"
        aria-label={showLabel ? undefined : 'Buscar modelo'}
        className={`ui-field ${showLabel ? 'mt-1' : ''}`}
        autoComplete="off"
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query) setOpen(true);
        }}
        placeholder="Buscar marca, modelo ou versão..."
        type="search"
        value={search}
      />
      {open && query ? (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {filtered.length ? (
            filtered.map((option) => (
              <Link
                className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                href={`/ver-modelo?product=${option.id}&radius=${radius}`}
                key={option.id}
                onClick={() => {
                  setOpen(false);
                  setSearch('');
                }}
              >
                {option.label}
              </Link>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-text-muted">Nenhum modelo encontrado.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
