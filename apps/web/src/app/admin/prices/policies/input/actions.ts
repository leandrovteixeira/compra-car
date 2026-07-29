'use server';
import type { ManualPolicyBatchActionStateDto } from '@compra-car/contracts';
import { saveManualPolicyBatch } from '@/server/manual-policy-batch-service';
export async function createManualPolicyBatchAction(
  _state: ManualPolicyBatchActionStateDto,
  formData: FormData,
) {
  return saveManualPolicyBatch(formData);
}
