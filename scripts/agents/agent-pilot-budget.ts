/** Sprint 26 QA pilot: one conservative DB admission per paid agent job.
 * Full reservation is retained: this is a dispatch gate, NOT proof that an
 * in-flight OpenAI request can never exceed the declared USD ceiling.
 * The dedicated OpenAI project budget and model/call limits are separate.
 */
export type PaidAgentKind='BRAND_CONNECTOR'|'MMV_DISCOVERY'|'PRODUCT_YEAR'|'PRICE_INTELLIGENCE'|'SPEC_INTELLIGENCE';
export type AgentBudgetJob=Readonly<{
  job_type:string;market:string;brand:string;
  input?:Readonly<{parentRunId?:string|null;provider?:string}>;
}>;

export type AgentBudgetClient=Readonly<{
  rpc: (name:string,args:Record<string,unknown>)=>Promise<{
    data:unknown;error:{message?:string;code?:string}|null;
  }>;
}>;

export const GWM_PILOT_RESERVATION_USD=2;
export const MY_LAUNCH_RESERVATION_USD=0.20;
export const PRICE_COMPACT_RESERVATION_USD=0.03;

export function needsAgentBudget(job:AgentBudgetJob,env:Readonly<Record<string,string|undefined>>):boolean {
  switch(job.job_type){
    case 'BRAND_CONNECTOR':
    case 'MMV_DISCOVERY':return true;
    case 'PRODUCT_YEAR':return !job.input?.parentRunId;
    case 'SPEC_INTELLIGENCE':return true;
    case 'PRICE_INTELLIGENCE':return job.input?.provider==='openai' || job.input?.provider==='compact-match' || env.PRICE_AGENT_LLM_ENABLED==='1';
    default:return false;
  }
}
export function agentPilotBudgetKey(job:AgentBudgetJob):string{
  const market=job.market.trim().toUpperCase();
  const brand=job.brand.trim().toUpperCase().replace(/\s+/gu,' ');
  if(!/^[A-Z]{2}$/u.test(market)||!brand||brand.length>80||
     !['BRAND_CONNECTOR','MMV_DISCOVERY','PRODUCT_YEAR','PRICE_INTELLIGENCE','SPEC_INTELLIGENCE'].includes(job.job_type))
    throw new Error('COST_INVALID_SCOPE');
  return ['qa',market,brand,job.job_type].join(':');
}
function cleanCode(error:unknown):string {
  const message=typeof error==='object'&&error!==null&&'message' in error
    ?String(error.message):'';
  for(const code of ['COST_BUDGET_NOT_CONFIGURED','COST_BUDGET_EXHAUSTED',
    'COST_INVALID_RESERVATION','COST_RESERVATION_NOT_PENDING']){
    if(message.includes(code))return code;
  }
  return 'COST_ADMISSION_FAILED';
}
export async function reserveAgentPilotBudget(
  client:AgentBudgetClient,job:AgentBudgetJob,
):Promise<{id:string;budgetKey:string;reservedUsd:number}>{
  const budgetKey=agentPilotBudgetKey(job);
  // Reconciled prior usage remains charged to the same US$ 2 pilot cap.
  // Reserve the remaining amount atomically, up to a maximum of US$ 2.
  const maxReserve=job.job_type==='PRODUCT_YEAR'
    ? MY_LAUNCH_RESERVATION_USD
    : job.job_type==='PRICE_INTELLIGENCE' && job.input?.provider==='compact-match'
      ? PRICE_COMPACT_RESERVATION_USD : GWM_PILOT_RESERVATION_USD;
  const {data,error}=await client.rpc('agent_spend_reserve_remaining',{
    p_budget_key:budgetKey,p_model:job.job_type,
    p_max_amount_usd:maxReserve,
  });
  if(error)throw new Error(cleanCode(error));
  const result = data && typeof data==='object' && !Array.isArray(data)
    ? data as Record<string,unknown> : null;
  const id=result?.id;
  const reservedUsd=Number(result?.reservedUsd);
  if(typeof id!=='string'||!id.trim()||!Number.isFinite(reservedUsd)||
     reservedUsd<0.01||reservedUsd>maxReserve)
    throw new Error('COST_ADMISSION_FAILED');
  return {id,budgetKey,reservedUsd};
}
export async function finishAgentPilotBudget(
  client:AgentBudgetClient,reservation:{id:string},
):Promise<void>{
  // Provider totals not reconciled against actual invoice => UNKNOWN is honest.
  // Full reserve remains held, even if the job fails before charging.
  const {error}=await client.rpc('agent_spend_complete',{
    p_id:reservation.id,p_usage_known:false,
  });
  if(error)throw new Error(cleanCode(error));
}
