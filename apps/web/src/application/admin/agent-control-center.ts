import 'server-only';

import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';

export type AgentFamilyHealth = Readonly<{
  key: 'BRAND' | 'MMV' | 'MODEL_YEAR' | 'WATCHER';
  label: string;
  status: 'HEALTHY' | 'ATTENTION' | 'IDLE';
  pending: number;
  lastActivityAt: string | null;
  detail: string;
}>;

export type AgentControlCenterSummary = Readonly<{
  pendingDecisions: number;
  operationalFailures: number;
  activeJobs: number;
  families: readonly AgentFamilyHealth[];
}>;

async function pendingForTypes(client: ReturnType<typeof createPrivilegedAdminClient>, types: readonly string[]) {
  const { data: findings, error } = await client
    .from('agent_findings')
    .select('id,run_id')
    .eq('requires_review', true);
  if (error || !findings?.length) return 0;

  const runIds = [...new Set(findings.map((f) => f.run_id))];
  const { data: runs, error: runError } = await client
    .from('agent_runs')
    .select('id,agent_type')
    .in('id', runIds);
  if (runError || !runs) return 0;

  const allowedRunIds = new Set(runs.filter((r) => types.includes(r.agent_type)).map((r) => r.id));
  const candidateIds = findings.filter((f) => allowedRunIds.has(f.run_id)).map((f) => f.id);
  if (!candidateIds.length) return 0;

  const { data: reviews, error: reviewError } = await client
    .from('agent_reviews')
    .select('finding_id')
    .in('finding_id', candidateIds);
  if (reviewError) return candidateIds.length;
  const reviewed = new Set((reviews ?? []).map((r) => r.finding_id));
  return candidateIds.filter((id) => !reviewed.has(id)).length;
}

async function lastRunForTypes(
  client: ReturnType<typeof createPrivilegedAdminClient>,
  types: readonly string[],
) {
  const { data } = await client
    .from('agent_runs')
    .select('created_at,status,agent_type')
    .in('agent_type', types)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function loadAgentControlCenterSummary(): Promise<AgentControlCenterSummary> {
  await requireRole('admin');
  const client = createPrivilegedAdminClient();

  const [brandPending, mmvPending, yearPending, brandRun, mmvRun, yearRun, jobs] =
    await Promise.all([
      pendingForTypes(client, ['BRAND_CONNECTOR']),
      pendingForTypes(client, ['MMV_DISCOVERY']),
      pendingForTypes(client, ['MODEL_YEAR', 'PRODUCT_YEAR']),
      lastRunForTypes(client, ['BRAND_CONNECTOR']),
      lastRunForTypes(client, ['MMV_DISCOVERY']),
      lastRunForTypes(client, ['MODEL_YEAR', 'PRODUCT_YEAR']),
      client
        .from('agent_jobs')
        .select('status')
        .in('status', ['QUEUED', 'RUNNING']),
    ]);

  let watcherPending = 0;
  let watcherLastActivityAt: string | null = null;
  let watcherFailures = 0;
  let watcherStatus: AgentFamilyHealth['status'] = 'IDLE';
  let watcherDetail = 'Sem inteligência disponível para revisão.';

  if (process.env.APP_ENV === 'qa') {
    const [candidates, schedule, aiJobs] = await Promise.all([
      client.from('watcher_intelligence_candidates').select('event_key'),
      client
        .from('watcher_schedule_jobs')
        .select('status,completed_at,created_at,error_code')
        .order('created_at', { ascending: false })
        .limit(1),
      client
        .from('watcher_ai_revision_jobs')
        .select('state,finished_at,claimed_at,failure_code')
        .order('claimed_at', { ascending: false })
        .limit(10),
    ]);
    watcherPending = candidates.data?.length ?? 0;
    const latestSchedule = schedule.data?.[0];
    watcherLastActivityAt = latestSchedule?.completed_at ?? latestSchedule?.created_at ?? null;
    watcherFailures = (aiJobs.data ?? []).filter((job) => job.state === 'FAILED').length;
    watcherStatus =
      latestSchedule?.status === 'COMPLETED' && watcherFailures === 0
        ? 'HEALTHY'
        : latestSchedule
          ? 'ATTENTION'
          : 'IDLE';
    watcherDetail =
      watcherFailures > 0
        ? watcherFailures + ' falha(s) recente(s) na etapa de inteligência.'
        : latestSchedule?.status === 'COMPLETED'
          ? 'Coleta e scheduler operacionais.'
          : 'Sem execução recente.';
  }

  const family = (
    key: AgentFamilyHealth['key'],
    label: string,
    pending: number,
    run: { created_at: string; status: string } | null,
    detail: string,
  ): AgentFamilyHealth => ({
    key,
    label,
    pending,
    lastActivityAt: run?.created_at ?? null,
    status: run ? (run.status === 'FAILED' ? 'ATTENTION' : 'HEALTHY') : 'IDLE',
    detail,
  });

  const families: AgentFamilyHealth[] = [
    family('BRAND', 'Brand Connector', brandPending, brandRun, 'Fontes, domínios e identidade da marca.'),
    family('MMV', 'MMV', mmvPending, mmvRun, 'Modelos, versões e reconciliação de identidade.'),
    family(
      'MODEL_YEAR',
      'Ano-modelo',
      yearPending,
      yearRun,
      'MODEL_YEAR histórico e PRODUCT_YEAR atual apresentados como uma família.',
    ),
    {
      key: 'WATCHER',
      label: 'Watcher',
      pending: watcherPending,
      lastActivityAt: watcherLastActivityAt,
      status: watcherStatus,
      detail: watcherDetail,
    },
  ];

  return {
    pendingDecisions: families.reduce((sum, item) => sum + item.pending, 0),
    operationalFailures:
      families.filter((item) => item.status === 'ATTENTION').length + Math.max(0, watcherFailures - 1),
    activeJobs: jobs.data?.length ?? 0,
    families,
  };
}
