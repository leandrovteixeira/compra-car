'use client';

import type { ManualPriceBatchProductOptionDto } from '@compra-car/contracts';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  matchesProductSearch,
  normalizeProductSearch,
} from '@/application/admin/admin-product-search';

interface AdminProductComboboxProps {
  readonly disabled?: boolean;
  readonly error?: boolean;
  readonly errorDescriptionId?: string;
  readonly label: string;
  readonly hideLabel?: boolean;
  readonly onChange: (productId: string) => void;
  readonly options: readonly ManualPriceBatchProductOptionDto[];
  readonly value: string;
}

function optionLabel(option: ManualPriceBatchProductOptionDto): string {
  const status = [!option.isActive ? 'inativo' : '', !option.isPublic ? 'privado' : ''].filter(
    Boolean,
  );
  return `${option.displayName}${status.length ? ` (${status.join(', ')})` : ''}`;
}

export function AdminProductCombobox({
  disabled = false,
  error = false,
  errorDescriptionId,
  label,
  hideLabel = false,
  onChange,
  options,
  value,
}: AdminProductComboboxProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.id === value);
  const [query, setQuery] = useState(selected ? optionLabel(selected) : '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});

  useEffect(() => {
    setQuery(selected ? optionLabel(selected) : '');
  }, [selected]);

  const filtered = useMemo(() => {
    if (!normalizeProductSearch(query) || (selected && query === optionLabel(selected)))
      return options;
    return options.filter((option) => matchesProductSearch(optionLabel(option), query));
  }, [options, query, selected]);

  useEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopupStyle({
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        maxHeight: Math.max(160, window.innerHeight - rect.bottom - 16),
      });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  function choose(option: ManualPriceBatchProductOptionDto) {
    onChange(option.id);
    setQuery(optionLabel(option));
    setOpen(false);
  }

  return (
    <div className="relative">
      <label
        className={hideLabel ? 'sr-only' : 'text-xs font-semibold text-slate-400'}
        htmlFor={`${listboxId}-input`}
      >
        {label}
      </label>
      <div className={hideLabel ? 'relative' : 'relative mt-1'}>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined
          }
          aria-describedby={errorDescriptionId}
          aria-expanded={open}
          aria-invalid={error}
          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 pr-10 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          id={`${listboxId}-input`}
          ref={inputRef}
          onBlur={() => setTimeout(() => setOpen(false), 100)}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onChange('');
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter' && open && filtered[activeIndex]) {
              event.preventDefault();
              choose(filtered[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
              setQuery(selected ? optionLabel(selected) : '');
            }
          }}
          placeholder="Buscar marca, modelo ou versão"
          role="combobox"
          type="text"
          value={query}
        />
        {query ? (
          <button
            aria-label="Limpar veículo"
            className="absolute right-1 top-1 min-h-9 min-w-9 rounded text-slate-400 hover:text-slate-100"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(true);
            }}
            type="button"
          >
            ×
          </button>
        ) : null}
      </div>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="fixed z-[1000] overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-2xl"
              id={listboxId}
              role="listbox"
              style={popupStyle}
            >
              {filtered.length ? (
                filtered.map((option, index) => (
                  <li
                    aria-selected={option.id === value}
                    className={`cursor-pointer rounded-md px-3 py-2 text-sm ${index === activeIndex ? 'bg-sky-900 text-sky-100' : 'text-slate-200 hover:bg-slate-800'}`}
                    key={option.id}
                    id={`${listboxId}-option-${index}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                    role="option"
                  >
                    {optionLabel(option)}
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-slate-400">Nenhum veículo encontrado.</li>
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
