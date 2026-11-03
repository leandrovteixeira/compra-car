/**
 * One-shot H6 PHEV19 2027 semantic reconciliation.
 * Real provider call is enabled ONLY with OPENAI_API_KEY and --execute.
 * Output proposals remain PENDING_REVIEW; no DB writes, no alias approvals.
 * Telemetry JSON is written even if provider validation fails.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {
  measureSpecAiUsage27,reserveSpecAiBudget27,validateSpecAiProposals27,
  SPEC_AI_MODEL_27,SPEC_AI_MAX_OUTPUT_TOKENS_27,
  type SpecAiDecision27,type SpecAiClaim27,type SpecAiCatalog27
} from '@compra-car/core/agents';

type Benchmark = {
 target:{productId:number;modelYear:number};
 findings:{ordinal:number;page:number;sourceLabel:string;category:string}[];
};
type Snapshot={productId:number;modelYear:number;rows:{
 code:string;label:string;type:'binary'|'numeric'|'scale';unit:string|null
}[]};
const [flag,path]=process.argv.slice(2);
if(flag!=='--execute'||!path)throw new Error('SPEC_AI_EXECUTE_FLAG_REQUIRED');
const output=process.env.SPEC_AI_REPORT_PATH||'/tmp/spec-ai-pilot.json';
const report:Record<string,unknown>={
  status:'NOT_STARTED',runScope:'GWM_PHEV19_MY2027',writesApplied:false,
  aliasesApproved:0,costAvailable:false,budgetHardCapUsd:2
};
const persist=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
persist();
const benchmark=JSON.parse(readFileSync(path,'utf8')) as Benchmark;
const snapshot=JSON.parse(readFileSync(
 new URL('../../packages/core/test/fixtures/gwm-h6-phev19-2027-qa-specs.json',import.meta.url),
 'utf8')) as Snapshot;
if(benchmark.target.productId!==1166||benchmark.target.modelYear!==2027||
  benchmark.findings.length!==79||snapshot.rows.length!==171)
  throw new Error('SPEC_AI_PILOT_WRONG_TARGET_OR_COUNT');
const claims:SpecAiClaim27[]=benchmark.findings.map(x=>({
 ordinal:x.ordinal,page:x.page,sourceLabel:x.sourceLabel
}));
const catalog:SpecAiCatalog27[]=snapshot.rows
 .filter(x=>x.type!=='numeric')
 .map(x=>({code:x.code,label:x.label,type:x.type}));
const instructions=[
 'Você é especialista em fichas técnicas automotivas brasileiras.',
 'Sua tarefa é propor CONCILIAÇÃO para REVISÃO HUMANA, sem aprovar nada.',
 'Cada claim é uma descrição de equipamento encontrada literalmente na ficha oficial da GWM.',
 'Associe a zero ou mais codes EXATOS do catálogo fornecido. Nunca invente código.',
 'Se um claim contiver múltiplos equipamentos, use DECOMPOSE e fragmentos individuais.',
 'Se não houver correspondência semântica real, use NO_MATCH; não force aproximações.',
 'Não confunda tipos de airbags, cadeiras, ar condicionado e alertas de cintos.',
 'Não invente ausências: nenhuma falta de menção implica NOT_AVAILABLE nesse piloto.',
 'Mantenha exactamente uma decisão para cada ordinal, incluindo NO_MATCH.',
 'Components devem ser subconjunto textual justificável do claim; no máximo seis.',
 'Tipos numeric não correspondem a equipamentos binários nesta execução.',
 'As propostas do modelo são apenas sugestões; nenhuma atualização canônica é autorizada.'
].join(' ');
const schema={
 type:'object',additionalProperties:false,required:['decisions'],properties:{
 decisions:{type:'array',items:{
 type:'object',additionalProperties:false,
 required:['ordinal','status','components','note'],
 properties:{
  ordinal:{type:'integer'},
  status:{type:'string',enum:['PROPOSE','DECOMPOSE','NO_MATCH']},
  note:{type:'string'},
  components:{type:'array',items:{
   type:'object',additionalProperties:false,
   required:['sourceFragment','specCode','explanation'],
   properties:{
    sourceFragment:{type:'string'},specCode:{type:'string'},explanation:{type:'string'}
   }
  }}
 }
 }}
 }
};
const payload={
 model:SPEC_AI_MODEL_27,
 reasoning:{effort:'none'},
 store:false,
 max_output_tokens:SPEC_AI_MAX_OUTPUT_TOKENS_27,
 input:[
  {role:'system',content:instructions},
  {role:'user',content:JSON.stringify({
   target:'GWM Haval H6 PHEV19 Flex MY2027',
   claims:benchmark.findings.map(x=>({ordinal:x.ordinal,page:x.page,
    category:x.category,label:x.sourceLabel})),
   catalog,
   note:'Responda SOMENTE no JSON schema informado; decisões pendentes de operador.'
  })}
 ],
 text:{format:{type:'json_schema',name:'spec_agent_review_v1',strict:true,schema}}
};
const promptBytes=Buffer.byteLength(JSON.stringify(payload),'utf8');
const reservation=reserveSpecAiBudget27({utf8InputBytes:promptBytes});
const inputFingerprint=createHash('sha256').update(JSON.stringify({claims,catalog})).digest('hex');
Object.assign(report,{status:'REQUEST_PREPARED',model:SPEC_AI_MODEL_27,
 inputFingerprint,promptBytes,reservation,claims:claims.length,catalogSpecs:catalog.length});
persist();
const key=process.env.SPEC_AGENT_OPENAI_API_KEY||process.env.OPENAI_API_KEY;
if(!key){
  report.status='SKIPPED_NO_PROVIDER_CREDENTIAL';persist();
  process.stdout.write('SPEC_AI: skipped - no provider credential; preflight cost ceiling recorded\n');
  process.exit(0);
}
const started=Date.now();
let raw:unknown;
try{
 const response=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(120000),
 });
 raw=await response.json();
 if(!response.ok){
  Object.assign(report,{status:'PROVIDER_ERROR',providerHttpStatus:response.status,
    costAvailable:false,elapsedMs:Date.now()-started,
    providerError:(raw as {error?:{code?:string}})?.error?.code??'unknown'});
  persist();throw new Error('SPEC_AI_PROVIDER_ERROR_'+response.status);
 }
}catch(err){
 if(report.status!=='PROVIDER_ERROR'){
  Object.assign(report,{status:'TRANSPORT_ERROR',costAvailable:false,
   elapsedMs:Date.now()-started,error:String(err)});
  persist();
 }
 throw err;
}
const result=raw as {
 id?:string;model?:string;status?:string;usage?:{
  input_tokens?:number;output_tokens?:number;
  input_tokens_details?:{cached_tokens?:number};
  output_tokens_details?:{reasoning_tokens?:number}
 };
 output?:{type:string;content?:{type:string;text?:string}[]}[];
};
if(!result.usage ||
  result.usage.input_tokens===undefined||result.usage.output_tokens===undefined){
 Object.assign(report,{status:'USAGE_MISSING',costAvailable:false,responseId:result.id??null});
 persist();throw new Error('SPEC_AI_USAGE_MISSING');
}
const usage=measureSpecAiUsage27({
 model:SPEC_AI_MODEL_27,inputTokens:result.usage.input_tokens,
 cachedInputTokens:result.usage.input_tokens_details?.cached_tokens??0,
 outputTokens:result.usage.output_tokens,
 reasoningTokens:result.usage.output_tokens_details?.reasoning_tokens??0,
});
Object.assign(report,{status:'RESPONSE_RECEIVED',costAvailable:true,usage,
 elapsedMs:Date.now()-started,responseId:result.id??null,
 providerReturnedModel:result.model??null,providerStatus:result.status??null,
 tokenCostPerClaimUsd:usage.actualEstimatedCostUsd/claims.length,
 extrapolatedCostPer1000ClaimsUsd:usage.actualEstimatedCostUsd/claims.length*1000});
persist();
if(usage.actualEstimatedCostUsd>reservation.hardCapUsd){
 report.status='BUDGET_VIOLATION';persist();throw new Error('SPEC_AI_BUDGET_VIOLATION');
}
const rawText=result.output?.flatMap(x=>x.content??[])
  .filter(x=>x.type==='output_text').map(x=>x.text??'').join('')??'';
let decisions:SpecAiDecision27[];
try{
 decisions=(JSON.parse(rawText) as {decisions:SpecAiDecision27[]}).decisions;
 Object.assign(report,{rawDecisionCount:decisions.length,rawDecisions:decisions});
 persist();
 const proposed=validateSpecAiProposals27({claims,catalog,decisions});
 Object.assign(report,{
  status:'COMPLETED_REVIEW_ONLY',proposalCount:proposed.length,
  componentProposals:proposed.reduce((sum,x)=>sum+x.components.length,0),
  totalCanonicalSpecs:snapshot.rows.length,eligibleCatalogSpecs:catalog.length,
  matchedClaims:proposed.filter(x=>x.components.length>0).length,
  noMatchClaims:proposed.filter(x=>x.status==='NO_MATCH').length,
  decomposedClaims:proposed.filter(x=>x.status==='DECOMPOSE').length,
  proposals:proposed
 });
 persist();
 process.stdout.write('SPEC_AI: completed '+JSON.stringify({
  usage,proposalCount:proposed.length,componentProposals:report.componentProposals,
  elapsedMs:report.elapsedMs})+'\n');
}catch(err){
 Object.assign(report,{status:'INVALID_PROVIDER_PROPOSALS',validationError:String(err)});
 persist();throw err;
}
