import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { ComparisonVehicleSelector } from '@/components/admin/comparison-vehicle-selector';
import { MultiModelRadar } from '@/components/admin/multi-model-radar';
import { loadSellerModelScore } from '@/server/seller-model-score-service';

interface Props {
  readonly searchParams: Promise<{ readonly vehicles?: string | readonly string[] }>;
}

const MAX_VEHICLES = 3; // Upgrade to 8 only after account-tier entitlement is verified server-side.

export default async function CompareModelsPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = typeof params.vehicles === 'string' ? params.vehicles.split(',') : [];
  const ids = [...new Set(raw.map(Number))].filter(id => Number.isSafeInteger(id) && id > 0);
  const malformed = Boolean(params.vehicles) && (raw.length !== ids.length || ids.length > MAX_VEHICLES);
  // Radius no longer affects scores; the argument is retained for API compatibility.
  const first = await loadSellerModelScore(null, 5);
  const allowed = new Set(first.options.map(option => option.id));
  const validIds = ids.filter(id => allowed.has(id));
  const scores = malformed ? [] : await Promise.all(validIds.map(id => loadSellerModelScore(id, 5)));
  const vehicles = scores.flatMap(result => result.selected ? [{
    id: result.selected.id,
    label: result.selected.label,
    overallScore: result.overallScore,
    categories: result.categories,
  }] : []);
  return <main className="flex min-h-0 min-w-0 flex-col bg-background text-text-primary lg:h-[calc(100dvh-4.5rem)] lg:overflow-hidden">
    <CatalogPageHeading title="Comparar Modelos" description="Compare as notas canônicas dos veículos nas dez dimensões, independentemente do preço." />
    <ComparisonVehicleSelector
      options={first.options}
      initialIds={malformed ? [] : validIds.map(String)}
      maxVehicles={MAX_VEHICLES}
      basePath="/admin/comparar-modelos"
      actionLabel="Comparar modelos"
    />
    {malformed && <p role="alert" className="my-2 text-sm text-status-error">Seleção inválida. Escolha até três modelos para comparar.</p>}
    {vehicles.length < 2
      ? <div className="ui-surface mt-2 flex min-h-52 items-center justify-center text-center"><div><h2 className="text-base font-semibold">Selecione pelo menos dois veículos</h2><p className="mt-1 text-sm text-text-muted">Use a busca acima; cada seleção será adicionada a um card.</p></div></div>
      : <MultiModelRadar vehicles={vehicles}/>}
  </main>;
}
