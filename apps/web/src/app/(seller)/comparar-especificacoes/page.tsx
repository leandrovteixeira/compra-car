import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';
import { CarbootBackLink } from '@/components/carboot-back-link';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';

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
  const tier = await getAccountTier();
  const maxVehicles = comparisonLimit(tier);
  const cards = await loadCurrentModelCards();
  const options = cards.flatMap((card) =>
    card.versions.map((version) => ({
      id: version.id,
      label: `${card.brand} ${card.model} ${version.version} ${version.model_year}`,
    })),
  );
  const initialIds = typeof params.vehicles === 'string' ? params.vehicles.split(',') : [];
  if (!params.vehicles)
    return (
      <main className="min-w-0 px-5 py-5 text-text-primary">
        <CatalogPageHeading
          title="Comparar Especificações"
          description="Compare versões lado a lado."
        />
        <ComparisonVehicleSelector
          options={options}
          basePath="/comparar-especificacoes"
          maxVehicles={maxVehicles}
        />
      </main>
    );
  const result = await loadComparisonPage(params.vehicles);

  if (!result.ok) {
    return (
      <main className="flex min-h-[30rem] items-center justify-center bg-background px-4 py-8 text-text-primary">
        <div className="w-full max-w-xl">
          <ComparisonState
            action={<CarbootBackLink href="/comparar-especificacoes" label="Voltar aos modelos" />}
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
    <main className="flex min-h-0 min-w-0 flex-col bg-background px-5 py-5 text-text-primary">
      <div className="mx-auto flex min-h-0 w-full max-w-[100rem] flex-1 flex-col">
        <CatalogPageHeading
          title="Comparar Especificações"
          description="Compare versões lado a lado."
        />
        <ComparisonVehicleSelector
          options={options}
          initialIds={initialIds}
          maxVehicles={maxVehicles}
          basePath="/comparar-especificacoes"
          compact
        />
        <div className="mt-1 shrink-0">
          <ComparisonToolbar mode={mode} authenticated={tier !== 'visitor'} />
        </div>
        <div className="mt-1 flex min-h-0 flex-1 flex-col">
          <ComparisonTable categories={categories} mode={mode} vehicles={result.data.vehicles} />
        </div>
      </div>
    </main>
  );
}
