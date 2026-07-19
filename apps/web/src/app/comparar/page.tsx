import Link from 'next/link';

import { filterComparisonCategories } from '@/application/comparison/comparison-filter';
import { ComparisonTable } from '@/components/comparison-table';
import { ComparisonToolbar } from '@/components/comparison-toolbar';
import { loadComparisonPage } from '@/server/comparison-service';

interface ComparisonPageProps {
  readonly searchParams: Promise<{
    readonly vehicles?: string | readonly string[];
    readonly differences?: string | readonly string[];
  }>;
}

function BackToSelection() {
  return (
    <Link
      className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:border-cyan-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      href="/"
    >
      Voltar e alterar seleção
    </Link>
  );
}

export default async function ComparisonPage({ searchParams }: ComparisonPageProps) {
  const params = await searchParams;
  const result = await loadComparisonPage(params.vehicles);

  if (!result.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-8 text-slate-50">
        <section className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Comparação de veículos
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Não foi possível comparar</h1>
          <p className="mt-4 text-slate-300" role="alert">
            {result.error.message}
          </p>
          <div className="mt-7">
            <BackToSelection />
          </div>
        </section>
      </main>
    );
  }

  const onlyDifferences = params.differences === 'true';
  const categories = filterComparisonCategories(result.data.categories, onlyDifferences);

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-50 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">
              Compra Car
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Comparação de veículos
            </h1>
            <p className="mt-3 text-slate-300">
              Compare equipamentos e especificações mantendo a ordem da seleção.
            </p>
          </div>
          <BackToSelection />
        </div>

        <div className="mt-8">
          <ComparisonToolbar onlyDifferences={onlyDifferences} />
        </div>
        <div className="mt-8">
          <ComparisonTable
            categories={categories}
            onlyDifferences={onlyDifferences}
            vehicles={result.data.vehicles}
          />
        </div>
      </div>
    </main>
  );
}
