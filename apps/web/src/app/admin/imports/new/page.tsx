import { randomUUID } from 'node:crypto';
import type { ImportBatchActionStateDto } from '@compra-car/contracts';

import { requireRole } from '@/auth/authorization';
import { AdminImportForm } from '@/components/admin/admin-import-form';
import { PageHeader } from '@/components/admin/page-header';
import { createImportBatchAction } from '../actions';

export default async function NewAdminImportPage() {
  await requireRole('admin');
  const initialState: ImportBatchActionStateDto = {
    status: 'idle',
    values: {
      title: '',
      competence: '',
      notes: '',
      idempotencyKey: randomUUID(),
      acknowledgeDuplicates: false,
    },
    fieldErrors: {},
    duplicates: [],
  };
  return (
    <>
      <PageHeader
        description="Crie um dossiê com uma carta principal, erratas, complementos e anexos."
        eyebrow="Import Engine"
        title="Nova importação"
      />
      <div className="mt-7">
        <AdminImportForm action={createImportBatchAction} initialState={initialState} />
      </div>
    </>
  );
}
