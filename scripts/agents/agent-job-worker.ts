import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { runNewProductCheckCli } from './run-new-product-check';
import { runBrandConnectorCli } from './run-brand-connector';
import { replayBrandProductSourceExpansion } from './brand-source-expansion-replay';
import { refreshGwmBrandPriceSources } from './gwm-brand-price-source-refresh';
import { runLaunchMyJob } from './run-launch-my';
import { runMyLaunchBenchmark } from './my-launch-benchmark';
import { runFipePilot } from './fipe-agent-pilot';
import { runPriceCli } from './run-price';
import { runOra5PriceProbe } from './price-ora5-direct-probe';
import { runSupervisedFordSpecJob, type SupervisedSpecSourceSnapshot } from './spec-supervised-worker';
import {runSupervisedFordPdfJob,type SupervisedFordPdfJob} from './ford-supervised-pdf-job';
import {runFordSpecVocabularyJob} from './ford-spec-vocabulary-worker';
import {auditFordXls2027SourceJob} from './ford-xls-2027-source-audit-job';
import { monitorBrandSources } from './source-monitor';
import { runMmvLaunchWatch } from './mmv-launch-watch';
import { journalWorkerJob } from './engineering-worker-telemetry';
import { needsAgentBudget, reserveAgentPilotBudget, finishAgentPilotBudget, type AgentBudgetClient } from './agent-pilot-budget';

type JobRow = {
  id: string;
  job_type: string;
  status: string;
  market: string;
  brand: string;
  created_by?: string | null;
  created_at: string;
  input: {
    provider?: string;
    persistFindings?: boolean;
    marketReconcile?: boolean;
    marketModel?: string | null;
    mode?: 'discover' | 'health-check';
    parentRunId?: string;
    noFipe?: boolean;
    mmvId?: string;
    allowMyFallback?: boolean;
    launchWatchId?: string;
    launchWatchAuditMmvId?: string;
    benchmarkModel?: string;
    benchmarkVersion?: string;
    shadowConnectorRunId?: string;
    brandPriceSourceRefresh?: boolean;
    brandSourceExpandRunId?: string;
    priceAuditOnly?: boolean;
    priceDirectProbe?: boolean;
    priceProbeModel?: 'ORA5' | 'WEY07';
    supervisedSpecSnapshot?: SupervisedSpecSourceSnapshot;
    supervisedPdfSource?: SupervisedFordPdfJob;
    vocabularySourceRunId?: string;
    vocabularyPdfUrl?: string;
    sourceAuditOnly?: boolean;
    sourceAuditProductId?: number;
  };
};

const env = process.env;
const stagingUrl = 'https://shfsjyjxmgwnlexmdkcs.supabase.co';

