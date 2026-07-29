'use server';

import type { ManualPriceBatchActionStateDto } from '@compra-car/contracts';

import { saveManualPriceBatch } from '@/server/manual-price-batch-service';

export async function createManualPriceBatchAction(
  _previousState: ManualPriceBatchActionStateDto,
  formData: FormData,
): Promise<ManualPriceBatchActionStateDto> {
  return saveManualPriceBatch(formData);
}
