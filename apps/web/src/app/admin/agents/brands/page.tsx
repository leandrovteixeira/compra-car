import Link from 'next/link';
import { loadBrandTargets } from '@/application/admin/brand-connectors';
import { BrandConnectorForm } from '@/components/admin/brand-connector-form';
import { PageHeader } from '@/components/admin/page-header';
export default async function BrandTargetsPage() {
  const items = await loadBrandTargets();
  return (
    <>
      <PageHeader
        title="Marcas"
        description="Marcas monitoradas e connectors operacionais. Sincronize o catálogo para incluir marcas recém-adicionadas."
      />
      <div className="mt-5 space-y-6">
        <nav className="flex flex-wrap gap-4" aria-label="Área de agentes">
          <Link href="/admin/agents">Fila de revisão</Link>
          <Link href="/admin/agents?tab=runs">Runs</Link>
          <Link href="/admin/agents/brands" aria-current="page">
            Marcas
          </Link>
        </nav>
        <BrandConnectorForm operation="add" label="Adicionar marca">
          <label className="ui-label">
            Marca
            <input className="ui-field" name="brand" required maxLength={100} />
          </label>
          <label className="ui-label">
            Mercado
            <input
              className="ui-field"
              name="market"
              required
              defaultValue="BR"
              pattern="[A-Za-z]{2}"
              maxLength={2}
            />
          </label>
        </BrandConnectorForm>
        <BrandConnectorForm operation="sync" label="Sincronizar marcas do catálogo" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  'Marca',
                  'Mercado',
                  'Origem',
                  'Monitoramento',
                  'Connector / versão',
                  'Última run',
                  'Ações',
                ].map((h) => (
                  <th className="p-3" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(({ target, active, latestRun }) => (
                <tr key={target.id} className="border-t border-border">
                  <td className="p-3">
                    <Link href={'/admin/agents/brands/' + target.id}>{target.brand}</Link>
                  </td>
                  <td className="p-3">{target.market}</td>
                  <td className="p-3">{target.origin === 'MANUAL' ? 'Manual' : 'Catálogo'}</td>
                  <td className="p-3">{target.enabled ? 'Monitorar' : 'Pausado'}</td>
                  <td className="p-3">{active ? 'ACTIVE v' + active.version : 'Ausente'}</td>
                  <td className="p-3">
                    {latestRun ? (
                      <Link href={'/admin/agents/runs/' + latestRun.id}>
                        {latestRun.status} · {latestRun.runMode}
                      </Link>
                    ) : (
                      'Sem execução'
                    )}
                  </td>
                  <td className="p-3">
                    <BrandConnectorForm
                      operation="enable"
                      label={target.enabled ? 'Pausar' : 'Monitorar'}
                      fields={{ targetId: target.id, enabled: String(!target.enabled) }}
                    />
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
