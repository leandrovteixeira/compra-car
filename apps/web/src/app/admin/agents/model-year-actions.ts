'use server';
import {
  applyAcceptedModelYearFinding,
  type ModelYearApplyActionState,
} from '@/application/admin/model-year-catalog';

export async function applyModelYearFindingAction(
  _state: ModelYearApplyActionState,
  data: FormData,
): Promise<ModelYearApplyActionState> {
  return applyAcceptedModelYearFinding(data);
}
