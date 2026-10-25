'use server';
import {
  reviewAgentFinding,
  type AgentReviewActionState,
} from '@/application/admin/agent-platform';
export async function reviewAgentFindingAction(_state: AgentReviewActionState, data: FormData) {
  return reviewAgentFinding(data);
}
