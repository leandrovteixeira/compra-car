import { notFound } from 'next/navigation';
import Link from 'next/link';
import { loadBrandConnectorDetail } from '@/application/admin/brand-connectors';
import { BrandConnectorView } from '@/components/admin/brand-connector-view';
import { PageHeader } from '@/components/admin/page-header';
import { agentDate } from '@/components/admin/agent-platform-views';
export default async function BrandConnectorDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    detail = await loadBrandConnectorDetail(id);
  if (!detail) notFound();
  return (
    <>
      <PageHeader
        title={detail.target.brand + ' / ' + detail.target.market}
        description="Configuração operacional e histórico de versões."
      />
      <div className="mt-5 space-y-6">
        <Link href="/admin/agents/brands">Voltar às marcas</Link>
        <p>
          {detail.target.enabled ? 'Monitorar' : 'Pausado'} · {detail.target.origin}
        </p>
        {!detail.versions.length ? (
          <p>Connector ausente. Execute discovery, revise a proposta e use Ativar connector.</p>
        ) : null}
        {detail.versions.map((c) => (
          <section key={c.id} className="ui-surface space-y-4 p-4">
            <h2 className="text-xl font-semibold">
              {c.status} · v{c.version}
            </h2>
            <p>
              Ativação: {agentDate(c.activatedAt)} · Operador:{' '}
              {c.activatedBy ?? 'Bootstrap controlado'}
            </p>
            {c.supersededAt ? <p>Substituído em {agentDate(c.supersededAt)}</p> : null}
            {c.sourceFindingId ? (
              <Link href={'/admin/agents/findings/' + c.sourceFindingId}>Finding de origem</Link>
            ) : null}
            <BrandConnectorView value={c} />
          </section>
        ))}
      </div>
    </>
  );
}
