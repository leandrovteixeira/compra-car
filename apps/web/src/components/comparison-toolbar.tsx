'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface ComparisonToolbarProps {
  readonly onlyHighlights: boolean;
}

export function ComparisonToolbar({ onlyHighlights }: ComparisonToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggleOnlyHighlights(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set('highlights', 'true');
    else params.delete('highlights');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-3 shadow-xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-4">
      <div className="min-w-0 px-1">
        <p className="text-sm font-semibold text-slate-100">Visão da comparação</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          {onlyHighlights
            ? 'Exibindo somente vantagens do veículo principal.'
            : 'Exibindo todos os equipamentos e especificações.'}
        </p>
      </div>
      <label
        className={`group flex min-h-11 shrink-0 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300 sm:justify-start ${
          onlyHighlights
            ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_-14px_rgba(103,232,249,0.7)]'
            : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
        }`}
      >
        <input
          checked={onlyHighlights}
          className="peer sr-only"
          onChange={(event) => toggleOnlyHighlights(event.target.checked)}
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 rounded-full border transition-colors ${
            onlyHighlights ? 'border-cyan-300/30 bg-cyan-300/25' : 'border-slate-600 bg-slate-800'
          }`}
        >
          <span
            className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full shadow-sm transition-transform ${
              onlyHighlights ? 'translate-x-[1.35rem] bg-cyan-200' : 'translate-x-1 bg-slate-400'
            }`}
          />
        </span>
        <span>Ver destaques</span>
        {onlyHighlights ? (
          <svg aria-hidden="true" className="size-4 text-cyan-300" fill="none" viewBox="0 0 16 16">
            <path
              d="m4 8.25 2.4 2.4L12 5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        ) : null}
      </label>
    </div>
  );
}
