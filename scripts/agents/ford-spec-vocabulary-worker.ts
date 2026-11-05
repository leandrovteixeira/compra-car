/** Supervised QA-only, source-vocabulary discovery for Ford Ranger.
 * Does NOT require an MMV/MY because it makes no per-vehicle equipment claim.
 * Every source claim is review-only and must be manually canonicalized.
 */
import {createHash,randomUUID} from 'node:crypto';
import {extractFordSpecVocabulary27} from '@compra-car/adapter-openai';
import {AgentPlatformSupabaseAdapter,createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {normalizeAliasLabel} from '@compra-car/core/agent-platform';
import type {AgentRunBundle,AgentObject} from '@compra-car/core/agent-platform';
import {officialFordPdfBytes} from './ford-supervised-pdf-job';
type Client=ReturnType<typeof createLegacySupabaseClient>;

export async function runFordSpecVocabularyJob(input:{
 jobId:string;jobCreatedAt:string;brand:string;market:string;
 sourceRunId:string;pdfUrl:string;db:Client;apiKey:string;
}):Promise<{runId:string;claims:number;newSpecs:number;ambiguousSpecs:number;costUsd:number}>{
 if(input.market!=='BR'||input.brand.toUpperCase()!=='FORD'||
   !/^[a-f0-9-]{36}$/iu.test(input.sourceRunId)||!input.apiKey?.trim())
  throw new Error('FORD_VOCAB_JOB_INVALID');
 const {data:parent,error:parentError}=await input.db.from('agent_runs')
  .select('id,brand,market,agent_type,status').eq('id',input.sourceRunId).single();
 if(parentError||!parent||parent.brand!=='Ford'||parent.market!=='BR'||
   parent.status!=='COMPLETED'||
   !['BRAND_CONNECTOR','MMV_DISCOVERY'].includes(parent.agent_type))
   throw new Error('FORD_VOCAB_PARENT_INVALID');
 if(parent.agent_type==='BRAND_CONNECTOR'){
   const {data:findings,error:findingError}=await input.db.from('agent_findings')
    .select('proposal').eq('run_id',input.sourceRunId).limit(2);
   if(findingError||findings?.length!==1)
     throw new Error('FORD_VOCAB_BRAND_SOURCE_INVALID');
   const proposal=findings[0]?.proposal as {sourceEntries?:{url?:string;type?:string}[]} | null;
   if(!proposal?.sourceEntries?.some(x=>x.url===input.pdfUrl&&x.type==='TECHNICAL_SHEET'))
     throw new Error('FORD_VOCAB_SOURCE_NOT_DISCOVERED');
 }else{
   // A second technical sheet may be found downstream during MMV discovery.
   // Only accept a manufacturer technical-sheet evidence explicitly linked
   // to the Ranger model in that completed MMV run.
   const {data:findings,error:findingError}=await input.db.from('agent_findings')
     .select('id').eq('run_id',input.sourceRunId).eq('finding_type','NEW_MODEL')
     .eq('title','Ford Ranger').limit(4);
   if(findingError||!findings?.length)
     throw new Error('FORD_VOCAB_MMV_RANGER_NOT_FOUND');
   const {data:evidence,error:evidenceError}=await input.db.from('agent_evidence')
     .select('source_url,source_type').in('finding_id',findings.map(f=>f.id))
     .eq('source_url',input.pdfUrl).eq('source_type','TECHNICAL_SHEET').limit(1);
   if(evidenceError||!evidence?.length)
     throw new Error('FORD_VOCAB_SOURCE_NOT_DISCOVERED');
 }
 const bytes=await officialFordPdfBytes(input.pdfUrl);
 const {data:rawCatalog,error:catalogError}=await input.db.from('specs')
  .select('id,code,type,display_pt,detail_pt,detail,unit').limit(2000);
 if(catalogError||!rawCatalog?.length)throw new Error('FORD_VOCAB_CATALOG_UNAVAILABLE');
 const catalog=rawCatalog.map(x=>({
  id:String(x.id),code:String(x.code),kind:String(x.type),
  label:String(x.display_pt??x.detail_pt??x.detail??'')
 }));
 const {data:rawAliases,error:aliasError}=await input.db.from('spec_field_aliases')
  .select('alias,target_spec_id,value_type,status,locale,source_context_key')
  .eq('status','CONFIRMED').eq('locale','pt-BR').limit(1000);
 if(aliasError)throw new Error('FORD_VOCAB_ALIAS_READ_FAILED');
 const byId=new Map(catalog.map(x=>[x.id,x]));
 const aliases=(rawAliases??[]).filter(x=>x.source_context_key==='FORD'&&x.target_spec_id!==null)
  .map(x=>({label:String(x.alias),spec:byId.get(String(x.target_spec_id))}))
  .filter((x):x is {label:string;spec:(typeof catalog)[number]}=>x.spec!==undefined);
 const extraction=await extractFordSpecVocabulary27({
  pdf:bytes,sourceUrl:input.pdfUrl,apiKey:input.apiKey,maxCostUsd:2,
  onUsage:async usage=>{
   const {error}=await input.db.from('agent_ai_usage_events').insert({
    job_id:input.jobId,agent_type:'SPEC_INTELLIGENCE',market:'BR',brand:'Ford',
    provider:'openai',model:usage.model,input_tokens:usage.inputTokens,
    output_tokens:usage.outputTokens,total_tokens:usage.inputTokens+usage.outputTokens,
    web_search_count:0,estimated_cost_usd:usage.costUsd,
    reason:'SPEC_VOCABULARY_DISCOVERY'
   });
   if(error)throw new Error('FORD_VOCAB_USAGE_LEDGER_FAILED');
  }
 });
 const now=new Date().toISOString();
 const entries=extraction.claims.map(claim=>{
  const norm=normalizeAliasLabel(claim.label);
  const sameKind=catalog.filter(s=>s.kind===claim.kind);
  const confirmed=[...new Set(aliases.filter(a=>a.spec.kind===claim.kind&&
   normalizeAliasLabel(a.label)===norm).map(a=>a.spec.code))].sort();
  const exact=[...new Set(sameKind.filter(s=>normalizeAliasLabel(s.label)===norm)
    .map(s=>s.code))].sort();
  const status=confirmed.length===1?'MATCHED_ALIAS':
   confirmed.length>1||exact.length>0?'SPEC_AMBIGUOUS':'SPEC_NEW';
  return {claim,status,match:confirmed.length===1?confirmed[0]:null,
   candidateCodes:[...new Set([...confirmed,...exact])].sort(),
   fingerprint:createHash('sha256').update(JSON.stringify([
    'FORD_VOCAB_V1',extraction.documentHash,claim.ordinal,norm,claim.kind,
    claim.page
   ])).digest('hex')
  };
 });
 const review=entries.filter(x=>x.status!=='MATCHED_ALIAS');
 const findings:AgentRunBundle['findings'][number][]=review.map(x=>{
  const id=randomUUID(),evidenceFingerprint=createHash('sha256')
   .update(x.fingerprint+':source').digest('hex');
  return {finding:{
    id,runId:input.jobId,findingType:'UNMATCHED_SPEC',fingerprint:x.fingerprint,
    subjectKey:JSON.stringify(['FORD_RANGER_VOCAB',extraction.documentHash,x.claim.ordinal]),
    title:('Ford Ranger · '+x.claim.label).slice(0,500),
    summary:x.status==='SPEC_NEW'
      ?'Source term not identified in approved canonical dictionary; review for creation or alias.'
      :'Potential canonical specification match needs review.',
    confidence:null,requiresReview:true,
    subject:{brand:'Ford',model:'Ranger',officialVersionLabel:null,
     modelYear:null,sourceScope:'VOCABULARY_ONLY'} as AgentObject,
    proposal:{action:x.status,reviewOnly:true,candidateCodes:x.candidateCodes,
     sourceLabel:x.claim.label,kind:x.claim.kind,page:x.claim.page,
     versionColumns:[...x.claim.versionColumns],noProductAssignment:true} as AgentObject,
    payload:{reasonCode:x.status,sourceUrl:input.pdfUrl,
     sourceDocumentSha256:extraction.documentHash,
     sourcePage:x.claim.page,sourceExcerpt:x.claim.sourceExcerpt,
     noModelYearInference:true,noEquipmentAssignment:true,canonicalWrites:false} as AgentObject,
    createdAt:now,updatedAt:now
   },evidence:[{
    id:randomUUID(),findingId:id,sourceType:'TECHNICAL_SHEET',
    sourceUrl:input.pdfUrl,sourceDomain:new URL(input.pdfUrl).hostname,
    title:'Ford Ranger official equipment matrix',
    excerpt:x.claim.sourceExcerpt.slice(0,500),
    evidenceFingerprint,metadata:{documentSha256:extraction.documentHash,
      page:x.claim.page,sourceScope:'VOCABULARY_ONLY'},
    capturedAt:now,createdAt:now
   }]};
 });
 const run:AgentRunBundle['run']={
  id:input.jobId,agentType:'SPEC_INTELLIGENCE',status:'COMPLETED',
  market:'BR',brand:'Ford',provider:'openai',
  runMode:'SUPERVISED_VOCABULARY',schemaVersion:'SPEC-S27-VOCAB.1',
  startedAt:input.jobCreatedAt,completedAt:now,
  input:{sourceEvidenceRunId:input.sourceRunId,sourceUrl:input.pdfUrl,
   sourceSha256:extraction.documentHash,model:'Ranger',modelYear:null},
  summary:{claims:entries.length,reviewFindings:review.length,
   newSpecCandidates:review.filter(x=>x.status==='SPEC_NEW').length,
   ambiguousSpecCandidates:review.filter(x=>x.status==='SPEC_AMBIGUOUS').length,
   existingAliasMatches:entries.filter(x=>x.status==='MATCHED_ALIAS').length,
   aiCalls:1,aiInputTokens:extraction.inputTokens,
   aiOutputTokens:extraction.outputTokens,estimatedCostUsd:extraction.costUsd,
   canonicalWrites:false,productSpecWrites:false,
   noModelYearInference:true,catalogDate:extraction.catalogDate},
  configSnapshot:{reviewOnly:true,sourceAuthority:'MANUFACTURER',
   sourceMode:'VOCABULARY_ONLY'},
  error:null,sourceCommitSha:null,createdBy:null,createdAt:input.jobCreatedAt,updatedAt:now
 };
 await new AgentPlatformSupabaseAdapter(input.db).persistRunBundle({run,findings});
 return {runId:run.id,claims:entries.length,newSpecs:review.filter(x=>x.status==='SPEC_NEW').length,
  ambiguousSpecs:review.filter(x=>x.status==='SPEC_AMBIGUOUS').length,
  costUsd:extraction.costUsd};
}
