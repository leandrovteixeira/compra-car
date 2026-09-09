'use server';

import { requireRole } from '@/auth/authorization';
import type { StructuredPoliciesResult } from '@/application/admin/structured-policies';
import { previewStructuredPolicies } from '@/server/structured-policies-preview';

export async function validateStructuredPolicies(
  formData: FormData,
): Promise<StructuredPoliciesResult> {
  await requireRole('admin');
  const file = formData.get('file');
  if (!(file instanceof File))
    return { status: 'UNSUPPORTED_FILE', message: 'Selecione um arquivo .xlsx.' };
  return previewStructuredPolicies(file);
}
