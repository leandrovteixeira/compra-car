'use server';

import type { ManualPriceBatchActionStateDto } from '@compra-car/contracts';
import { randomUUID } from 'node:crypto';

import { saveManualPriceBatch } from '@/server/manual-price-batch-service';
import {
  EMPTY_MANUAL_PRICE_BATCH_ROW,
  readManualPriceBatchRows,
} from '@/application/admin/manual-price-batch';

export async function createManualPriceBatchAction(
  _previousState: ManualPriceBatchActionStateDto,
  formData: FormData,
): Promise<ManualPriceBatchActionStateDto> {
  const actionCorrelationId = randomUUID();
  try {
    const result = await saveManualPriceBatch(formData);
    // Server Actions must cross the React transport boundary as plain JSON data.
    return JSON.parse(JSON.stringify(result)) as ManualPriceBatchActionStateDto;
  } catch (error) {
    console.error('Manual price batch Server Action failed.', { actionCorrelationId, error });
    return {
      status: 'error',
      rows: readManualPriceBatchRows(formData) ?? [{ ...EMPTY_MANUAL_PRICE_BATCH_ROW }],
      rowErrors: {},
      message: `Não foi possível salvar os preços. Referência: ${actionCorrelationId}`,
    };
  }
}
