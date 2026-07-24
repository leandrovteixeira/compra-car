import 'server-only';

import { LegacySupabaseAdapter } from '@compra-car/adapter-supabase';
import type {
  AdministrativeProductSpecsModel,
  AdministrativeSpecSubmission,
} from '@compra-car/contracts';
import { LoadAdministrativeProductSpecs, SaveAdministrativeProductSpecs } from '@compra-car/core';
import { revalidatePath } from 'next/cache';

import { requireRole } from '@/auth/authorization';

export type SaveAdminProductSpecsResult =
  | { readonly ok: true; readonly model: AdministrativeProductSpecsModel }
  | { readonly ok: false; readonly message: string };

export async function loadAdminProductSpecs(id: string): Promise<AdministrativeProductSpecsModel> {
  await requireRole('admin');
  return new LoadAdministrativeProductSpecs(new LegacySupabaseAdapter()).execute(id);
}

export async function saveAdminProductSpecs(
  id: string,
  submissions: readonly AdministrativeSpecSubmission[],
): Promise<SaveAdminProductSpecsResult> {
  await requireRole('admin');
  const repository = new LegacySupabaseAdapter();
  try {
    await new SaveAdministrativeProductSpecs(repository).execute(id, submissions);
    revalidatePath(`/admin/products/${id}/specs`);
    const model = await new LoadAdministrativeProductSpecs(repository).execute(id);
    return { ok: true, model };
  } catch {
    console.error('Administrative product specs could not be saved.');
    return {
      ok: false,
      message: 'Não foi possível salvar as alterações. Revise os valores e tente novamente.',
    };
  }
}
