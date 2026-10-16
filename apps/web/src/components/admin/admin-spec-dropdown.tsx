'use client';

import { useEffect, useRef, useState } from 'react';

interface Option { readonly value: string; readonly label: string }
interface Props {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
}

/** Carboot dropdown: matching trigger/menu widths, original Figma arrow and typography. */
export function AdminSpecDropdown({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <div ref={ref} className="relative w-full min-w-0">
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[#D6DEE3] bg-white px-3 text-left font-sans text-[13px] font-normal leading-tight text-[#1A1D21] hover:border-[#9ABCC8] focus-visible:outline-2 focus-visible:outline-[#9ABCC8]">
        <span className="min-w-0 truncate">{selected?.label ?? 'Não informado'}</span>
        <img alt="" src="/carboot/arrow-graphite.svg"
          className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && (
        <div role="listbox" aria-label={label}
          className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-56 w-full overflow-auto rounded-md border border-[#D6DEE3] bg-white py-1 shadow-xl">
          {options.map((option) => (
            <button key={option.value} role="option" aria-selected={option.value === value}
              className={`block min-h-9 w-full px-3 py-2 text-left font-sans text-[13px] leading-snug hover:bg-[#EAF1F4] ${option.value === value ? 'bg-[#EAF1F4] font-medium text-[#1A1D21]' : 'text-[#526670]'}`}
              type="button" onClick={() => { onChange(option.value); setOpen(false); }}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
