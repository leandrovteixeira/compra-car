import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';

type FipeItem={code:string;name:string};
type Mmv={id:string;brand:string;model:string;official_version_label:string|null};
type CallBudget={count:number;max:number};
const BASE='https://fipe.parallelum.com.br/api/v2';
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const modelTokens=(s:string)=>normalize(s).split(' ').filter(Boolean);
function matchingModel(mmv:Mmv,label:string):boolean {
 const official=modelTokens(mmv.model).filter(t=>t!=='haval'&&t!=='gwm');
 const candidate=modelTokens(label);
 return official.length>0 && official.every(t=>candidate.includes(t));
}
async function getJson(path:string,budget:CallBudget):Promise<unknown>{
 if(budget.count>=budget.max)throw new Error('FIPE_REQUEST_BUDGET_EXHAUSTED');
 budget.count++;
 const response=await fetch(BASE+path,{headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(15000)});
 if(response.status===429)throw new Error('FIPE_RATE_LIMITED');
 if(!response.ok)throw new Error('FIPE_HTTP_'+response.status);
 return response.json();
}
function items(x:unknown):FipeItem[]{
 if(!Array.isArray(x))throw new Error('FIPE_RESPONSE_UNEXPECTED');
 return x.filter((v):v is FipeItem=>v!==null&&typeof v==='object'&&
 typeof v.code==='string'&&typeof v.name==='string');
}
function month(ref:string):{year:number;month:number}|null{
 const match=ref.match(/(?:^|\D)(20\d{2})[-/](0?[1-9]|1[0-2])(?:$|\D)/);
 if(match)return {year:Number(match[1]),month:Number(match[2])};
 const pt=/^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (20\d{2})$/i.exec(ref.trim());
 if(!pt)return null;
 return {year:Number(pt[2]),month:1+['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'].indexOf(pt[1]!.toLowerCase())};
}
function price(text:string):number|null{
 const n=Number(text.replace(/[^\d,.]/g,'').replace(/\./g,'').replace(',','.'));
 return Number.isFinite(n)&&n>0?n:null;
}
export async function runFipePilot(env:NodeJS.ProcessEnv=process.env,log=console.log){
 if(env.APP_ENV!=='qa'||env.SUPABASE_URL!=='https://shfsjyjxmgwnlexmdkcs.supabase.co')
  throw new Error('FIPE_QA_ONLY');
 if(!env.SUPABASE_SERVER_KEY)throw new Error('FIPE_SUPABASE_KEY_REQUIRED');
 const db=createLegacySupabaseClient({url:env.SUPABASE_URL,serverKey:env.SUPABASE_SERVER_KEY});
 const max=Math.min(40,Math.max(1,Number(env.FIPE_PILOT_MAX_REQUESTS||'25')));
 const budget={count:0,max};
 const {data:mmvs,error:mmvError}=await db.from('agent_fipe_unmapped_mmvs')
   .select('mmv_id,brand,model,official_version_label').order('brand').limit(100);
 if(mmvError)throw new Error('FIPE_UNMAPPED_MMVS_UNAVAILABLE');
 const targets=(mmvs||[]).filter(x=>x.brand==='GWM').map(x=>({
   id:x.mmv_id,brand:x.brand,model:x.model,official_version_label:x.official_version_label,
 })) as Mmv[];
 const brands=items(await getJson('/cars/brands',budget));
 const gwm=brands.find(x=>normalize(x.name)==='gwm');
 if(!gwm)throw new Error('FIPE_GWM_BRAND_NOT_FOUND');
 const models=items(await getJson('/cars/brands/'+encodeURIComponent(gwm.code)+'/models',budget));
 let candidateCount=0,valuationCount=0;
 for(const model of models){
   const relevant=targets.filter(t=>matchingModel(t,model.name));
   if(!relevant.length)continue;
   if(budget.count>=budget.max-2)break;
   const years=items(await getJson('/cars/brands/'+gwm.code+'/models/'+encodeURIComponent(model.code)+'/years',budget));
   for(const year of years){
     if(budget.count>=budget.max)break;
     // Preserve the provider's distinct year/fuel identifier exactly.
     const detail=await getJson('/cars/brands/'+gwm.code+'/models/'+encodeURIComponent(model.code)+'/years/'+encodeURIComponent(year.code),budget) as Record<string,unknown>;
     const fipeCode=typeof detail.codeFipe==='string'?detail.codeFipe:'';
     const label=typeof detail.model==='string'?detail.model:model.name;
     if(!/^\d{6}-\d$/.test(fipeCode))continue;
     const targetYear=Number(typeof detail.modelYear==='string'?detail.modelYear.match(/\d{4}/)?.[0]:detail.modelYear);
     const reference=typeof detail.referenceMonth==='string'?month(detail.referenceMonth):null;
     const amount=typeof detail.price==='string'?price(detail.price):null;
     // Matching is review-only: do not promote a tentative FIPE code to canonical.
     for(const target of relevant) {
       const labelNorm=normalize(label), versionNorm=normalize(target.official_version_label||'');
       if(versionNorm&&!labelNorm.includes(versionNorm))continue;
       const {error:candidateError}=await db.from('agent_fipe_mapping_candidates').upsert({
         mmv_id:target.id,fipe_code:fipeCode,fipe_model_label:label,provider:'parallelum-v2',
         source_url:BASE+'/cars/brands/'+gwm.code+'/models/'+model.code+'/years/'+year.code,
         match_confidence:versionNorm?0.78:0.55,
         evidence:{brandName:gwm.name,modelCode:model.code,modelLabel:model.name,yearCode:year.code,modelYear:targetYear},
       },{onConflict:'mmv_id,fipe_code,provider',ignoreDuplicates:true});
       if(candidateError)throw new Error('FIPE_CANDIDATE_PERSIST_FAILED');
       candidateCount++;
     }
     if(reference&&amount&&Number.isInteger(targetYear)&&targetYear>=1900) {
       const {error:historyError}=await db.from('agent_fipe_valuation_history').upsert({
         fipe_code:fipeCode,model_year:targetYear,
         fuel_code:String(detail.fuelAcronym||''),reference_year:reference.year,
         reference_month:reference.month,valuation_brl:amount,
         manufacturer_label:String(detail.brand||gwm.name),
         fipe_model_label:label,source_provider:'parallelum-v2',
         source_url:BASE+'/cars/brands/'+gwm.code+'/models/'+model.code+'/years/'+year.code,
         raw_payload:detail,
       },{onConflict:'fipe_code,model_year,fuel_code,reference_year,reference_month,source_provider',ignoreDuplicates:true});
       if(historyError)throw new Error('FIPE_VALUATION_PERSIST_FAILED');
       valuationCount++;
     }
   }
 }
 log(JSON.stringify({requests:budget.count,requestLimit:budget.max,targets:targets.length,
   candidatesObserved:candidateCount,valuationsObserved:valuationCount}));
 return {requests:budget.count,candidateCount,valuationCount};
}
if(process.argv[1]?.endsWith('fipe-agent-pilot.ts')){
 runFipePilot().catch(e=>{console.error(e instanceof Error?e.message:'FIPE_UNKNOWN_ERROR');process.exitCode=1;});
}
