'use server';
import {
  applyAcceptedMmvFinding,
  type MmvApplyActionState,
} from '@/application/admin/mmv-catalog';

export async function applyMmvFindingAction(
  _state: MmvApplyActionState,
  data: FormData,
): Promise<MmvApplyActionState> {
  return applyAcceptedMmvFinding(data);
}
