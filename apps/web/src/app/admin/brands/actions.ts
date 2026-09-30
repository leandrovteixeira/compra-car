'use server';

import type { BrandMonitoringActionState } from '@/application/admin/brand-monitoring';
import { createMonitoredBrand } from '@/server/brand-monitoring';

export async function createMonitoredBrandAction(
  state: BrandMonitoringActionState,
  formData: FormData,
) {
  return createMonitoredBrand(state, formData);
}
