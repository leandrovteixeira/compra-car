import 'server-only';

import { requireRole } from '@/auth/authorization';
import { createPrivilegedAdminClient } from '@/auth/admin-client';
import type { ReviewStatus, ReviewQueueItem } from '@compra-car/core/agent-platform';
import {
  buildReviewProjection, reviewState, isResolvedMmvCase,
  type LegacyDiscovery, type LegacyRun, type LegacyReview, type CurrentCanonicalMmv,
  type ProjectionDiagnostics,
} from './agent-review-projection';

/** Read-only UX projection: no reviews or catalog data are written here. */
export type ReviewInboxRow = ReviewQueueItem & Readonly<{
  findingId: string;
  runId: string;
  identityDecision: 'ACCEPT'|'REJECT'|'DEFER'|null;
  findingType: string;
  agentLabel: string;
  reasonCode: string | null;
  brand: string;
  model: string;
  version: string;
  selectedIdentity: Record<string,unknown> | null;
  possibleAppearanceVariant: boolean;
  legacyAccepted: boolean;
  priorRuns: number;
}>;

export type ReviewSort = 'date' | 'confidence' | 'brand' | 'model' | 'agent';
export type ReviewDirection = 'asc' | 'desc';
export type ReviewInboxResponse = Readonly<{
  items: readonly ReviewInboxRow[];
  total: number;
  statusCounts: Record<ReviewStatus, number>;
  diagnostics: ProjectionDiagnostics;
}>;

