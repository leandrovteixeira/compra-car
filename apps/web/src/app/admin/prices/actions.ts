'use server';

import type { ProductPublicPriceActionStateDto } from '@compra-car/contracts';

import {
  saveExistingAdminProductPublicPrice,
  saveNewAdminProductPublicPrice,
} from '@/server/save-admin-product-public-price';
import { publishAdminProductPublicPrice } from '@/server/admin-product-public-price-service';

export async function createProductPublicPriceAction(
  _previousState: ProductPublicPriceActionStateDto,
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  return saveNewAdminProductPublicPrice(formData);
}

export async function updateProductPublicPriceAction(
  _previousState: ProductPublicPriceActionStateDto,
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  return saveExistingAdminProductPublicPrice(formData);
}

export async function publishProductPublicPriceAction(formData: FormData) {
  return publishAdminProductPublicPrice(formData);
}

/** Direct correction of a published record, with immutable before/after audit in QA. */
export async function correctPublishedProductPublicPriceAction(
  _previousState: ProductPublicPriceActionStateDto,
  formData: FormData,
): Promise<ProductPublicPriceActionStateDto> {
  const { requireRole } = await import('@/auth/authorization');
  const { createLegacySupabaseClientFromEnv } = await import('@compra-car/adapter-supabase');
  const { canonicalAmountFromPtBr, readProductPublicPriceForm } =
    await import('@/application/admin/product-public-price-form');
  const { revalidatePath } = await import('next/cache');
  const { randomUUID } = await import('node:crypto');
  const values = readProductPublicPriceForm(formData);
  const fail = (message: string): ProductPublicPriceActionStateDto => ({
    status: 'error', values, fieldErrors: {}, message,
  });
  const id = Number(values.id);
  const version = Number(values.lockVersion);
  const amount = Number(canonicalAmountFromPtBr(values.amount));
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(version) || version < 1)
    return fail('Registro desatualizado. Recarregue a página e tente novamente.');
  if (!Number.isFinite(amount) || amount <= 0)
    return fail('Informe um preço válido maior que zero.');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(values.startsOn) ||
      (values.endsOn && values.endsOn < values.startsOn))
    return fail('Revise as datas de vigência.');
  const { profile } = await requireRole('admin');
  try {
    const { error } = await createLegacySupabaseClientFromEnv().rpc(
      'correct_published_product_public_price',
      {
        p_price_id: id, p_actor_id: profile.id, p_expected_lock_version: version,
        p_amount: amount, p_starts_on: values.startsOn, p_ends_on: values.endsOn || null,
        p_reason: 'Correção administrativa de valor ou vigência informados no cadastro',
        p_correlation_id: randomUUID(),
      },
    );
    if (error) {
      console.error('Audited price correction rejected.', { priceId: id, code: error.code });
      if (error.code === '23505') return fail('Há outro preço publicado nesta vigência. Corrija o período sem sobreposição.');
      if (error.code === '40001') return fail('Este preço foi alterado. Atualize a página antes de corrigir.');
      return fail('A correção foi recusada. Confira as datas ou atualize o registro.');
    }
    revalidatePath('/admin/prices');
    return { status: 'success', values, fieldErrors: {}, message: 'Preço corrigido. Alteração registrada na auditoria.' };
  } catch {
    return fail('Não foi possível registrar a correção. Nenhum valor foi alterado.');
  }
}
