import { createHash, randomUUID } from 'node:crypto';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { BrandConnectorSupabaseAdapter } from '@compra-car/adapter-supabase/brand-connectors';
import { safeConnectorUrl } from '@compra-car/core/agents';

type Db = ReturnType<typeof createLegacySupabaseClient>;
type Monitored = {
  id:string; mmv_id:string; enabled:boolean; launch_state:string;
  watcher_candidate_id:string|null; origin:string; last_evidence_hash:string|null;
};
type Mmv = {id:string;brand:string;model:string;official_version_label:string|null;status:string;market:string};
const norm=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
  .toLowerCase().replace(/[^a-z0-9]+/gu,'');
const currency=/R\$\s*(?:\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{5,7}(?:,\d{2})?)/iu;
const hasCommercialAction=(s:string)=>
  /(?:monte o seu|configure|comprar|reservar|solicite (?:uma )?proposta|solicitar proposta)/iu.test(s);

export function selectOfficialLaunchPages(
  mmv:Pick<Mmv,'model'|'official_version_label'>,
  entries:readonly {type:string;url:string}[],
):string[]{
  const model=norm(mmv.model),version=norm(mmv.official_version_label??'');
  return [...new Set(entries.filter(e=>e.type==='MODEL_PAGE').flatMap(e=>{
    try{
      const slug=norm(new URL(e.url).pathname.split('/').at(-1)??'');
      // Match only dedicated product leaves; NEVER substitute a sibling trim
      // or infer an unverified model year.
      if(!model || !slug.startsWith(model))return [];
      if(version && !slug.includes(version))return [];
      if(!version && slug!==model)return [];
      return [e.url];
    }catch{return [];}
  }))].slice(0,3);
}

async function officialEvidence(url:string, domains:readonly string[]):Promise<{
  url:string;excerpt:string;hash:string;amount:string;
}|null>{
  const safe=safeConnectorUrl(url,domains);
  if(safe!==url || !url.startsWith('https://'))return null;
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(12000),
      headers:{accept:'text/html'},redirect:'follow'});
    if(!response.ok||!safeConnectorUrl(response.url,domains))return null;
    const size=Number(response.headers.get('content-length')??'0');
    if(size>1_500_000 || !/text\/html/iu.test(response.headers.get('content-type')??''))return null;
    const html=await response.text();
    if(Buffer.byteLength(html,'utf8')>1_500_000)return null;
    const visible=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu,' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu,' ')
      .replace(/<[^>]+>/gu,' ').replace(/&nbsp;/giu,' ')
      .replace(/\s+/gu,' ').trim();
    const price=visible.match(currency)?.[0];
    if(!price || !hasCommercialAction(visible))return null;
    const amount=Number(price.replace(/R\$\s*/u,'').replace(/\./gu,'').replace(',','.'));
    if(!Number.isFinite(amount)||amount<20000||amount>5000000)return null;
    const summary=visible.slice(Math.max(0,visible.indexOf(price)-180),
      visible.indexOf(price)+price.length+180).slice(0,450);
    return {
      url:response.url,excerpt:summary,amount:amount.toFixed(2),
      hash:createHash('sha256').update(response.url+'|'+price+'|'+summary).digest('hex'),
    };
  }catch{return null;}
}

/** Operator-enrolled WATCHER/MANUAL candidate: deterministic commercial
 * evidence only. No AI, no canonical promotion, no implicit downstream jobs.
 */