const labels:Record<string,string>={
  BRAND_CONNECTOR:'Brand Connector',
  MMV_DISCOVERY:'MMV Discovery',
  MODEL_YEAR:'Ano-modelo',
  PRODUCT_YEAR:'Ano-modelo',
  PRICE_INTELLIGENCE:'Preços',
  SPEC_INTELLIGENCE:'Specs',
};
const cleanText=(s:string):string=>s
  .replace(/\s*#{1,6}\s*/gu,' ').replace(/[\r\n\t]+/gu,' ')
  .replace(/\s{2,}/gu,' ').trim();

async function readAllFindings(client:ReturnType<typeof createPrivilegedAdminClient>):
Promise<LegacyDiscovery[]> {
  const result:LegacyDiscovery[]=[];
  for(let offset=0;offset<5000;offset+=500){
    const {data,error}=await client.from('agent_findings')
      .select('id,run_id,finding_type,fingerprint,subject_key,title,summary,confidence,subject,proposal,payload,created_at')
      .eq('requires_review',true)
      .order('created_at',{ascending:false})
      .order('id',{ascending:true})
      .range(offset,offset+499);
    if(error||!data)throw new Error('REVIEW_INBOX_FINDINGS_UNAVAILABLE');
    result.push(...(data as LegacyDiscovery[]));
    if(data.length<500)return result;
  }
  throw new Error('REVIEW_INBOX_PAGINATION_LIMIT');
}
const col=(r:ReviewInboxRow,sort:ReviewSort):number|string|null=>{
  switch(sort){
    case 'date':return Date.parse(r.observedAt);
    case 'confidence':return r.confidence;
    case 'brand':return r.brand.toLocaleLowerCase('pt-BR');
    case 'model':return r.model.toLocaleLowerCase('pt-BR');
    case 'agent':return r.agentLabel.toLocaleLowerCase('pt-BR');
  }
};

export async function loadReviewInbox(options:Readonly<{
  page?:number;
  limit?:number;
  status?:ReviewStatus|'ALL';
  agent?:string;
  search?:string;
  sort?:ReviewSort;
  direction?:ReviewDirection;
}>={}):Promise<ReviewInboxResponse>{
  await requireRole('admin');
  const client=createPrivilegedAdminClient();
  const [findings,runsResult,reviewsResult,canonicalResult,connectorResult]=await Promise.all([
    readAllFindings(client),
    client.from('agent_runs').select('id,agent_type,brand,status,started_at,market'),
    client.from('agent_reviews').select('finding_id,decision,created_at')
      .order('created_at',{ascending:false}),
    client.from('catalog_mmvs')
      .select('id,market,brand,model,official_version_label,powertrain_label,propulsion,status')
      .eq('status','ACTIVE'),
    client.from('brand_connectors').select('source_finding_id').eq('status','ACTIVE'),
  ]);
  if(runsResult.error||reviewsResult.error||canonicalResult.error||connectorResult.error||
     !runsResult.data||!reviewsResult.data||!canonicalResult.data||!connectorResult.data)
    throw new Error('REVIEW_INBOX_DATA_UNAVAILABLE');

  const runs=new Map((runsResult.data as LegacyRun[]).map(run=>[run.id,run]));
  const reviews=new Map<string,LegacyReview>();
  for(const review of reviewsResult.data as LegacyReview[])
    if(!reviews.has(review.finding_id))reviews.set(review.finding_id,review);

  const projected=buildReviewProjection(findings,runs,reviews);
  const existingCanonical=canonicalResult.data as CurrentCanonicalMmv[];
  // Historical ACCEPT is not an apply receipt; verify real canonical identities.
  const activeConnectorSources=new Set(connectorResult.data.map(item=>item.source_finding_id));
  const activeCases=projected.cases.filter(g=>
    !isResolvedMmvCase(g,existingCanonical) &&
    !(g.kind.startsWith('CONNECTOR_') && activeConnectorSources.has(g.finding.id))
  );
  const all:ReviewInboxRow[]=activeCases.map(g=>{
    const confidence=g.finding.confidence==null?null:Number(g.finding.confidence);
    return {
      caseId:g.businessKey,
      caseKind:g.kind,
      findingId:g.finding.id,
      runId:g.run.id,
      identityDecision:null,
      findingType:g.finding.finding_type,
      sourceFindingType:g.finding.finding_type,
      sourceAgent:g.run.agent_type,
      agentLabel:labels[g.run.agent_type]??g.run.agent_type,
      reasonCode:typeof g.finding.payload?.reasonCode==='string'
        ?g.finding.payload.reasonCode:null,
      businessKey:g.businessKey,
      brand:g.brand,
      model:g.model,
      version:g.version,
      selectedIdentity:g.selectedIdentity,
      possibleAppearanceVariant:g.possibleAppearanceVariant,
      title:g.discovery,
      shortDescription:g.discovery,
      recommendation:g.recommendation,
      confidence:Number.isFinite(confidence)?confidence:null,
      evidenceCount:0,
      evidencePreview:null,
      primaryEvidenceUrl:null,
      observedAt:g.finding.created_at,
      status:reviewState(g.reviewedSameFingerprint),
      snapshotFingerprint:g.finding.fingerprint,
      caseVersion:0,
      legacyAccepted:g.reviewedSameFingerprint==='ACCEPT',
      priorRuns:g.priorRuns,
    };
  });
  // Read immutable individual decisions and overlay only the exact identity
  // and source finding fingerprint, never an unrelated sibling's review.
  const {data:individualReviews,error:individualError}=await client
    .from('agent_mmv_identity_reviews')
    .select('finding_id,identity_key,finding_fingerprint,decision,created_at,id')
    .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(5000);
  if(individualError||!individualReviews)throw new Error('REVIEW_INBOX_IDENTITY_DECISIONS_UNAVAILABLE');
  const latestByIdentity=new Map<string,string>();
  for(const receipt of individualReviews){
    const lookup=JSON.stringify([receipt.finding_id,receipt.identity_key,receipt.finding_fingerprint]);
    if(!latestByIdentity.has(lookup))latestByIdentity.set(lookup,receipt.decision);
  }
  for(let i=0;i<all.length;i++){
    const row=all[i]!;
    const identityKey=row.selectedIdentity?.identityKey;
    if(typeof identityKey!=='string')continue;
    const decision=latestByIdentity.get(JSON.stringify([row.findingId,identityKey,row.snapshotFingerprint]));
    if(decision==='ACCEPT'||decision==='REJECT'||decision==='DEFER'){
      all[i]={...row,identityDecision:decision,
        status:decision==='ACCEPT'?'APPROVED':decision==='REJECT'?'REJECTED':'POSTPONED'};
    }
  }
  const statusCounts:Record<ReviewStatus,number>={
    WAITING:0,APPROVED:0,REJECTED:0,POSTPONED:0,
  };
  for(const item of all)statusCounts[item.status]++;

  const term=options.search?.trim().toLocaleLowerCase('pt-BR')??'';
  const filtered=all.filter(row=>
    (!options.status||options.status==='ALL'||row.status===options.status)&&
    (!options.agent||(
      options.agent==='YEAR'
        ?['MODEL_YEAR','PRODUCT_YEAR'].includes(row.sourceAgent)
        :row.sourceAgent===options.agent))&&
    (!term||[row.brand+' '+row.model+' '+row.version,row.brand+' '+row.model,
      row.brand,row.model,row.version,row.title,row.shortDescription,
      row.recommendation,row.agentLabel,row.reasonCode]
      .some(v=>v?.toLocaleLowerCase('pt-BR').includes(term)))
  );
  const sort=options.sort??'date';
  const direction=options.direction??'desc';
  const sign=direction==='asc'?1:-1;
  filtered.sort((a,b)=>{
    const va=col(a,sort),vb=col(b,sort);
    if(va===null&&vb!==null)return 1;
    if(vb===null&&va!==null)return -1;
    let comparison=0;
    if(typeof va==='number'&&typeof vb==='number')comparison=va-vb;
    if(typeof va==='string'&&typeof vb==='string')comparison=va.localeCompare(vb,'pt-BR');
    return sign*comparison||Date.parse(b.observedAt)-Date.parse(a.observedAt)||
      a.findingId.localeCompare(b.findingId);
  });
  const page=Number.isSafeInteger(options.page)&&options.page!>0?options.page!:1;
  const limit=Number.isSafeInteger(options.limit)?Math.min(50,Math.max(1,options.limit!)):25;
  const visible=filtered.slice((page-1)*limit,page*limit);

  if(visible.length){
    const {data:evidence,error}=await client.from('agent_evidence')
      .select('finding_id,source_url,excerpt,title')
      .in('finding_id',visible.map(row=>row.findingId))
      .order('created_at',{ascending:false}).limit(1000);
    if(error||!evidence)throw new Error('REVIEW_INBOX_EVIDENCE_UNAVAILABLE');
    const first=new Map<string,{source_url:string;excerpt:string|null;title:string|null}>();
    const counts=new Map<string,number>();
    for(const item of evidence){
      counts.set(item.finding_id,(counts.get(item.finding_id)??0)+1);
      if(!first.has(item.finding_id))first.set(item.finding_id,item);
    }
    for(let i=0;i<visible.length;i++){
      const row=visible[i]!;
      const matched=first.get(row.findingId);
      visible[i]={
        ...row,evidenceCount:counts.get(row.findingId)??0,
        evidencePreview:matched?cleanText(matched.title||matched.excerpt||'').slice(0,100)||null:null,
        primaryEvidenceUrl:matched?.source_url??null,
      };
    }
  }
  return {items:visible,total:filtered.length,statusCounts,
    diagnostics:projected.diagnostics};
}
