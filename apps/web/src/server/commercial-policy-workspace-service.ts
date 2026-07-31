import 'server-only';

import { CommercialOfferBuilderSupabaseAdapter } from '@compra-car/adapter-supabase';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { canonicalAmountFromPtBr } from '@/application/admin/product-public-price-form';
import { requireRole } from '@/auth/authorization';

export interface WorkspaceMutationResult {
  readonly ok: boolean;
  readonly message: string;
}

const positiveId = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '');
  return /^\d+$/u.test(text) ? text : null;
};

async function context() {
  const { profile } = await requireRole('admin');
  return { actorId: profile.id, correlationId: randomUUID() };
}

function refreshWorkspace() {
  revalidatePath('/admin/prices/policies/input');
  revalidatePath('/admin/prices/offers');
}

export async function updateWorkspacePolicy(formData: FormData): Promise<WorkspaceMutationResult> {
  const policyId = positiveId(formData.get('policyId'));
  const expectedLockVersion = Number(formData.get('lockVersion'));
  if (!policyId || !Number.isSafeInteger(expectedLockVersion) || expectedLockVersion < 1)
    return { ok: false, message: 'Política inválida ou desatualizada.' };
  const changes: Record<string, string> = {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    startsOn: String(formData.get('startsOn') ?? ''),
    endsOn: String(formData.get('endsOn') ?? ''),
  };
  const amount = String(formData.get('amount') ?? '').trim();
  if (amount) {
    const canonicalAmount = canonicalAmountFromPtBr(amount);
    changes.customerBenefitAmount = canonicalAmount;
    changes.fixedAmount = canonicalAmount;
  }
  const mutation = await context();
  try {
    await new CommercialOfferBuilderSupabaseAdapter().updatePolicyDraft({
      policyId,
      expectedLockVersion,
      changes,
      ...mutation,
    });
    refreshWorkspace();
    return { ok: true, message: 'Política atualizada com sucesso.' };
  } catch (error) {
    console.error('Commercial policy draft update failed.', {
      correlationId: mutation.correlationId,
      error,
    });
    refreshWorkspace();
    return {
      ok: false,
      message:
        'A política não pôde ser atualizada. Ela pode estar em uso ou ter sido alterada por outro operador.',
    };
  }
}

export async function archiveWorkspacePolicy(formData: FormData): Promise<WorkspaceMutationResult> {
  const policyId = positiveId(formData.get('policyId'));
  const expectedLockVersion = Number(formData.get('lockVersion'));
  if (!policyId || !Number.isSafeInteger(expectedLockVersion))
    return { ok: false, message: 'Política inválida.' };
  const mutation = await context();
  try {
    await new CommercialOfferBuilderSupabaseAdapter().archivePolicy({
      policyId,
      expectedLockVersion,
      ...mutation,
    });
    refreshWorkspace();
    return { ok: true, message: 'Política arquivada com sucesso.' };
  } catch (error) {
    console.error('Commercial policy archive failed.', {
      correlationId: mutation.correlationId,
      error,
    });
    refreshWorkspace();
    return {
      ok: false,
      message:
        'A política não pôde ser arquivada. Remova-a das combinações ativas e tente novamente.',
    };
  }
}

export async function replaceWorkspaceOffer(formData: FormData): Promise<WorkspaceMutationResult> {
  const offerId = positiveId(formData.get('offerId'));
  const expectedLockVersion = Number(formData.get('lockVersion'));
  let policyIds: unknown;
  try {
    policyIds = JSON.parse(String(formData.get('policyIds') ?? '[]'));
  } catch {
    policyIds = null;
  }
  if (
    !offerId ||
    !Number.isSafeInteger(expectedLockVersion) ||
    !Array.isArray(policyIds) ||
    !policyIds.length ||
    !policyIds.every((id) => /^\d+$/u.test(String(id)))
  )
    return { ok: false, message: 'Combinação inválida.' };
  const mutation = await context();
  try {
    await new CommercialOfferBuilderSupabaseAdapter().replaceOfferDraft({
      offerId,
      expectedLockVersion,
      policyIds: policyIds.map(String),
      ...mutation,
    });
    refreshWorkspace();
    return { ok: true, message: 'Combinação atualizada com sucesso.' };
  } catch (error) {
    console.error('Commercial offer replacement failed.', {
      correlationId: mutation.correlationId,
      error,
    });
    refreshWorkspace();
    return {
      ok: false,
      message:
        'A combinação não pôde ser atualizada. Os dados foram recarregados sem sobrescrever alterações concorrentes.',
    };
  }
}

export async function archiveWorkspaceOffer(formData: FormData): Promise<WorkspaceMutationResult> {
  const offerId = positiveId(formData.get('offerId'));
  const expectedLockVersion = Number(formData.get('lockVersion'));
  if (!offerId || !Number.isSafeInteger(expectedLockVersion))
    return { ok: false, message: 'Combinação inválida.' };
  const mutation = await context();
  try {
    await new CommercialOfferBuilderSupabaseAdapter().archiveOffer({
      offerId,
      expectedLockVersion,
      ...mutation,
    });
    refreshWorkspace();
    return { ok: true, message: 'Combinação arquivada com sucesso.' };
  } catch (error) {
    console.error('Commercial offer archive failed.', {
      correlationId: mutation.correlationId,
      error,
    });
    refreshWorkspace();
    return {
      ok: false,
      message: 'A combinação não pôde ser arquivada. Os dados foram recarregados.',
    };
  }
}
