'use client';

import { forwardRef, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface CatalogComboboxOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

interface CatalogComboboxProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly CatalogComboboxOption[];
  readonly placeholder?: string;
  readonly value: string;
}

function findEnabledOption(
  options: readonly CatalogComboboxOption[],
  startIndex: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) return -1;

  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (startIndex + direction * offset + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }

  return -1;
}

export const CatalogCombobox = forwardRef<HTMLButtonElement, CatalogComboboxProps>(
  function CatalogCombobox(
    { disabled = false, label, onChange, options, placeholder = 'Selecione', value },
    forwardedRef,
  ) {
    const id = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const selectedIndex = options.findIndex((option) => option.value === value);
    const selectedOption = options[selectedIndex];

    useEffect(() => {
      function closeFromOutside(event: PointerEvent) {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      }

      document.addEventListener('pointerdown', closeFromOutside);
      return () => document.removeEventListener('pointerdown', closeFromOutside);
    }, []);

    useEffect(() => {
      if (disabled) setOpen(false);
    }, [disabled]);

    useEffect(() => {
      if (open && activeIndex >= 0) {
        optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
      }
    }, [activeIndex, open]);

    function openMenu(direction: 1 | -1 = 1) {
      const initialIndex =
        selectedIndex >= 0 ? selectedIndex : direction === 1 ? 0 : options.length - 1;
      setActiveIndex(findEnabledOption(options, initialIndex, direction));
      setOpen(true);
    }

    function selectOption(index: number) {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      setOpen(false);
    }

    function moveActive(direction: 1 | -1) {
      const startIndex =
        activeIndex < 0 ? (direction === 1 ? 0 : options.length - 1) : activeIndex + direction;
      setActiveIndex(findEnabledOption(options, startIndex, direction));
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (event.key === 'Escape') {
        if (open) event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key === 'Tab') {
        setOpen(false);
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        if (open) moveActive(direction);
        else openMenu(direction);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (open && activeIndex >= 0) selectOption(activeIndex);
        else openMenu();
      }
    }

    const activeOptionId = activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined;

    return (
      <div className="grid min-w-0 gap-2 text-sm font-medium text-slate-200" ref={rootRef}>
        <span id={`${id}-label`}>{label}</span>
        <div className="relative min-w-0">
          <button
            aria-activedescendant={open ? activeOptionId : undefined}
            aria-controls={`${id}-listbox`}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-labelledby={`${id}-label ${id}-value`}
            className="flex min-h-12 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-left text-base outline-none transition focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => (open ? setOpen(false) : openMenu())}
            onKeyDown={handleKeyDown}
            ref={forwardedRef}
            role="combobox"
            type="button"
          >
            <span
              className={`min-w-0 flex-1 truncate ${selectedOption ? '' : 'text-slate-400'}`}
              id={`${id}-value`}
              title={selectedOption?.label ?? placeholder}
            >
              {selectedOption?.label ?? placeholder}
            </span>
            <span aria-hidden="true" className="shrink-0 text-slate-400">
              ▾
            </span>
          </button>

          {open ? (
            <ul
              aria-labelledby={`${id}-label`}
              className="absolute inset-x-0 z-20 mt-2 max-h-60 w-full overflow-y-auto overflow-x-hidden rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-slate-950/70"
              id={`${id}-listbox`}
              role="listbox"
            >
              {options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">Nenhuma opção disponível</li>
              ) : null}
              {options.map((option, index) => (
                <li
                  aria-disabled={option.disabled || undefined}
                  aria-selected={option.value === value}
                  className={`min-w-0 cursor-default truncate rounded-lg px-3 py-2 text-sm ${
                    option.disabled
                      ? 'text-slate-600'
                      : index === activeIndex
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-200 hover:bg-slate-800'
                  }`}
                  id={`${id}-option-${index}`}
                  key={option.value}
                  onClick={() => selectOption(index)}
                  onMouseEnter={() => {
                    if (!option.disabled) setActiveIndex(index);
                  }}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  role="option"
                  title={option.label}
                >
                  {option.label}
                  {option.disabled ? ' — já adicionado' : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    );
  },
);
