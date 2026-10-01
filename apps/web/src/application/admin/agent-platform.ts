import 'server-only';
import { AgentPlatformSupabaseAdapter } from '@compra-car/adapter-supabase';
import {
  AgentPlatformError,
  assertAgentUuid,
  AGENT_REVIEW_DECISIONS,
  type AgentPlatformRepository,
  type AgentFindingListOptions,
  type AgentListOptions,
  type AgentReviewDecision,
} from '@compra-car/core/agent-platform';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
export interface AgentAdminDependencies {
  readonly authorize: () => Promise<{ readonly profile: { readonly id: string } }>;
  readonly repository: () => AgentPlatformRepository;
  readonly revalidate: (path: string) => void;
}
const defaults: AgentAdminDependencies = {
  authorize: () => requireRole('admin'),
  repository: () => new AgentPlatformSupabaseAdapter(createPrivilegedAdminClient()),
  revalidate: revalidatePath,
};
export async function loadAgentQueue(options: AgentFindingListOptions = {}, deps = defaults) {
  await deps.authorize();
  return deps
    .repository()
    .listFindings({ ...options, requiresReview: true, review: options.review ?? 'OPEN' });
}
export async function loadAgentRuns(options: AgentListOptions = {}, deps = defaults) {
  await deps.authorize();
  return deps.repository().listRuns(options);
}
export async function loadAgentRun(id: string, deps = defaults) {
  await deps.authorize();
  return deps.repository().getRun(id);
}
export async function loadAgentFinding(id: string, deps = defaults) {
  await deps.authorize();
  return deps.repository().getFinding(id);
}
export interface AgentReviewActionState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message: string;
}
export async function reviewAgentFinding(
  data: FormData,
  deps = defaults,
): Promise<AgentReviewActionState> {
  const { profile } = await deps.authorize();
  let runId: string;
  let findingId: string;
  try {
    const id = data.get('findingId'),
      decision = data.get('decision'),
      note = data.get('note');
    if (
      typeof id !== 'string' ||
      typeof decision !== 'string' ||
      !AGENT_REVIEW_DECISIONS.includes(decision as AgentReviewDecision) ||
      (note !== null && typeof note !== 'string')
    )
      throw new AgentPlatformError('INVALID_INPUT');
    assertAgentUuid(id);
    findingId = id;
    if (typeof note === 'string' && note.length > 4000)
      throw new AgentPlatformError('INVALID_INPUT');
    const repository = deps.repository();
    const detail = await repository.getFinding(id);
    if (!detail) throw new AgentPlatformError('NOT_FOUND');
    runId = detail.run.id;
    await repository.addReview({
      findingId: id,
      decision: decision as AgentReviewDecision,
      note: note as string | null,
      reviewedBy: profile.id,
    });
  } catch (error) {
    if (error instanceof AgentPlatformError && error.code === 'INVALID_INPUT')
      return { status: 'error', message: 'Confira a decisão e a nota (até 4.000 caracteres).' };
    return {
      status: 'error',
      message:
        'Não foi possível confirmar o registro da decisão. Recarregue o histórico antes de tentar novamente.',
    };
  }
  try {
    for (const route of [
      '/admin/agents',
      '/admin/agents/runs/' + runId,
      '/admin/agents/findings/' + findingId,
    ])
      deps.revalidate(route);
  } catch {
    return {
      status: 'success',
      message:
        'Decisão registrada. Recarregue a página para atualizar o histórico. Esta decisão não altera o catálogo.',
    };
  }
  return { status: 'success', message: 'Decisão registrada. Esta decisão não altera o catálogo.' };
}
