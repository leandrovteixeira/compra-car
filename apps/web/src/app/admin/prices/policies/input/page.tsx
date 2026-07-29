import Link from 'next/link';
import { requireRole } from '@/auth/authorization';
import { AdminPolicyBatchGrid } from '@/components/admin/admin-policy-batch-grid';
import { PageHeader } from '@/components/admin/page-header';
import { loadManualPolicyBatchOptions } from '@/server/manual-policy-batch-service';
import { createManualPolicyBatchAction } from './actions';
export default async function AdminPolicyInputPage() {
  await requireRole('admin');
  const options = await loadManualPolicyBatchOptions();
  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Entrada de policies em lote"
        description="Cadastre até 100 benefícios comerciais em uma operação atômica. Todas as policies nascem como rascunho."
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200"
            href="/admin/prices"
          >
            Voltar para preços
          </Link>
        }
      />
      <section className="mt-8">
        <AdminPolicyBatchGrid action={createManualPolicyBatchAction} {...options} />
      </section>
    </>
  );
}
