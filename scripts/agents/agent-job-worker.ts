import { resolve } from 'node:path';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { runNewProductCheckCli } from './run-new-product-check';

type JobRow = {
  id: string;
  job_type: string;
  status: string;
  market: string;
  brand: string;
  input: {
    provider?: string;
    persistFindings?: boolean;
    marketReconcile?: boolean;
    marketModel?: string | null;
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

async function fail(jobId: string, code: string) {
  const { error } = await client.rpc('fail_agent_job', {
    p_job_id: jobId,
    p_error: { code },
  });
  if (error) throw new Error('AGENT_JOB_FAIL_FAILED');
}

async function execute(job: JobRow) {
  if (job.job_type !== 'MMV_DISCOVERY') {
    await fail(job.id, 'UNSUPPORTED_AGENT_JOB');
    return;
  }

  const args = [
    '--brand',
    job.brand,
    '--provider',
    'openai',
    '--persist-findings',
    ...(job.input.marketReconcile ? ['--market-reconcile'] : []),
    ...(job.input.marketModel ? ['--market-model', job.input.marketModel] : []),
  ];

  const logs: string[] = [];
  const code = await runNewProductCheckCli(
    args,
    env,
    (line) => {
      logs.push(line);
      console.log('[agent-job]', job.id, line);
    },
    repositoryRoot,
  );
  const runId =
    logs.find((line) => line.startsWith('Run: '))?.slice('Run: '.length).trim() ?? null;

  if (code !== 0 || !runId) {
    await fail(
      job.id,
      logs.find((line) => line.startsWith('NEW_PRODUCT_CHECK_FAILED:')) ??
        'AGENT_JOB_EXECUTION_FAILED',
    );
    return;
  }
  await complete(job.id, runId);
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
