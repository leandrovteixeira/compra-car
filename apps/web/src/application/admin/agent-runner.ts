import 'server-only';

import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export interface AgentLaunchState {
  readonly status: 'idle' | 'success' | 'error';
  readonly message: string;
  readonly jobId: string | null;
}

export interface AgentJobListItem {
  readonly id: string;
  readonly jobType: string;
  readonly status: string;
  readonly brand: string;
  readonly input: Record<string, unknown>;
  readonly runId: string | null;
  readonly error: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly claimedAt: string | null;
  readonly completedAt: string | null;
}

function inputText(data: FormData, name: string, maxLength: number): string {
  const value = data.get(name);
  if (typeof value !== 'string') throw new Error('INVALID_INPUT');
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error('INVALID_INPUT');
  return trimmed;
}

export async function launchMmvDiscovery(
  data: FormData,
): Promise<AgentLaunchState> {
  const { profile } = await requireRole('admin');

  if (process.env.APP_ENV !== 'qa') {
    return {
      status: 'error',
      message: 'Execução bloqueada: este launcher só funciona no ambiente QA.',
      jobId: null,
    };
  }

  try {
    const brand = inputText(data, 'brand', 100);
    const marketReconcile = data.get('marketReconcile') === 'on';
    const marketModelRaw = data.get('marketModel');
    const marketModel =
      typeof marketModelRaw === 'string' && marketModelRaw.trim()
        ? marketModelRaw.trim()
        : null;
    if (marketModel && (!marketReconcile || marketModel.length > 200))
      throw new Error('INVALID_INPUT');

    const client = createPrivilegedAdminClient();
    const { data: job, error } = await client.rpc('enqueue_mmv_discovery_job', {
      p_brand: brand,
      p_market_reconcile: marketReconcile,
      p_market_model: marketModel,
      p_created_by: profile.id,
    });
    if (error || !job || typeof job !== 'object')
      throw new Error(error?.message || 'AGENT_JOB_ENQUEUE_FAILED');

    const row = job as { id?: unknown };
    return {
      status: 'success',
      message: 'Job enfileirado no QA. Acompanhe o progresso na aba Runs.',
      jobId: typeof row.id === 'string' ? row.id : null,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('AGENT_JOB_ALREADY_ACTIVE')
        ? 'Já existe uma execução ativa desta marca no QA.'
        : 'Não foi possível enfileirar a run. Verifique marca, modelo e configuração do QA.';
    return { status: 'error', message, jobId: null };
  }
}

export async function loadAgentJobs(limit = 20): Promise<readonly AgentJobListItem[]> {
  await requireRole('admin');
  const client = createPrivilegedAdminClient();
  const { data, error } = await client
    .from('agent_jobs')
    .select('id,job_type,status,brand,input,run_id,error,created_at,claimed_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    brand: row.brand,
    input: (row.input ?? {}) as Record<string, unknown>,
    runId: row.run_id,
    error: (row.error ?? null) as Record<string, unknown> | null,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
    completedAt: row.completed_at,
  }));
}