if (env.APP_ENV !== 'qa') throw new Error('AGENT_WORKER_QA_ONLY');
if (env.SUPABASE_URL !== stagingUrl) throw new Error('AGENT_WORKER_STAGING_REQUIRED');
if (!env.SUPABASE_SERVER_KEY?.trim()) throw new Error('SUPABASE_AGENT_CONFIG_REQUIRED');
// Individual agent CLIs validate only their own credential at dispatch.
// PRICE in deterministic mode and MY reusing an MMV run require no OpenAI key.

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
  const startedAtMs=Date.now();
  const journal=async(status:'SUCCESS'|'FAILED',runId:string,code?:string)=>{
    try {await journalWorkerJob(client,{runId,jobType:job.job_type,brand:job.brand,startedAtMs,status,failureCode:code});}
    catch {console.error('[engineering] QA central logging failed',job.id);}
  };
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    console.log('[agent-job]', job.id, line);
  };

  // Reject redundant paid launch research before reserving a budget.
  if(job.job_type==='PRODUCT_YEAR'&&!job.input.parentRunId&&!job.input.benchmarkModel){
    let query=client.from('agent_my_launch_eligibility').select('mmv_id').eq('brand',job.brand).eq('eligibility','ELIGIBLE').limit(1);
    if(job.input.mmvId)query=query.eq('mmv_id',job.input.mmvId);
    const {data,error}=await query;
    if(error)throw new Error('MY_LAUNCH_PREFLIGHT_FAILED');
    if(!data?.length){
      log('MY launch preflight: no eligible MMV; zero AI calls and no budget reserved');
      await completeWithoutRun(job.id);
      return;
    }
  }

  // Deterministic Brand Connector source verification: only official GWM BR,
  // no AI invocation and no billing reservation. Generates review proposal,
  // never activates or mutates the currently approved connector.
  if (job.job_type === 'BRAND_CONNECTOR' && job.input.brandPriceSourceRefresh === true) {
    if (job.brand !== 'GWM' || job.market !== 'BR')
      throw new Error('BRAND_PRICE_REFRESH_SCOPE_INVALID');
    const result = await refreshGwmBrandPriceSources(client, log);
    await complete(job.id, result.runId);
    await journal('SUCCESS',result.runId);
    return;
  }

  // Reuse an existing Brand research result and crawl its official model
  // index. Deterministic only: no OpenAI key, no paid reservation.
  if (job.job_type === 'BRAND_CONNECTOR' && job.input.brandSourceExpandRunId) {
    if (job.market !== 'BR') throw new Error('BRAND_REPLAY_MARKET_UNSUPPORTED');
    const replay = await replayBrandProductSourceExpansion(
      client, job.input.brandSourceExpandRunId, job.brand, log,
    );
    await complete(job.id, replay.runId);
    await journal('SUCCESS', replay.runId);
    return;
  }

  // An approved canonical MMV can be checked against official dedicated
  // Brand Connector pages with zero AI. This must not trigger the brand-wide
  // discovery or the MY Agent before commercial approval.
  if (job.job_type === 'MMV_DISCOVERY' &&
      (job.input.launchWatchId || job.input.launchWatchAuditMmvId)){
    if (job.market !== 'BR') throw new Error('LAUNCH_WATCH_QA_BR_ONLY');
    const runId=await runMmvLaunchWatch(client,{
      brand:job.brand,market:job.market,watchId:job.input.launchWatchId,
      mmvId:job.input.launchWatchAuditMmvId,
      auditOnly:Boolean(job.input.launchWatchAuditMmvId),
    },log);
    await complete(job.id,runId);
    await journal('SUCCESS',runId);
    return;
  }

  // Explicitly supervised QA pilot only: source claims must already have been
  // extracted, verified and bound to the actual Ford MY and product.
  // Review proposals only; no product_specs or canonical dictionary mutations.
  if(job.job_type==='SPEC_INTELLIGENCE'){
    if(job.input.sourceAuditOnly===true){
      if(env.QA_SUPERVISED_SPEC_ENABLED!=='1'||job.brand!=='Ford'||
         job.market!=='BR'||job.input.sourceAuditProductId!==1236)
        throw new Error('FORD_XLS_AUDIT_QA_SCOPE_DENIED');
      const result=await auditFordXls2027SourceJob({
        db:client,runId:job.id,createdAt:job.created_at,
        productId:job.input.sourceAuditProductId
      });
      await complete(job.id,result.runId);
      await journal('SUCCESS',result.runId);
      log('Ford XLS MY source audit only: '+JSON.stringify(result));
      return;
    }
    const vocabulary=Boolean(job.input.vocabularySourceRunId && job.input.vocabularyPdfUrl);
    const attested=Boolean(job.input.supervisedSpecSnapshot);
    const pdf=Boolean(job.input.supervisedPdfSource);
    if(env.QA_SUPERVISED_SPEC_ENABLED!=='1' ||
       job.market!=='BR'||job.brand.toUpperCase()!=='FORD'||
       Number(vocabulary)+Number(attested)+Number(pdf)!==1)
      throw new Error('SPEC_SUPERVISED_DISABLED_OR_SOURCE_MISSING');
    const paidSpec=vocabulary||pdf;
    if(paidSpec&&!env.OPENAI_SPEC_AGENT_API_KEY?.trim())
      throw new Error('SPEC_DEDICATED_KEY_REQUIRED');
    const specReservation=paidSpec
      ?await reserveAgentPilotBudget(client as unknown as AgentBudgetClient,job)
      :null;
    try{
      if(vocabulary){
        const r=await runFordSpecVocabularyJob({
          jobId:job.id,jobCreatedAt:job.created_at,
          market:job.market,brand:job.brand,db:client,
          sourceRunId:job.input.vocabularySourceRunId!,
          pdfUrl:job.input.vocabularyPdfUrl!,
          apiKey:env.OPENAI_SPEC_AGENT_API_KEY!
        });
        await complete(job.id,r.runId);
        await journal('SUCCESS',r.runId);
        log('Spec vocabulary review-only: '+JSON.stringify(r));
      }else{
        const r=pdf
          ?await runSupervisedFordPdfJob({
            jobId:job.id,jobCreatedAt:job.created_at,
            market:job.market,brand:job.brand,
            source:job.input.supervisedPdfSource!,db:client,
            apiKey:env.OPENAI_SPEC_AGENT_API_KEY!
          })
          :await runSupervisedFordSpecJob({
            jobId:job.id,jobCreatedAt:job.created_at,
            market:job.market,brand:job.brand,
            snapshot:job.input.supervisedSpecSnapshot!,db:client
          });
        await complete(job.id,r.runId);
        await journal('SUCCESS',r.runId);
        log('Spec review-only: '+JSON.stringify(r));
      }
    }finally{
      if(specReservation)
        await finishAgentPilotBudget(client as unknown as AgentBudgetClient,specReservation);
    }
    return;
  }

  // A non-reserved paid job never reaches any OpenAI CLI. The entire USD 2
  // reservation is held until independent reconciliation of real provider usage.
  const paid=needsAgentBudget(job,env);
  const reservation=paid
    ?await reserveAgentPilotBudget(client as unknown as AgentBudgetClient,job)
    :null;
  let completedRunId: string | null = null;
  try {
  let code: number = 1;
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
        ...(job.input.shadowConnectorRunId ? ['--shadow-connector-run-id',job.input.shadowConnectorRunId] : []),
      ],
      env,
      log,
      repositoryRoot,
    );
  } else if (job.job_type === 'FIPE_DISCOVERY') {
    const fipeStarted=new Date().toISOString();
    const fipeRunId=randomUUID();
    const fipe=await runFipePilot(env,log,{
      brand:job.brand,mmvId:job.input.mmvId,
    });
    const {error:fipeRunErr}=await client.from('agent_runs').insert({
      id:fipeRunId,agent_type:'FIPE_DISCOVERY',status:'COMPLETED',
      brand:job.brand,market:job.market,provider:'parallelum-v2',
      run_mode:'CANONICAL_FIPE_MAPPING',schema_version:'FIPE-1',
      started_at:fipeStarted,completed_at:new Date().toISOString(),
      input:{jobId:job.id,mmvId:job.input.mmvId??null},
      summary:{requests:fipe.requests,candidatesObserved:fipe.candidateCount,
        valuationsObserved:fipe.valuationCount,targets:fipe.targets,
        aiCalls:0,estimatedCostUsd:0},
    });
    if(fipeRunErr)throw new Error('FIPE_AGENT_RUN_PERSIST_FAILED');
    const {data:reviewRun,error:stageErr}=await client.rpc(
      'qa_stage_fipe_review_findings',{p_brand:job.brand});
    if(stageErr)throw new Error('FIPE_REVIEW_STAGING_FAILED');
    await complete(job.id,fipeRunId);
    await journal('SUCCESS',fipeRunId);
    log('FIPE: '+JSON.stringify({runId:fipeRunId,reviewRun, ...fipe}));
    // Semiautonomous QA: paid MY is permitted only when both the explicit
    // job flag AND operator-controlled environment gate are enabled.
    // The DB dispatcher independently rechecks all FIPE/MY blockers.
    if(job.input.allowMyFallback===true &&
       env.QA_SEMIAUTONOMOUS_MY_ENABLED==='1'){
      const {data:dispatch,error:dispatchError}=await client.rpc(
        'qa_dispatch_fipe_my',{
          p_brand:job.brand,p_mmv_id:job.input.mmvId??null,
          p_allow_paid_my:true,
        });
      if(dispatchError){
        console.error('[agent-worker] FIPE-MY eligible dispatch failed',job.id);
      }else log('FIPE-MY eligible dispatch: '+JSON.stringify(dispatch));
    }
    return;
  } else if (job.job_type === 'PRODUCT_YEAR' && job.input.benchmarkModel) {
    if(!job.input.benchmarkVersion)throw new Error('MY_BENCHMARK_VERSION_REQUIRED');
    await runMyLaunchBenchmark({
      id:job.id,brand:job.brand,model:job.input.benchmarkModel,
      version:job.input.benchmarkVersion,
    },env,log);
    await completeWithoutRun(job.id);
    return;
  } else if (job.job_type === 'PRODUCT_YEAR') {
    const runId=await runLaunchMyJob({jobId:job.id,brand:job.brand,mmvId:job.input.mmvId},env,log);
    if(!runId){await completeWithoutRun(job.id);return;}
    await complete(job.id,runId);
    await journal('SUCCESS',runId);
    return;
  } else if (job.job_type === 'PRICE_INTELLIGENCE') {
    if (job.input.priceDirectProbe === true) {
      if (job.brand !== 'GWM' || job.market !== 'BR') throw new Error('PRICE_PROBE_SCOPE_INVALID');
      const probe = await runOra5PriceProbe(log,job.input.priceProbeModel === 'WEY07' ? 'WEY07' : 'ORA5');
      const {error: probeError} = await client.from('agent_jobs')
        .update({input:{...job.input,priceDirectProbeResult:probe}}).eq('id',job.id);
      if (probeError) throw new Error('PRICE_PROBE_RESULT_PERSIST_FAILED');
      await completeWithoutRun(job.id);
      return;
    }
    // The Price CLI persists an immutable run/finding bundle, consumed by the
    // shared Reviews inbox. Never run against an unexpected market.
    if (job.market !== 'BR') throw new Error('PRICE_MARKET_UNSUPPORTED');
    const compactRequested = job.input.provider === 'compact-match';
    const priceAiRequested = job.input.provider === 'openai' || compactRequested;
    // An explicit paid Price job cannot silently downgrade to deterministic
    // or borrow a generic/other-agent key.
    const priceEnv = compactRequested
      ? { ...env, PRICE_AGENT_LLM_ENABLED: '0',
          PRICE_AGENT_COMPACT_MATCH_ENABLED: '1',
          PRICE_AGENT_HARD_COST_CAP_USD: '0.03' }
      : priceAiRequested
        ? { ...env, PRICE_AGENT_COMPACT_MATCH_ENABLED: '0',
            PRICE_AGENT_LLM_ENABLED: '1', PRICE_AGENT_HARD_COST_CAP_USD: '2' }
        : { ...env, PRICE_AGENT_COMPACT_MATCH_ENABLED: '0',
            PRICE_AGENT_LLM_ENABLED: '0', PRICE_AGENT_HARD_COST_CAP_USD: '2' };
    code = await runPriceCli(['--brand',job.brand,
      job.input.priceAuditOnly === true ? '--audit-only' : '--persist-findings',
      ...(job.input.shadowConnectorRunId ? ['--shadow-connector-run-id',job.input.shadowConnectorRunId] : [])],priceEnv,log,repositoryRoot);
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
    const code=logs.find(
        (line) => line.startsWith('NEW_PRODUCT_CHECK_FAILED:') ||
          line.startsWith('BRAND_CONNECTOR_FAILED:') ||
          line.startsWith('Model Year run failed:') ||
          line.startsWith('PRICE_AGENT_FAILED'),
      ) ?? 'AGENT_JOB_EXECUTION_FAILED';
    await fail(
      job.id,
      logs.find(
        (line) =>
          line.startsWith('NEW_PRODUCT_CHECK_FAILED:') ||
          line.startsWith('BRAND_CONNECTOR_FAILED:') ||
          line.startsWith('Model Year run failed:') ||
          line.startsWith('PRICE_AGENT_FAILED'),
      ) ?? 'AGENT_JOB_EXECUTION_FAILED',
    );
    await journal('FAILED',job.id,code);
    return;
  }
  await complete(job.id, runId);
  completedRunId = runId;
  await journal('SUCCESS',runId);

  if (job.job_type === 'MMV_DISCOVERY' && !job.input.shadowConnectorRunId) {
    // A completed brand-wide discovery only makes *approved canonical* MMVs
    // eligible for FIPE-first dispatch. Never queue paid MY directly.
    const {data:dispatch,error:dispatchError}=await client.rpc('qa_dispatch_fipe_my',{
      p_brand:job.brand,p_mmv_id:null,p_allow_paid_my:false,
    });
    if(dispatchError){
      console.error('[agent-worker] QA FIPE-first dispatch failed',job.id);
    }else log('FIPE-first dispatch: '+JSON.stringify(dispatch));
  }
  } finally {
    if(reservation){
      try{
        // Complete as UNKNOWN first; release unused reserve only after both
        // provider usage and run summary agree on the number of API calls.
        await finishAgentPilotBudget(client as unknown as AgentBudgetClient,reservation);
        if(job.job_type==='PRICE_INTELLIGENCE' &&
           job.input.provider==='compact-match' && completedRunId){
          const {data:run,error:runErr}=await client.from('agent_runs')
            .select('summary').eq('id',completedRunId).single();
          const {data:receipts,error:receiptErr}=await client
            .from('agent_ai_usage_events')
            .select('model,reason,estimated_cost_usd,input_tokens,output_tokens,web_search_count')
            .eq('intended_run_id',completedRunId).eq('reason','PRICE_COMPACT_IDENTITY_ONLY');
          const measured=Number(run?.summary?.llmCalls);
          const listed=receipts??[];
          const valid=!runErr&&!receiptErr&&Number.isInteger(measured)&&
            measured>=0&&measured<=1&&listed.length===measured&&
            listed.every(r=>r.model==='gpt-5.6-luna' &&
              Number(r.web_search_count)===0 &&
              Number.isFinite(Number(r.estimated_cost_usd)) &&
              Number(r.estimated_cost_usd)>=0 &&
              Number(r.input_tokens)>0&&Number(r.output_tokens)>=0);
          if(valid){
            const actual=listed.reduce((v,r)=>v+Number(r.estimated_cost_usd),0);
            if(actual<=reservation.reservedUsd){
              const {error:reconcileErr}=await client.rpc('agent_spend_reconcile',{
                p_reservation_id:reservation.id,
                p_actual_usd:actual,
                p_source:'PROVIDER_USAGE',
              });
              if(reconcileErr)throw new Error('PRICE_COMPACT_RESERVATION_RECONCILE_FAILED');
              console.log('[price-budget] compact',job.id,
                'provider-metered tokens, estimated USD',actual.toFixed(6));
            }
          }
        }
      }catch{
        // Retain UNKNOWN whenever usage is incomplete; never release a reserve
        // using a guess or an unrelated agent's token receipt.
        console.error('[agent-worker] budget reservation requires reconciliation',job.id);
      }
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
      const budgetError = error instanceof Error &&
        ['COST_BUDGET_NOT_CONFIGURED','COST_BUDGET_EXHAUSTED',
          'COST_INVALID_SCOPE','COST_INVALID_RESERVATION',
          'COST_ADMISSION_FAILED'].includes(error.message)
          ? error.message : null;
      // Preserve only allowlisted, non-sensitive FIPE failure codes so QA
      // pilots can distinguish rate limit, HTTP, identity, mapping and DB
      // failures. Never persist raw provider bodies or credentials.
      const fipeCode = job.job_type==='FIPE_DISCOVERY' &&
        error instanceof Error &&
        /^FIPE_(?:[A-Z][A-Z0-9_]{2,80}|HTTP_[0-9]{3})$/u.test(error.message)
        ? error.message : null;
      const failureCode=budgetError??fipeCode??'AGENT_JOB_EXECUTION_FAILED';
      console.error('[agent-worker] execution failed', job.id,failureCode);
      try {
        await fail(job.id,failureCode);
        try {await journalWorkerJob(client,{runId:job.id,jobType:job.job_type,brand:job.brand,
          startedAtMs:Date.now(),status:'FAILED',failureCode:'AGENT_JOB_EXECUTION_FAILED'});}
        catch {console.error('[engineering] QA central failure logging unavailable',job.id);}
      } catch (failError) {
        console.error('[agent-worker] could not mark failed', job.id, failError);
      }
    }
  } catch (error) {
    console.error('[agent-worker] loop error', error);
    await sleep(5000);
  }
}
