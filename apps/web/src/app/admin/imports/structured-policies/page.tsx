import { requireRole } from '@/auth/authorization';
import { PageHeader } from '@/components/admin/page-header';
import { StructuredPoliciesForm } from '@/components/admin/structured-policies-form';

export const runtime = 'nodejs';

export default async function StructuredPoliciesPage() {
  await requireRole('admin');
  return (
    <>
      <PageHeader
        eyebrow="Importações"
        title="Políticas estruturadas (Excel)"
        description="Importe um arquivo Excel no formato CommercialImportContract/1 para validar produtos, políticas, ofertas e evidências antes da publicação."
      />
      <StructuredPoliciesForm />
    </>
  );
}
