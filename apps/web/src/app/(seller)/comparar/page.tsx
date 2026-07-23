import Link from 'next/link';

import { filterComparisonCategories } from '@/application/comparison/comparison-filter';
import { ComparisonState } from '@/components/comparison-state';
import { ComparisonTable } from '@/components/comparison-table';
import { ComparisonToolbar } from '@/components/comparison-toolbar';
import { loadComparisonPage } from '@/server/comparison-service';

interface ComparisonPageProps {
  readonly searchParams: Promise<{
    readonly vehicles?: string | readonly string[];
    readonly highlights?: string | readonly string[];
  }>;
}

function BackToSelection() {
  return (
    <Link
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      href="/"
    >
      <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
        <path
          d="m9.5 3.5-4.5 4.5 4.5 4.5M5 8h8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
      Voltar e alterar seleção
    </Link>
  );
}

export default async function ComparisonPage({ searchParams }: ComparisonPageProps) {
  const params = await searchParams;
  const result = await loadComparisonPage(params.vehicles);

  if (!result.ok) {
    return (
      <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center bg-slate-950 px-4 py-8 text-slate-50">
        <div className="w-full max-w-xl">
          <ComparisonState
            action={<BackToSelection />}
            description={result.error.message}
            kind="error"
            title="Não foi possível comparar"
          />
        </div>
      </main>
    );
  }

  const onlyHighlights = params.highlights === 'true';
  const categories = filterComparisonCategories(result.data.categories, onlyHighlights);

  return (
    <main className="min-h-[calc(100dvh-4.5rem)] bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.08),transparent_30rem)] bg-slate-950 px-3 py-6 text-slate-50 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[100rem]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">
              Compra Car
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Comparação de veículos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              O primeiro veículo é a referência. Compare cada detalhe lado a lado.
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <BackToSelection />
          </div>
        </div>

        <div className="mt-6">
          <ComparisonToolbar onlyHighlights={onlyHighlights} />
        </div>
        <div className="mt-5">
          <ComparisonTable
            categories={categories}
            onlyHighlights={onlyHighlights}
            vehicles={result.data.vehicles}
          />
        </div>
      </div>
    </main>
  );
}
