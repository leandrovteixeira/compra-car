import { CarbootBackLink } from '@/components/carboot-back-link';

import { filterComparisonCategories } from '@/application/comparison/comparison-filter';
import { parseComparisonMode } from '@/application/comparison/comparison-view-model';
import { ComparisonState } from '@/components/comparison-state';
import { ComparisonTable } from '@/components/comparison-table';
import { ComparisonToolbar } from '@/components/comparison-toolbar';
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

export default async function ComparisonPage({ searchParams }: ComparisonPageProps) {
  const params = await searchParams;
  const cards = await loadCurrentModelCards();
  const options = cards.flatMap(card => card.versions.map(version => ({
    id: version.id, label: `${card.brand} ${card.model} ${version.version} ${version.model_year}`,
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
            action={<CarbootBackLink href="/admin/comparar-especificacoes" label="Voltar aos modelos" />}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Comparar Especificações</h1><p className="mt-1 text-sm text-text-muted">Compare versões lado a lado.</p>
          </div>
          <div className="self-start sm:self-auto">
            <CarbootBackLink href="/admin/comparar-especificacoes" label="Voltar aos modelos" />
          </div>
        </div>

        <ComparisonVehicleSelector options={options} initialIds={initialIds} compact />
        <div className="mt-2">
          <ComparisonToolbar mode={mode} />
        </div>
        <div className="mt-2">
          <ComparisonTable categories={categories} mode={mode} vehicles={result.data.vehicles} />
        </div>
      </div>
    </main>
  );
}