export async function runMmvLaunchWatch(
  client:Db,
  input:{brand:string;market:string;watchId?:string;mmvId?:string;auditOnly?:boolean},
  log:(line:string)=>void=console.log,
):Promise<string>{
  if(input.market!=='BR')throw new Error('LAUNCH_WATCH_BR_ONLY');
  if(!input.watchId && !(input.auditOnly && input.mmvId))
    throw new Error('LAUNCH_WATCH_APPROVED_TARGET_REQUIRED');
  let tracked:Monitored|null=null;
  if(input.watchId){
    const {data,error}=await client.from('agent_mmv_launch_watch')
      .select('id,mmv_id,enabled,launch_state,watcher_candidate_id,origin,last_evidence_hash')
      .eq('id',input.watchId).single();
    if(error||!data||!data.enabled||data.launch_state!=='AWAITING_LAUNCH')
      throw new Error('LAUNCH_WATCH_TARGET_NOT_ELIGIBLE');
    tracked=data as Monitored;
  }
  const mmvId=tracked?.mmv_id??input.mmvId!;
  const {data:mmv,error:mmvError}=await client.from('catalog_mmvs')
    .select('id,brand,model,official_version_label,status,market').eq('id',mmvId).single();
  if(mmvError||!mmv||mmv.brand!==input.brand||mmv.market!=='BR'||mmv.status!=='ACTIVE')
    throw new Error('LAUNCH_WATCH_CANONICAL_MMV_REQUIRED');
  if(tracked?.origin==='WATCHER_APPROVED'){
    const {data:watcher,error:watchError}=await client.from('watcher_candidates')
      .select('status,brand,market').eq('id',tracked.watcher_candidate_id).single();
    if(watchError||watcher?.status!=='EXPECTED_BR'||watcher.brand!==mmv.brand||
      watcher.market!=='BR')throw new Error('LAUNCH_WATCH_WATCHER_NOT_APPROVED');
  }
  const connector=await new BrandConnectorSupabaseAdapter(client)
    .getActiveConnector(mmv.brand,mmv.market);
  if(!connector)throw new Error('LAUNCH_WATCH_BRAND_CONNECTOR_REQUIRED');
  const pages=selectOfficialLaunchPages(mmv as Mmv,connector.sourceEntries);
  const started=new Date().toISOString(),runId=randomUUID();
  const findings=await Promise.all(pages.map(url=>officialEvidence(url,connector.allowedDomains)));
  const candidate=findings.find((e):e is NonNullable<typeof e>=>e!==null);
  const state=candidate?'LAUNCH_EVIDENCE_REQUIRES_REVIEW':
    pages.length?'NO_NEW_COMMERCIAL_EVIDENCE':'MODEL_VERSION_SOURCE_NOT_MAPPED';
  const summary={
    launchWatchMmvId:mmvId,linkedWatcherCandidateId:tracked?.watcher_candidate_id??null,
    sourcesChecked:pages.length,evidenceFound:Boolean(candidate),
    priceObservedBrl:candidate?.amount??null,aiCalls:0,estimatedCostUsd:0,
    decision:state,approvalRequired:Boolean(candidate),
    noCanonicalMutation:true,
  };
  const completed=new Date().toISOString();
  const {error:runError}=await client.from('agent_runs').insert({
    id:runId,agent_type:'MMV_DISCOVERY',status:'COMPLETED',market:'BR',
    brand:mmv.brand,provider:'deterministic',run_mode:'LAUNCH_WATCH',
    schema_version:'MMV-LAUNCH-WATCH-1',started_at:started,
    completed_at:completed,input:{mmvId,watchId:tracked?.id??null,auditOnly:!!input.auditOnly},
    summary,
  });
  if(runError)throw new Error('LAUNCH_WATCH_RUN_PERSIST_FAILED');
  let findingId:string|null=null;
  if(candidate && tracked && !input.auditOnly &&
      tracked.last_evidence_hash!==candidate.hash){
    findingId=randomUUID();
    const fingerprint=createHash('sha256').update(mmvId+':'+candidate.hash).digest('hex');
    const {error:fe}=await client.from('agent_findings').insert({
      id:findingId,run_id:runId,finding_type:'LAUNCH_EVIDENCE',fingerprint,
      subject_key:mmvId,title:mmv.brand+' '+mmv.model+' '+(mmv.official_version_label??'')+
        ' — comercialização a confirmar',
      summary:'Fonte comercial oficial apresenta valor e opção de configuração/compra; confirmar lançamento antes de aprovar.',
      confidence:0.78,requires_review:true,
      subject:{mmvId,brand:mmv.brand,model:mmv.model,
        version:mmv.official_version_label},
      proposal:{action:'CONFIRM_LAUNCH',mmvId,sourceUrl:candidate.url,
        commercialState:'ON_SALE_CONFIRMED'},
      payload:{reasonCode:'OFFICIAL_COMMERCIAL_EVIDENCE_OBSERVED',
        modelYearVerified:false,priceIsCanonical:false,
        priceObservedBrl:candidate.amount,origin:tracked.origin},
    });
    if(fe)throw new Error('LAUNCH_WATCH_FINDING_PERSIST_FAILED');
    const {error:evidenceError}=await client.from('agent_evidence').insert({
      id:randomUUID(),finding_id:findingId,source_type:'COMMERCIAL_OFFER',
      source_url:candidate.url,source_domain:new URL(candidate.url).hostname,
      title:'Página comercial oficial',excerpt:candidate.excerpt,
      evidence_fingerprint:candidate.hash,metadata:{
        method:'DETERMINISTIC_PRICE_AND_CTA',modelYearVerified:false,
      },captured_at:completed,
    });
    if(evidenceError)throw new Error('LAUNCH_WATCH_EVIDENCE_PERSIST_FAILED');
  }
  if(tracked && !input.auditOnly){
    const update={
      last_checked_at:completed,last_evidence_hash:candidate?.hash??tracked.last_evidence_hash,
      next_check_at:new Date(Date.now()+(candidate?7:3)*86400000).toISOString(),
      launch_state: candidate ? 'EVIDENCE_FOUND':'AWAITING_LAUNCH',
      updated_at:completed,...(findingId?{last_finding_id:findingId}:{}),
    };
    const {error:updateError}=await client.from('agent_mmv_launch_watch')
      .update(update).eq('id',tracked.id).eq('launch_state','AWAITING_LAUNCH');
    if(updateError)throw new Error('LAUNCH_WATCH_UPDATE_FAILED');
  }
  log('LAUNCH_WATCH '+JSON.stringify(summary));
  log('Run: '+runId);
  return runId;
}
