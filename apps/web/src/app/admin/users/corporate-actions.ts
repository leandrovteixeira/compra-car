'use server';

import { revalidatePath } from 'next/cache';

import { requireFeature23C } from '@/auth/account-tier-server';
import { createMutableServerClient } from '@/auth/server-client';

export interface CorporateReviewState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message?: string;
}

export async function reviewCorporateRequest(
  _state: CorporateReviewState,
  form: FormData,
): Promise<CorporateReviewState> {
  await requireFeature23C('settings');
  const requestId = form.get('requestId');
  const decision = form.get('decision');
  const organizationName = form.get('organizationName');

  if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId) ||
      (decision !== 'approved' && decision !== 'rejected') ||
      (decision === 'approved' && (
        typeof organizationName !== 'string' ||
        organizationName.trim().length < 2 ||
        organizationName.trim().length > 160
      ))) {
    return { status: 'error', message: 'Dados da decisão inválidos.' };
  }

  const client = await createMutableServerClient();
  const { data, error } = await client.rpc('review_corporate_upgrade_23c_v2', {
    p_request: requestId,
    p_decision: decision,
    p_org_name: decision === 'approved' && typeof organizationName === 'string'
      ? organizationName.trim()
      : null,
  });
  if (error) return { status: 'error', message: 'A decisão não foi aplicada. Verifique permissões e status.' };
  if (data !== true) return { status: 'error', message: 'Solicitação não está mais pendente.' };

  revalidatePath('/admin/users');
  return { status: 'success', message: decision === 'approved' ? 'Corporate aprovado.' : 'Solicitação rejeitada.' };
}
