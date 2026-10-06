import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { createLegacyOperationsClient } from '@compra-car/adapter-supabase';
import { loadAgentEnvironment, type AgentEnvironment } from './agent-environment';

export const OPERATION_STAGES = ['BRAND_CONNECTOR','MMV_DISCOVERY','MODEL_YEAR'] as const;
export type OperationStage = (typeof OPERATION_STAGES)[number];
type OperationsClient = ReturnType<typeof createLegacyOperationsClient>;

export type OperationsOptions = Readonly<{
  brands: readonly string[];
  market: string;
  triggerType: 'SCHEDULED' | 'MANUAL';
  dryRun: boolean;
  maxRetries: number;
  stages: readonly OperationStage[];
}>;

export type OperationStepResult = Readonly<{
  brand: string;
  stage: OperationStage;
  attempts: number;
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  error?: string;
}>;

const cleanBrand = (value: string) => value.trim().replace(/\s+/gu, ' ');

export function parseOperationsArguments(args: readonly string[]): OperationsOptions {
  const values = args[0] === '--' ? args.slice(1) : [...args];
  const map = new Map<string, string>();
  let dryRun = false;
  for (let i = 0; i < values.length; i += 1) {
    const name = values[i]!;
    if (name === '--dry-run') {
      if (dryRun) throw new Error('INVALID_OPERATIONS_ARGUMENTS');
      dryRun = true;
      continue;
    }
    const value = values[++i];
    if (
      !['--brands','--market','--trigger','--max-retries','--stages'].includes(name) ||
      !value ||
      value.startsWith('--') ||
      map.has(name)
    ) throw new Error('INVALID_OPERATIONS_ARGUMENTS');
    map.set(name, value);
  }
  const brands = (map.get('--brands') ?? '')
    .split(',')
    .map(cleanBrand)
    .filter(Boolean);
  if (!brands.length || new Set(brands.map((b) => b.toLowerCase())).size !== brands.length)
    throw new Error('INVALID_OPERATIONS_ARGUMENTS');
  const market = (map.get('--market') ?? 'BR').trim().toUpperCase();
  if (!/^[A-Z]{2}$/u.test(market)) throw new Error('INVALID_OPERATIONS_ARGUMENTS');
  const triggerRaw = (map.get('--trigger') ?? 'manual').toUpperCase();
  if (triggerRaw !== 'MANUAL' && triggerRaw !== 'SCHEDULED')
    throw new Error('INVALID_OPERATIONS_ARGUMENTS');
  const retriesRaw = map.get('--max-retries') ?? '1';
  const maxRetries = Number(retriesRaw);
  if (!/^\d+$/u.test(retriesRaw) || !Number.isSafeInteger(maxRetries) || maxRetries > 2)
    throw new Error('INVALID_OPERATIONS_ARGUMENTS');
  const stages = (map.get('--stages') ?? OPERATION_STAGES.join(','))
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (!stages.length || stages.some((s) => !OPERATION_STAGES.includes(s as OperationStage)))
    throw new Error('INVALID_OPERATIONS_ARGUMENTS');
  return {
    brands,
    market,
    triggerType: triggerRaw,
    dryRun,
    maxRetries,
    stages: stages as OperationStage[],
  };
}

function pnpmBinary() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

export function commandFor(stage: OperationStage, brand: string, market: string) {
  switch (stage) {
    case 'BRAND_CONNECTOR':
      return [
        '--filter','@compra-car/agents','exec','tsx','brand-connector-cli.ts',
        '--brand',brand,'--market',market,'--mode','health-check','--provider','openai',
        '--persist-findings',
      ];
    case 'MMV_DISCOVERY':
      return [
        '--filter','@compra-car/agents','exec','tsx','cli.ts',
        '--brand',brand,'--provider','openai','--persist-findings',
      ];
    case 'MODEL_YEAR':
      return [
        '--filter','@compra-car/agents','exec','tsx','model-year-cli.ts',
        '--brand',brand,'--provider','structured','--mode','monitor','--persist-findings',
      ];
  }
}

