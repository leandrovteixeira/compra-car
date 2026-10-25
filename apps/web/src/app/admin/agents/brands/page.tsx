import Link from 'next/link';

import { loadBrandTargets } from '@/application/admin/brand-connectors';
import { BrandConnectorForm } from '@/components/admin/brand-connector-form';
import { PageHeader } from '@/components/admin/page-header';

export default async function BrandTargetsPage() {
  const items = await loadBrandTargets();

  return (
    <>
      <PageHeader
        title="Marcas monitoradas"
        description="Toda marca desta lista entra automaticamente no monitoramento do Brand Connector para o mercado brasileiro."
      />

      <div className="mt-5 space-y-6">
        <nav className="flex flex-wrap gap-4" aria-label="Área de agentes">
          <Link href="/admin/agents">Fila de revisão</Link>
          <Link href="/admin/agents?tab=runs">Runs</Link>
          <Link href="/admin/agents/brands" aria-current="page">
            Marcas
          </Link>
        </nav>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-text-primary">Adicionar marca</h2>
          <p className="mt-1 text-sm text-text-secondary">
            A marca será criada como monitorada em BR. Não é necessário habilitar o monitoramento separadamente.
          </p>
          <div className="mt-4">
            <BrandConnectorForm
              operation="add"
              label="Adicionar marca"
              fields={{ market: 'BR' }}
            >
              <label className="ui-label">
                Marca
                <input
                  className="ui-field"
                  name="brand"
                  required
                  maxLength={100}
                  placeholder="Ex.: Kia"
                />
              </label>
            </BrandConnectorForm>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Lista monitorada</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Marcas do catálogo podem ser sincronizadas em lote; marcas adicionais podem ser cadastradas manualmente.
            </p>
          </div>
          <BrandConnectorForm operation="sync" label="Sincronizar marcas do catálogo" />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <tr>
                {['Marca', 'Mercado', 'Origem', 'Status', 'Connector / versão', 'Última run'].map(
                  (heading) => (
                    <th className="p-3 font-semibold" key={heading}>
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map(({ target, active, latestRun }) => (
                <tr key={target.id} className="border-t border-border first:border-t-0">
                  <td className="p-3 font-medium">
                    <Link className="underline-offset-2 hover:underline" href={'/admin/agents/brands/' + target.id}>
                      {target.brand}
                    </Link>
                  </td>
                  <td className="p-3 text-text-secondary">{target.market}</td>
                  <td className="p-3 text-text-secondary">
                    {target.origin === 'MANUAL' ? 'Manual' : 'Catálogo'}
                  </td>
                  <td className="p-3">
                    {target.enabled ? (
                      <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300">
                        Monitorada
                      </span>
                    ) : (
                      <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">
                        Pausada
                      </span>
                    )}
                  </td>
                  <td className="p-3">{active ? 'ACTIVE v' + active.version : 'Ausente'}</td>
                  <td className="p-3">
                    {latestRun ? (
                      <Link className="underline-offset-2 hover:underline" href={'/admin/agents/runs/' + latestRun.id}>
                        {latestRun.status} · {latestRun.runMode}
                      </Link>
                    ) : (
                      'Sem execução'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!items.length ? (
          <p>Nenhuma marca registrada. Adicione uma marca ou sincronize o catálogo.</p>
        ) : null}
      </div>
    </>
  );
}
