import { getAccountTier } from '@/auth/account-tier-server';
import { comparisonLimit } from '@/auth/entitlements-23c';
import { CatalogPageHeading } from '@/components/admin/catalog-page-heading';
import { ComparisonVehicleSelector } from '@/components/admin/comparison-vehicle-selector';
import { MultiModelRadar } from '@/components/admin/multi-model-radar';
import { loadSellerModelScore } from '@/server/seller-model-score-service';

interface Props { readonly searchParams: Promise<{ readonly vehicles?: string | readonly string[] }> }

export default async function PublicModelRadar({ searchParams }: Props) {
  const tier = await getAccountTier();
  const maxVehicles = comparisonLimit(tier);
  const params = await searchParams;
  const raw = typeof params.vehicles === 'string' ? params.vehicles.split(',') : [];
  const ids = [...new Set(raw.map(Number))].filter(id => Number.isSafeInteger(id) && id > 0);
  const malformed = Boolean(params.vehicles) && (raw.length !== ids.length || ids.length > maxVehicles);
  const first = await loadSellerModelScore(null, 5);
  const allowed = new Set(first.options.map(option => option.id));
  const validIds = ids.filter(id => allowed.has(id));
  const scores = malformed ? [] : await Promise.all(validIds.map(id => loadSellerModelScore(id, 5)));
  const vehicles = scores.flatMap(result => result.selected ? [{
    id: result.selected.id, label: result.selected.label,
    overallScore: result.overallScore, categories: result.categories,
  }] : []);
  return <main className="flex min-h-0 min-w-0 flex-col bg-background px-5 py-5 text-text-primary">
    <CatalogPageHeading title="Comparar Modelos" description="Compare as notas canônicas dos veículos nas dez dimensões." />
    <ComparisonVehicleSelector options={first.options} initialIds={malformed ? [] : validIds.map(String)}
      maxVehicles={maxVehicles} basePath="/comparar-modelos" actionLabel="Comparar modelos" />
    {malformed && <p role="alert" className="my-2 text-sm text-status-error">Seleção inválida. Confira os veículos e o limite do seu perfil.</p>}
    {vehicles.length < 2
      ? <div className="ui-surface mt-2 flex min-h-52 items-center justify-center text-center"><div><h2 className="text-base font-semibold">Selecione pelo menos dois veículos</h2><p className="mt-1 text-sm text-text-muted">Use a busca acima para adicionar veículos.</p></div></div>
      : <MultiModelRadar vehicles={vehicles} />}
  </main>;
}
