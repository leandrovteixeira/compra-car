import Link from 'next/link';

import { filterComparisonCategories } from '@/application/comparison/comparison-filter';
import { parseComparisonMode } from '@/application/comparison/comparison-view-model';
import { ComparisonState } from '@/components/comparison-state';
import { ComparisonTable } from '@/components/comparison-table';
import { ComparisonToolbar } from '@/components/comparison-toolbar';
import { APP_NAME } from '@/config/app-identity';
import { loadComparisonPage } from '@/server/comparison-service';
import { loadCurrentModelCards } from '@/server/public-model-catalog';
import { ComparisonVehicleSelector } from '@/components/admin/comparison-vehicle-selector';

interface ComparisonPageProps {
  readonly searchParams: Promise<{
    readonly vehicles?: string | readonly string[];
    readonly mode?: string | readonly string[];
    readonly highlights?: string | readonly string[];
  }>;
}

function BackToSelection() {
  return (
    <Link
      className="ui-button ui-button--secondary ui-button--compact gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      href="/admin/comparar-especificacoes"
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
      Alterar seleção
    </Link>
  );
}

export default async function ComparisonPage({ searchParams }: ComparisonPageProps) {
  const params = await searchParams;
  const cards = await loadCurrentModelCards();
  const options = cards.flatMap(card => card.versions.map(version => ({
    id: version.id, label: `${card.brand} ${card.model} ${version.version} — ${version.model_year}`,
  })));
  const initialIds = typeof params.vehicles === 'string' ? params.vehicles.split(',') : [];
  if (!params.vehicles) return <main className="min-w-0 py-2 text-text-primary">
    <h1 className="text-2xl font-semibold">Comparar Especificações</h1>
    <p className="mt-1 text-sm text-text-muted">Compare versões lado a lado.</p>
    <ComparisonVehicleSelector options={options} />
  </main>;
  const result = await loadComparisonPage(params.vehicles);

  if (!result.ok) {
    return (
      <main className="flex min-h-[30rem] items-center justify-center bg-background px-4 py-8 text-text-primary">
        <div className="w-full max-w-xl">
          <ComparisonState
            action={<ComparisonVehicleSelector options={options} initialIds={initialIds} />}
            description={result.error.message}
            kind="error"
            title="Não foi possível comparar"
          />
        </div>
      </main>
    );
  }

  const mode = parseComparisonMode(params.mode, params.highlights);
  const categories = filterComparisonCategories(result.data.categories, mode);

  return (
    <main className="min-w-0 overflow-x-hidden bg-background py-2 text-text-primary">
      <div className="mx-auto w-full max-w-[100rem]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-interactive">
              {APP_NAME}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">Comparar Especificações</h1>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-text-muted">
              O primeiro veículo é a referência. Compare cada detalhe lado a lado.
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <BackToSelection />
          </div>
        </div>

        <ComparisonVehicleSelector options={options} initialIds={initialIds} />
        <div className="mt-5">
          <ComparisonToolbar mode={mode} />
        </div>
        <div className="mt-4">
          <ComparisonTable categories={categories} mode={mode} vehicles={result.data.vehicles} />
        </div>
      </div>
    </main>
  );
}
