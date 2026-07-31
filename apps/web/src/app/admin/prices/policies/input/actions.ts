'use server';
import type { ManualPolicyBatchActionStateDto } from '@compra-car/contracts';
import { saveManualPolicyBatch } from '@/server/manual-policy-batch-service';
import {
  archiveWorkspaceOffer as archiveOffer,
  archiveWorkspacePolicy as archivePolicy,
  replaceWorkspaceOffer as replaceOffer,
  updateWorkspacePolicy as updatePolicy,
} from '@/server/commercial-policy-workspace-service';

export async function updateWorkspacePolicy(formData: FormData) {
  return updatePolicy(formData);
}

export async function archiveWorkspacePolicy(formData: FormData) {
  return archivePolicy(formData);
}

export async function replaceWorkspaceOffer(formData: FormData) {
  return replaceOffer(formData);
}

export async function archiveWorkspaceOffer(formData: FormData) {
  return archiveOffer(formData);
}

export async function createManualPolicyBatchAction(
  _state: ManualPolicyBatchActionStateDto,
  formData: FormData,
) {
  return saveManualPolicyBatch(formData);
}
