'use server';

import { requireFeatureWrite23C } from '@/auth/account-tier-server';
import type { StructuredPoliciesResult } from '@/application/admin/structured-policies';
import { previewStructuredPolicies } from '@/server/structured-policies-preview';
import {
  loadCommercialOperatorCatalog,
  type OperatorCatalogResult,
} from '@/server/commercial-operator-catalog';

export async function loadOperatorMatchingCatalog(): Promise<OperatorCatalogResult> {
  await requireFeatureWrite23C('settings');
  return loadCommercialOperatorCatalog();
}

export async function validateStructuredPolicies(
  formData: FormData,
): Promise<StructuredPoliciesResult> {
  await requireFeatureWrite23C('settings');
  const file = formData.get('file');
  if (!(file instanceof File))
    return { status: 'UNSUPPORTED_FILE', message: 'Selecione um arquivo .xlsx.' };
  return previewStructuredPolicies(file);
}
