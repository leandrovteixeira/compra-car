'use server';

import type { AdministrativeSpecSubmission } from '@compra-car/contracts';

import { saveAdminProductSpecs } from '@/server/admin-product-specs';

export async function saveAdminProductSpecsAction(
  id: string,
  submissions: readonly AdministrativeSpecSubmission[],
) {
  return saveAdminProductSpecs(id, submissions);
}
