/**
 * Explicitly queued, QA-only GWM Brand Connector smoke.
 *
 * Run from the VS Code terminal with:
 * pnpm --filter @compra-car/agents exec tsx enqueue-gwm-brand-qa.ts --check
 * pnpm --filter @compra-car/agents exec tsx enqueue-gwm-brand-qa.ts --enqueue
 *
 * Enqueues a job for the existing Railway worker; never calls OpenAI here.
 * Uses Supabase QA server credentials from apps/web/.env.local or the
 * COMPRA_CAR_AGENT_ENV_FILE override. No secret values are ever logged.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { loadAgentEnvironment } from './agent-environment';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const QA_URL = 'https://shfsjyjxmgwnlexmdkcs.supabase.co';
const BUDGET_KEY = 'qa:BR:GWM:BRAND_CONNECTOR';
const JOB_TYPE = 'BRAND_CONNECTOR';

export function gwmDiscoveryJob(createdBy: string | null) {
  return {
    job_type: JOB_TYPE,
    status: 'QUEUED',
    market: 'BR',
    brand: 'GWM',
    created_by: createdBy,
    input: {
      provider: 'openai',
      persistFindings: true,
      mode: 'discover',
      requestedFrom: 'VSCODE_QA_GWM_PILOT',
    },
  } as const;
}

export function parseGwmEnqueueArgs(args: readonly string[]) {
  if (args.length === 1 && args[0] === '--check')
    return { enqueue: false, createdBy: null };
  if (args.length === 1 && args[0] === '--enqueue')
    return { enqueue: true, createdBy: null };
  if (args.length === 3 && args[0] === '--enqueue' && args[1] === '--created-by' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(args[2] ?? ''))
    return { enqueue: true, createdBy: args[2]! };
  throw new Error('QA_PILOT_INVALID_ARGUMENTS');
}

async function main() {
  const params = parseGwmEnqueueArgs(process.argv.slice(2));
  const env = await loadAgentEnvironment(ROOT);
  if (env.SUPABASE_URL !== QA_URL || !env.SUPABASE_SERVER_KEY?.trim())
    throw new Error('QA_SUPABASE_CONFIG_REQUIRED');
  const client = createLegacySupabaseClient({
    url: QA_URL,
    serverKey: env.SUPABASE_SERVER_KEY,
  });
  const [budgets, targets, jobs] = await Promise.all([
    client.from('agent_spend_budgets')
      .select('budget_key,cap_usd,reserved_usd').eq('budget_key', BUDGET_KEY).limit(1),
    client.from('brand_connector_targets')
      .select('id,enabled,market,brand').eq('market', 'BR').eq('brand', 'GWM').limit(1),
    client.from('agent_jobs').select('id,status')
      .eq('job_type', JOB_TYPE).eq('market', 'BR').eq('brand', 'GWM')
      .in('status', ['QUEUED','RUNNING']).limit(1),
  ]);
  if (budgets.error || targets.error || jobs.error)
    throw new Error('QA_PILOT_PREFLIGHT_READ_FAILED');

  const budget = budgets.data?.[0];
  const target = targets.data?.[0];
  const pending = jobs.data?.[0];
  const cap = Number(budget?.cap_usd ?? NaN);
  const reserved = Number(budget?.reserved_usd ?? NaN);
  if (!target?.enabled) throw new Error('QA_GWM_NOT_ENABLED');
  if (!Number.isFinite(cap) || cap !== 2 || !Number.isFinite(reserved) ||
      reserved < 0 || reserved > cap)
    throw new Error('QA_GWM_BUDGET_MISSING_OR_INVALID');
  if (pending) throw new Error('QA_GWM_BRAND_JOB_ALREADY_ACTIVE');
  if (reserved > 0) throw new Error('QA_GWM_BRAND_BUDGET_ALREADY_RESERVED');

  if (!params.enqueue) {
    console.log('PREFLIGHT_OK GWM Brand Connector QA | orçamento US$ 2,00 disponível | nenhum job ativo');
    console.log('Para enfileirar: pnpm --filter @compra-car/agents exec tsx enqueue-gwm-brand-qa.ts --enqueue');
    return;
  }

  // No OpenAI key is used locally. This inserts one auditable SYSTEM_MANUAL
  // QA job, with created_by null unless a legitimate operator UUID is supplied.
  const { data: created, error } = await client.from('agent_jobs')
    .insert(gwmDiscoveryJob(params.createdBy))
    .select('id,status,job_type,brand');
  if (error || !created?.[0]?.id) throw new Error('QA_GWM_ENQUEUE_FAILED');
  console.log('GWM_BRAND_JOB_QUEUED ' + created[0].id);
  console.log('O worker Railway vai reservar US$ 2 e executar o discovery. Verifique o Flight Control.');
}

main().catch(error => {
  const safe = [
    'QA_PILOT_INVALID_ARGUMENTS','QA_SUPABASE_CONFIG_REQUIRED',
    'QA_PILOT_PREFLIGHT_READ_FAILED','QA_GWM_NOT_ENABLED',
    'QA_GWM_BUDGET_MISSING_OR_INVALID','QA_GWM_BRAND_JOB_ALREADY_ACTIVE',
    'QA_GWM_BRAND_BUDGET_ALREADY_RESERVED','QA_GWM_ENQUEUE_FAILED',
  ];
  const code = error instanceof Error && safe.includes(error.message)
    ? error.message : 'QA_GWM_PILOT_BLOCKED';
  console.error(code);
  process.exitCode = 1;
});