export async function runCommand(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpmBinary(), args, {
      cwd,
      env,
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function acquireRun(
  client: OperationsClient,
  options: OperationsOptions,
  sourceCommitSha: string | undefined,
) {
  const id = randomUUID();
  const key = `daily:${options.market}`;
  const now = new Date().toISOString();
  const { error } = await client.from('agent_orchestration_runs').insert({
    id,
    orchestration_key: key,
    status: 'RUNNING',
    trigger_type: options.triggerType,
    market: options.market,
    brands: options.brands,
    started_at: now,
    source_commit_sha: sourceCommitSha ?? null,
  });
  if (error?.code === '23505') return null;
  if (error) throw new Error('ORCHESTRATION_LEASE_FAILED');
  return { id, key, startedAt: now };
}

async function finishRun(
  client: OperationsClient,
  id: string,
  status: 'COMPLETED' | 'FAILED',
  summary: unknown,
  error: unknown,
) {
  const { error: persistenceError } = await client
    .from('agent_orchestration_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      summary,
      error,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'RUNNING');
  if (persistenceError) throw new Error('ORCHESTRATION_FINALIZE_FAILED');
}

export async function runOperations(
  options: OperationsOptions,
  environment: AgentEnvironment = process.env,
  log: (line: string) => void = console.log,
  dependencies: {
    cwd?: string;
    run?: typeof runCommand;
    client?: OperationsClient;
  } = {},
) {
  const cwd = dependencies.cwd ?? fileURLToPath(new URL('../../', import.meta.url));
  const env = await loadAgentEnvironment(cwd, environment);
  const run = dependencies.run ?? runCommand;
  if (options.dryRun) {
    const plan = options.brands.flatMap((brand) =>
      options.stages.map((stage) => ({ brand, stage, args: commandFor(stage, brand, options.market) })),
    );
    log(JSON.stringify({ dryRun: true, plan }, null, 2));
    return { status: 'DRY_RUN' as const, steps: [] as OperationStepResult[] };
  }
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVER_KEY?.trim())
    throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
  let client = dependencies.client;
  if (!client) {
    const { createLegacyOperationsClient } = await import('@compra-car/adapter-supabase');
    client = createLegacyOperationsClient({
      url: env.SUPABASE_URL,
      serverKey: env.SUPABASE_SERVER_KEY,
    });
  }
  const lease = await acquireRun(client, options, env.RAILWAY_GIT_COMMIT_SHA);
  if (!lease) {
    log('Operations skipped: another run already holds the lease for ' + options.market + '.');
    return { status: 'SKIPPED_LOCKED' as const, steps: [] as OperationStepResult[] };
  }
  const steps: OperationStepResult[] = [];
  try {
    for (const brand of options.brands) {
      for (const stage of options.stages) {
        const started = Date.now();
        let attempts = 0;
        let code = 1;
        let lastError = '';
        while (attempts <= options.maxRetries) {
          attempts += 1;
          try {
            code = await run(commandFor(stage, brand, options.market), cwd, { ...process.env, ...env });
            if (code === 0) break;
            lastError = 'EXIT_' + code;
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
          }
        }
        steps.push({
          brand,
          stage,
          attempts,
          status: code === 0 ? 'COMPLETED' : 'FAILED',
          durationMs: Date.now() - started,
          ...(code === 0 ? {} : { error: lastError || 'FAILED' }),
        });
        if (code !== 0) {
          await finishRun(client, lease.id, 'FAILED', { steps }, {
            code: 'PIPELINE_STAGE_FAILED',
            brand,
            stage,
          });
          return { status: 'FAILED' as const, steps };
        }
      }
    }
    await finishRun(client, lease.id, 'COMPLETED', { steps }, null);
    return { status: 'COMPLETED' as const, steps };
  } catch (error) {
    try {
      await finishRun(client, lease.id, 'FAILED', { steps }, {
        code: 'ORCHESTRATION_FAILED',
        message: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });
    } catch {
      // Original failure wins.
    }
    throw error;
  }
}
