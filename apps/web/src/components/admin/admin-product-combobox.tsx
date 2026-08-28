'use client';

import type { ManualPriceBatchProductOptionDto } from '@compra-car/contracts';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { matchesVehicleSearch, normalizeVehicleSearch } from '@/application/catalog/vehicle-search';
import { buttonClassName, fieldClassName, labelClassName } from '@compra-car/ui';

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
    if (!normalizeVehicleSearch(query) || (selected && query === optionLabel(selected)))
      return options;
    return options.filter((option) => matchesVehicleSearch(optionLabel(option), query));
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
      <label className={hideLabel ? 'sr-only' : labelClassName} htmlFor={`${listboxId}-input`}>
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
          className={`${fieldClassName} pr-10 placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60`}
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
            className={`${buttonClassName({ size: 'micro', variant: 'ghost' })} absolute inset-y-0 right-0 min-h-0 min-w-9 px-0 text-text-muted`}
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
              className="fixed z-[1000] overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-xl"
              id={listboxId}
              role="listbox"
              style={popupStyle}
            >
              {filtered.length ? (
                filtered.map((option, index) => (
                  <li
                    aria-selected={option.id === value}
                    className={`cursor-pointer rounded px-2.5 py-1.5 text-sm ${index === activeIndex ? 'bg-selection text-text-primary' : 'text-text-secondary hover:bg-surface-muted'}`}
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
                <li className="px-2.5 py-1.5 text-sm text-text-muted">
                  Nenhum veículo encontrado.
                </li>
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
