/** QA-only supervised source-claim runner.
 * No LLM, no product_specs writes, no implicit catalog creation. This runner
 * only accepts a previously extracted, operator-attested immutable source
 * snapshot and publishes review proposals using the existing agent platform.
 * It is NOT a PDF/image extractor.
 */
import {createHash,randomUUID} from 'node:crypto';
import {
 classifySupervisedSpecClaims27,type SupervisedSpecClaim27,
 type SupervisedSpecCatalog27,type SupervisedSpecAlias27,
} from '@compra-car/core/agents';
import type {AgentRunBundle,AgentObject} from '@compra-car/core/agent-platform';
import {AgentPlatformSupabaseAdapter,createLegacySupabaseClient} from '@compra-car/adapter-supabase';
type SupabaseClient=ReturnType<typeof createLegacySupabaseClient>;

export type SupervisedSpecSourceSnapshot=Readonly<{
  target:{productId:number;modelYear:number;brand:string;model:string;version:string};
  source:{url:string;sha256:string;capturedAt:string;declaredModelYear:number;authority:'MANUFACTURER'};
  claims:readonly SupervisedSpecClaim27[];
  /** Provenance verified externally by the operator; never an automatic proof. */
  operatorVerified:true;
}>;
function officialSource(url:string,brand:string):boolean{
  try{
    const u=new URL(url);
    if(u.protocol!=='https:'||u.username||u.password||u.hash)return false;
    const hosts=brand.toLowerCase()==='ford'?
      ['ford.com.br','ford.com','media.ford.com']:[]; // deliberately narrow pilot
    return hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));
  }catch{return false;}
}
function validSnapshot(s:SupervisedSpecSourceSnapshot):void{
  if(!s||s.operatorVerified!==true||s.source?.authority!=='MANUFACTURER'||
    s.target?.brand?.toUpperCase()!=='FORD'||!officialSource(s.source.url,s.target.brand)||
    s.source.declaredModelYear!==s.target.modelYear||
    !Number.isFinite(Date.parse(s.source.capturedAt))||
    !Number.isSafeInteger(s.target.productId)||s.target.productId<1||
    !Array.isArray(s.claims)||s.claims.length<1||s.claims.length>200)
    throw new Error('SPEC_SUPERVISED_SOURCE_NOT_VERIFIED');
}
export async function runSupervisedFordSpecJob(input:{
  jobId:string;market:string;brand:string;snapshot:SupervisedSpecSourceSnapshot;
  db:SupabaseClient;now?:()=>string;approvedAliases?:readonly SupervisedSpecAlias27[];
}):Promise<{runId:string;reviewFindings:number;unmatched:number}>{
  const {snapshot:s,db}=input;validSnapshot(s);
  if(input.market!=='BR'||input.brand.toUpperCase()!=='FORD'||
    !/^[a-f0-9-]{36}$/iu.test(input.jobId))throw new Error('SPEC_SUPERVISED_JOB_INVALID');
  // Fail closed if the target no longer exists. Do not manufacture an MMV identity.
  const target=await db.from('products').select('id').eq('id',s.target.productId).maybeSingle();
  if(target.error||!target.data)throw new Error('SPEC_SUPERVISED_PRODUCT_NOT_FOUND');
  const {data:rawCatalog,error}=await db.from('specs').select('*').limit(2000);
  if(error||!rawCatalog?.length)throw new Error('SPEC_SUPERVISED_CATALOG_UNAVAILABLE');
  const catalog:SupervisedSpecCatalog27[]=rawCatalog.map((raw:Record<string,unknown>)=>({
    id:String(raw.id??''),code:String(raw.code??''),label:String(
      raw.display_pt??raw.detail_pt??raw.detail??''),
    kind:String(raw.type??'') as SupervisedSpecCatalog27['kind'],
    unit:typeof raw.unit==='string'?raw.unit:null
  }));
  const observations=classifySupervisedSpecClaims27({
    brand:s.target.brand,model:s.target.model,version:s.target.version,
    modelYear:s.target.modelYear,documentSha256:s.source.sha256,claims:s.claims,
    catalog,aliases:input.approvedAliases??[]
  });
  const now=input.now?.()??new Date().toISOString();
  const runId=input.jobId; // stable one-shot retry key
  const findings:AgentRunBundle['findings'][number][]=
    observations.filter(o=>o.requiresReview).map(o=>{
      const id=randomUUID();
      const evidenceFingerprint=createHash('sha256').update(
        [s.source.sha256,o.page,o.ordinal,o.fingerprint].join(':')).digest('hex');
      return {
        finding:{
          id,runId,findingType:'UNMATCHED_SPEC',fingerprint:o.fingerprint,
          subjectKey:JSON.stringify(['BR',s.target.productId,s.target.modelYear,o.ordinal]),
          title:[s.target.brand,s.target.model,s.target.version,o.label].join(' · ').slice(0,500),
          summary:o.status==='SPEC_NEW'?'New canonical specification candidate; review required':
            'Possible canonical match; review required',
          confidence:null,requiresReview:true,
          subject:{brand:s.target.brand,model:s.target.model,
            officialVersionLabel:s.target.version,productId:s.target.productId,
            modelYear:s.target.modelYear} as AgentObject,
          proposal:{action:o.status,reviewOnly:true,
            candidateCodes:[...o.candidateCodes],rawValue:o.rawValue,
            kind:o.kind,sourceLabel:o.label,page:o.page} as AgentObject,
          payload:{reasonCode:o.status,sourceDocumentSha256:s.source.sha256,
            sourceUrl:s.source.url,sourcePage:o.page,
            operatorVerified:true,canonicalWrites:false} as AgentObject,
          createdAt:now,updatedAt:now
        },
        evidence:[{
          id:randomUUID(),findingId:id,sourceType:'MANUFACTURER',
          sourceUrl:s.source.url,sourceDomain:new URL(s.source.url).hostname,
          title:null,excerpt:o.label.slice(0,500),
          evidenceFingerprint,
          metadata:{sha256:s.source.sha256,page:o.page,
            modelYear:s.target.modelYear,operatorVerified:true},
          capturedAt:s.source.capturedAt,createdAt:now
        }]
      };
    });
  const run:AgentRunBundle['run']={
    id:runId,agentType:'SPEC_INTELLIGENCE',status:'COMPLETED',
    market:'BR',brand:'Ford',provider:'deterministic',
    runMode:'SUPERVISED_SOURCE_CLAIMS',schemaVersion:'SPEC-S27-REVIEW.1',
    startedAt:now,completedAt:now,
    input:{productId:s.target.productId,modelYear:s.target.modelYear,
      documentSha256:s.source.sha256,sourceUrl:s.source.url,
      operatorVerified:true},
    summary:{claims:observations.length,reviewFindings:findings.length,
      newSpecCandidates:observations.filter(o=>o.status==='SPEC_NEW').length,
      ambiguousSpecCandidates:observations.filter(o=>o.status==='SPEC_AMBIGUOUS').length,
      approvedAliasMatches:observations.filter(o=>o.status==='MATCHED_ALIAS').length,
      aiCalls:0,estimatedCostUsd:0,canonicalWrites:false},
    configSnapshot:{reviewOnly:true,sourceAuthority:'MANUFACTURER'},
    error:null,sourceCommitSha:null,createdBy:null,createdAt:now,updatedAt:now
  };
  await new AgentPlatformSupabaseAdapter(db).persistRunBundle({run,findings});
  return {runId,reviewFindings:findings.length,
    unmatched:observations.filter(o=>o.status==='SPEC_NEW').length};
}
