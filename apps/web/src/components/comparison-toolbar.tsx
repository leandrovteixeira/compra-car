'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { buildComparisonPdfUrl } from '@/application/comparison/comparison-pdf-url';
import type { ComparisonMode } from '@/application/comparison/comparison-view-model';
import { ComparisonPdfActions } from '@/components/comparison-pdf-actions';

interface ComparisonToolbarProps {
  readonly mode: ComparisonMode;
}

const modeOptions: readonly { value: ComparisonMode; label: string }[] = [
  { value: 'complete', label: 'Completa' },
  { value: 'differences', label: 'Diferenças' },
  { value: 'advantages', label: 'Vantagens' },
];

const modeDescriptions: Record<ComparisonMode, string> = {
  complete: 'Todos os equipamentos e especificações aplicáveis.',
  differences: 'Somente valores semanticamente diferentes, sem julgamento.',
  advantages: 'Somente vantagens objetivas determinadas pelo engine atual.',
};

export function ComparisonToolbar({ mode }: ComparisonToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfUrl = buildComparisonPdfUrl(searchParams);

  function selectMode(nextMode: ComparisonMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('highlights');
    if (nextMode === 'complete') params.delete('mode');
    else params.set('mode', nextMode);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-2 border-y border-border bg-surface px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-3">
      <div className="min-w-0">
        <fieldset>
          <legend className="sr-only">Modo da comparação</legend>
          <div
            aria-label="Modo da comparação"
            className="inline-grid grid-cols-3 overflow-hidden rounded border border-border bg-surface-muted p-0.5"
            role="radiogroup"
          >
            {modeOptions.map((option) => (
              <label
                className={`comparison-mode-option flex cursor-pointer items-center justify-center rounded-[0.1875rem] px-2 text-xs font-semibold transition-colors focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-focus ${
                  mode === option.value
                    ? 'bg-selection-strong text-text-primary shadow-sm'
                    : 'text-text-secondary hover:bg-selection'
                }`}
                key={option.value}
              >
                <input
                  checked={mode === option.value}
                  className="sr-only"
                  name="comparison-mode"
                  onChange={() => selectMode(option.value)}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <p aria-live="polite" className="mt-1.5 text-xs text-text-muted">
          {modeDescriptions[mode]}
        </p>
      </div>
      <div className="min-w-0 shrink-0">
        <ComparisonPdfActions pdfUrl={pdfUrl} />
      </div>
    </div>
  );
}
