import { resolve } from 'node:path';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { runNewProductCheckCli } from './run-new-product-check';
import { runBrandConnectorCli } from './run-brand-connector';
import { runModelYearCli } from './run-model-year';
import { monitorBrandSources } from './source-monitor';

type JobRow = {
  id: string;
  job_type: string;
  status: string;
  market: string;
  brand: string;
  created_by?: string | null;
  input: {
    provider?: string;
    persistFindings?: boolean;
    marketReconcile?: boolean;
    marketModel?: string | null;
    mode?: 'discover' | 'health-check';
    parentRunId?: string;
  };
};

const env = process.env;
const stagingUrl = 'https://shfsjyjxmgwnlexmdkcs.supabase.co';

if (env.APP_ENV !== 'qa') throw new Error('AGENT_WORKER_QA_ONLY');
if (env.SUPABASE_URL !== stagingUrl) throw new Error('AGENT_WORKER_STAGING_REQUIRED');
if (!env.SUPABASE_SERVER_KEY?.trim()) throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_AGENT_MODEL?.trim())
  throw new Error('OPENAI_AGENT_CONFIG_REQUIRED');

const client = createLegacySupabaseClient({
  url: env.SUPABASE_URL,
  serverKey: env.SUPABASE_SERVER_KEY,
});

const repositoryRoot = resolve(process.cwd(), '../..');
const sleep = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function claim(): Promise<JobRow | null> {
  const { data, error } = await client.rpc('claim_next_agent_job');
  if (error) throw new Error('AGENT_JOB_CLAIM_FAILED');
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return (rows[0] as JobRow | undefined) ?? null;
}

async function complete(jobId: string, runId: string) {
  const { error } = await client.rpc('complete_agent_job', {
    p_job_id: jobId,
    p_run_id: runId,
  });
  if (error) throw new Error('AGENT_JOB_COMPLETE_FAILED');
}

async function completeWithoutRun(jobId: string) {
  const { error } = await client.rpc('complete_agent_job_without_run', {
    p_job_id: jobId,
  });
  if (error) throw new Error('AGENT_JOB_COMPLETE_FAILED');
}

async function fail(jobId: string, code: string) {
  const { error } = await client.rpc('fail_agent_job', {
    p_job_id: jobId,
    p_error: { code },
  });
  if (error) throw new Error('AGENT_JOB_FAIL_FAILED');
}

async function execute(job: JobRow) {
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    console.log('[agent-job]', job.id, line);
  };

  let code: number;
  if (job.job_type === 'MMV_DISCOVERY') {
    code = await runNewProductCheckCli(
      [
        '--brand',
        job.brand,
        '--provider',
        'openai',
        '--persist-findings',
        ...(job.input.marketReconcile ? ['--market-reconcile'] : []),
        ...(job.input.marketModel ? ['--market-model', job.input.marketModel] : []),
      ],
      env,
      log,
      repositoryRoot,
    );
  } else if (job.job_type === 'PRODUCT_YEAR') {
    code = await runModelYearCli(
      [
        '--brand',
        job.brand,
        '--provider',
        'openai',
        '--persist-findings',
        ...(job.input.parentRunId ? ['--parent-run-id', job.input.parentRunId] : []),
      ],
      env,
      log,
      repositoryRoot,
    );
  } else if (job.job_type === 'SOURCE_MONITOR') {
    const result = await monitorBrandSources(client, job.brand, job.market);
    console.log('[source-monitor]', job.id, JSON.stringify(result));
    if (result.changed > 0) {
      const { error } = await client.rpc('enqueue_ai_jobs_for_source_changes', {
        p_monitor_job_id: job.id,
        p_brand: job.brand,
        p_created_by: job.created_by,
        p_change_count: result.changed,
      });
      if (error) throw new Error('SOURCE_MONITOR_TRIGGER_FAILED');
    }
    await completeWithoutRun(job.id);
    return;
  } else if (job.job_type === 'BRAND_CONNECTOR') {
    code = await runBrandConnectorCli(
      [
        '--brand',
        job.brand,
        '--market',
        job.market,
        '--mode',
        job.input.mode ?? 'discover',
        '--provider',
        'openai',
        '--persist-findings',
      ],
      env,
      log,
      repositoryRoot,
    );
  } else {
    await fail(job.id, 'UNSUPPORTED_AGENT_JOB');
    return;
  }

  const runLine = logs.find((line) => line.startsWith('Run: '));
  const runId = runLine?.match(
    /^Run:\s+([0-9a-fA-F-]{36})(?:\s|$)/u,
  )?.[1] ?? null;

  if (code !== 0 || !runId) {
    await fail(
      job.id,
      logs.find(
        (line) =>
          line.startsWith('NEW_PRODUCT_CHECK_FAILED:') ||
          line.startsWith('BRAND_CONNECTOR_FAILED:') ||
          line.startsWith('Model Year run failed:'),
      ) ?? 'AGENT_JOB_EXECUTION_FAILED',
    );
    return;
  }
  await complete(job.id, runId);

  if (job.job_type === 'MMV_DISCOVERY') {
    const { error } = await client.rpc('enqueue_product_year_job', {
      p_brand: job.brand,
      p_created_by: job.created_by,
      p_parent_run_id: runId,
    });
    if (error) {
      console.error('[agent-worker] could not enqueue PRODUCT_YEAR', job.id, error);
    }
  }
}

console.log('[agent-worker] started');

for (;;) {
  try {
    const job = await claim();
    if (!job) {
      await sleep(2000);
      continue;
    }
    console.log('[agent-worker] claimed', job.id, job.brand);
    try {
      await execute(job);
    } catch (error) {
      console.error('[agent-worker] execution failed', job.id, error);
      try {
        await fail(job.id, 'AGENT_JOB_EXECUTION_FAILED');
      } catch (failError) {
        console.error('[agent-worker] could not mark failed', job.id, failError);
      }
    }
  } catch (error) {
    console.error('[agent-worker] loop error', error);
    await sleep(5000);
  }
}
