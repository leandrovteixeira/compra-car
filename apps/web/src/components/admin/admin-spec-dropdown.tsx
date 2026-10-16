'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';

interface Option { readonly value: string; readonly label: string }
interface Props {
  readonly label: string;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
}

export function AdminSpecDropdown({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: 0, maxHeight: 220 });
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function position() {
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds) return;
      const below = window.innerHeight - bounds.bottom - 8;
      const above = bounds.top - 8;
      // Prefer a short drawer immediately below its trigger rather than floating far above.
      const showBelow = below >= 44;
      const maxHeight = Math.max(32, Math.min(220, showBelow ? below : above));
      setPlacement({
        left: bounds.left,
        top: showBelow ? bounds.bottom + 4 : bounds.top - maxHeight - 4,
        width: bounds.width,
        maxHeight,
      });
    }
    function onPointer(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!ref.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); }
    }
    const onScroll = () => setOpen(false);
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 w-full">
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[#D6DEE3] bg-white px-3 text-left font-sans text-[13px] leading-tight font-normal text-[#1A1D21] focus-visible:outline-2 focus-visible:outline-[#9ABCC8]">
        <span className="min-w-0 truncate">{selected?.label ?? 'Não informado'}</span>
        <img alt="" src="/carboot/arrow-graphite.svg" className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && createPortal(
        <div id={menuId} ref={menuRef} role="listbox" aria-label={label}
          style={{ position: 'fixed', left: placement.left, top: placement.top, width: placement.width, maxHeight: placement.maxHeight, zIndex: 9999 }}
          className="overflow-y-auto rounded-md border border-[#D6DEE3] bg-white py-1 shadow-xl">
          {options.map((option) => (
            <button key={option.value} role="option" aria-selected={option.value === value}
              type="button" onClick={() => { onChange(option.value); setOpen(false); }}
              className={`block min-h-9 w-full px-3 py-2 text-left font-sans text-[13px] leading-snug hover:bg-[#EAF1F4] ${option.value === value ? 'bg-[#EAF1F4] font-medium text-[#1A1D21]' : 'text-[#526670]'}`}>
              {option.label}
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}
