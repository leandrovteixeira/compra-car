import { vehicleBrandComparisonKey } from '@compra-car/core/agents';
import type { ReviewCaseKind, ReviewStatus } from '@compra-car/core/agent-platform';

/**
 * Read-only normalization of legacy findings. This is NOT a canonical mutation,
 * automatic review, evidence merger or agent-to-agent delegation.
 */
export type LegacyDiscovery = Readonly<{
  id: string;
  run_id: string;
  finding_type: string;
  fingerprint: string;
  subject_key: string | null;
  title: string;
  summary: string | null;
  confidence: number | string | null;
  subject: Record<string, unknown>;
  proposal: unknown;
  payload: Record<string, unknown> | null;
  created_at: string;
}>;
export type LegacyRun = Readonly<{
  id: string;
  agent_type: string;
  brand: string | null;
  status: string;
  started_at: string;
  market: string | null;
}>;
export type LegacyReview = Readonly<{ finding_id: string; decision: string; created_at: string }>;
export type ProjectedCase = {
  finding: LegacyDiscovery;
  run: LegacyRun;
  kind: ReviewCaseKind;
  businessKey: string;
  brand: string;
  model: string;
  discovery: string;
  recommendation: string;
  priorRuns: number;
  reviewedSameFingerprint: string | null;
};
export type ProjectionDiagnostics = Readonly<{
  yearToMmv: number;
  yearToMmvIdentities: number;
  genericBodySplit: number;
  redundantAmbiguities: number;
  legacyYear: number;
}>;

const value = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const key = (v: string): string => v.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '')
  .toLocaleLowerCase('pt-BR').replace(/\s+/gu,' ').trim();
const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const objects = (v: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => obj(x) !== null) : [];

const GENERIC_BODY_TYPES = new Set([
  'suv','suv compacto','suv medio','suv grande','crossover',
  'hatch','hatchback','sedan','minivan','picape','pickup',
  'caminhonete','wagon','perua','coupe','cupe','conversivel',
  'picape cabine simples','picape cabine dupla','cabine simples','cabine dupla',
]);

function variants(f: LegacyDiscovery): readonly string[] {
  const p = obj(f.proposal);
  return [...new Set(objects(p?.identities)
    .map((o) => value(o.officialVersionLabel)||value(o.trim))
    .filter(Boolean))];
}
function candidateVersion(f: LegacyDiscovery): string {
  const raw = obj(f.payload?.structuredCandidate);
  return value(f.subject.officialVersionLabel) ||
    value(raw?.officialVersionLabel) || value(raw?.trim);
}
function subject(f: LegacyDiscovery, r: LegacyRun) {
  const raw = obj(f.payload?.structuredCandidate);
  const brand = value(f.subject.brand) || value(raw?.brand) || r.brand || '';
  const model = value(f.subject.model) || value(raw?.model);
  const canonicalBrand = vehicleBrandComparisonKey(brand || '—');
  return {brand, model, brandKey: canonicalBrand,
    modelKey: key(model), market:r.market??'BR'};
}
function completeness(f: LegacyDiscovery): number {
  const p=obj(f.proposal);
  const ids=objects(p?.identities);
  const technical=ids.reduce((count,v)=>
    count+['powertrainLabel','propulsion','bodyStyle','engineDisplacement']
      .filter(k=>v[k]!==null&&v[k]!==undefined).length,0);
  return ids.length*100+technical*5+(f.confidence===null?0:Number(f.confidence));
}
function better(a:LegacyDiscovery,b:LegacyDiscovery): boolean {
  const scoreA=completeness(a),scoreB=completeness(b);
  return scoreA!==scoreB?scoreA>scoreB:
    Date.parse(a.created_at)!==Date.parse(b.created_at)
      ?Date.parse(a.created_at)>Date.parse(b.created_at):a.id.localeCompare(b.id)>0;
}
export function buildReviewProjection(
  findings: readonly LegacyDiscovery[],
  runs: ReadonlyMap<string,LegacyRun>,
  reviews: ReadonlyMap<string,LegacyReview>,
): {cases: ProjectedCase[];diagnostics:ProjectionDiagnostics} {
  const latestVersionsByModel = new Map<string,Set<string>>();
  const rawCandidates: Array<{f:LegacyDiscovery;r:LegacyRun;brand:string;model:string;brandKey:string;modelKey:string;market:string}> = [];
  for (const f of findings) {
    const r=runs.get(f.run_id);
    if (!r||r.status!=='COMPLETED')continue;
    const s=subject(f,r);
    rawCandidates.push({f,r,...s});
    if (r.agent_type==='MMV_DISCOVERY'&&f.finding_type==='NEW_MODEL'&&variants(f).length) {
      const group=JSON.stringify([s.market,s.brandKey,s.modelKey]);
      const versions=latestVersionsByModel.get(group)??new Set<string>();
      for(const v of variants(f))versions.add(key(v));
      latestVersionsByModel.set(group,versions);
    }
  }

  const groups=new Map<string,ProjectedCase>();
  const diagnostics={yearToMmv:0,yearToMmvIdentities:new Set<string>(),
    genericBodySplit:0,redundantAmbiguities:0,legacyYear:0};
  for(const {f,r,brand,model,brandKey,modelKey,market} of rawCandidates){
    const reason=value(f.payload?.reasonCode);
    const v=candidateVersion(f);
    const baseKey=JSON.stringify([market,brandKey,modelKey]);
    let kind: ReviewCaseKind|null=null;
    let businessKey='';
    let discovery='';
    let recommendation='';

    if(r.agent_type==='BRAND_CONNECTOR'){
      if(f.finding_type==='NEW_BRAND_CONNECTOR') {
        kind='CONNECTOR_NEW';businessKey=JSON.stringify(['CONNECTOR',market,brandKey,'new']);
        discovery='Novas fontes oficiais';recommendation='Validar inclusão das fontes';
      }else if(f.finding_type==='CONNECTOR_DRIFT'&&f.proposal){
        kind='CONNECTOR_UPDATE';businessKey=JSON.stringify(['CONNECTOR',market,brandKey,'update']);
        discovery=/404|endere[cç]o|replacement path|substitut/i.test(f.summary??'')
          ?'Mudança de endereço de fonte':'Atualização de fontes oficiais';
        recommendation=/404|endere[cç]o|replacement path|substitut/i.test(f.summary??'')
          ?'Validar substituição do link':'Validar atualização das fontes';
      }
    }else if(r.agent_type==='MMV_DISCOVERY'){
      if(f.finding_type==='NEW_MODEL'&&variants(f).length){
        kind='MMV_NEW';businessKey=JSON.stringify(['MMV_MODEL',baseKey]);
        const versions=variants(f);
        discovery=versions.length===1?'Novo modelo · '+versions[0]
          :'Novo modelo · '+versions.length+' versões: '+versions.join(', ');
        recommendation=versions.length===1?'Validar novo MMV':'Validar '+versions.length+' MMVs';
      }else if(f.finding_type==='NEW_VERSION'&&f.proposal){
        kind='MMV_NEW';businessKey=JSON.stringify(['MMV_VERSION',baseKey,key(v)]);
        discovery='Nova versão · '+(v||'a confirmar');
        recommendation='Validar nova versão';
      }else if(f.finding_type==='AMBIGUOUS_MMV'){
        if(reason==='POSSIBLE_BODY_SPLIT'){
          const body=value(f.subject.bodyStyle);
          const proposed=value(obj(f.proposal)?.proposedModel);
          if(GENERIC_BODY_TYPES.has(key(body))&&key(proposed)===key(model+' '+body)){
            diagnostics.genericBodySplit++;continue;
          }
          kind='MMV_AMBIGUOUS';businessKey=JSON.stringify(['BODY_SPLIT',baseKey,key(body)]);
          discovery='Possível modelo independente';
          recommendation='Confirmar identidade comercial';
        }else{
          const known=latestVersionsByModel.get(baseKey);
          if(!v&&known?.size){
            diagnostics.redundantAmbiguities++;continue;
          }
          if(v&&known?.has(key(v))){
            diagnostics.redundantAmbiguities++;continue;
          }
          kind='MMV_AMBIGUOUS';businessKey=JSON.stringify(['AMBIGUOUS_MMV',baseKey,key(v)]);
          discovery='Versão sem correspondência'+(v?' · '+v:'');
          recommendation='Criar ou vincular MMV';
        }
      }
    }else if(r.agent_type==='MODEL_YEAR'||r.agent_type==='PRODUCT_YEAR'){
      // Historical MODEL_YEAR stores a text identity, not a canonical mmvId.
      // It is not an actionable MY proposal under the current apply contract.
      if(r.agent_type==='MODEL_YEAR'){
        diagnostics.legacyYear++;
        continue;
      }
      if(f.finding_type==='POSSIBLE_NEW_MMV'||f.finding_type==='PRODUCT_YEAR_CONFLICT'){
        diagnostics.yearToMmv++;
        diagnostics.yearToMmvIdentities.add(JSON.stringify([baseKey,key(v)]));
        continue; // Internal dependency, not a Model Year operator decision.
      }
      if(f.finding_type==='NEW_PRODUCT_YEAR'||f.finding_type==='NEW_MODEL_YEAR'){
        if(reason==='CONFIRMED_MODEL_YEAR')continue;
        kind='MODEL_YEAR_NEW';
        const my=f.subject.modelYear,py=f.subject.productionYear;
        businessKey=JSON.stringify(['MODEL_YEAR',baseKey,key(v),my??'',py??'']);
        discovery='Novo ano-modelo · '+(typeof my==='number'?my:'verificar');
        recommendation='Validar ano-modelo';
      }
    }else if(r.agent_type==='PRICE_INTELLIGENCE'){
      if(f.finding_type==='NEW_PRICE'||f.finding_type==='PRICE_CHANGE'){
        kind=f.finding_type==='NEW_PRICE'?'PRICE_NEW':'PRICE_CHANGE';
        businessKey=JSON.stringify(['PRICE',baseKey,key(v),f.subject_key]);
        discovery=kind==='PRICE_NEW'?'Novo preço':'Alteração de preço';
        recommendation='Validar preço público';
      }
    }else if(r.agent_type==='SPEC_INTELLIGENCE'){
      if(f.finding_type==='UNMATCHED_SPEC'||f.finding_type==='SPEC_CHANGE'){
        kind=f.finding_type==='UNMATCHED_SPEC'?'SPEC_AMBIGUOUS':'SPEC_NEW';
        businessKey=JSON.stringify(['SPEC',baseKey,f.subject_key]);
        discovery=kind==='SPEC_AMBIGUOUS'?'Spec sem correspondência':'Nova especificação';
        recommendation='Criar ou reconciliar spec';
      }
    }
    if(!kind)continue;
    const review=reviews.get(f.id)?.decision??null;
    const old=groups.get(businessKey);
    if(!old){
      groups.set(businessKey,{finding:f,run:r,kind,businessKey,brand,model,
        discovery,recommendation,priorRuns:1,reviewedSameFingerprint:review});
    }else{
      old.priorRuns++;
      if(better(f,old.finding)){
        old.finding=f;old.run=r;old.brand=brand;old.model=model;
        old.discovery=discovery;old.recommendation=recommendation;
        old.reviewedSameFingerprint=review;
      }else if(f.fingerprint===old.finding.fingerprint&&!old.reviewedSameFingerprint){
        old.reviewedSameFingerprint=review;
      }
    }
  }
  return {cases:[...groups.values()],
    diagnostics:{yearToMmv:diagnostics.yearToMmv,
      yearToMmvIdentities:diagnostics.yearToMmvIdentities.size,
      genericBodySplit:diagnostics.genericBodySplit,
      redundantAmbiguities:diagnostics.redundantAmbiguities,
      legacyYear:diagnostics.legacyYear}};
}

export function reviewState(decision: string|null):ReviewStatus {
  if(decision==='REJECT')return 'REJECTED';
  if(decision==='DEFER')return 'POSTPONED';
  return 'WAITING'; // Legacy ACCEPT is NOT proof of canonical application.
}

/** Canonical state takes precedence over a legacy discovery snapshot.
 * Suppresses only proposals whose EVERY commercial identity already exists.
 * Partial batches remain visible pending per-variant review contract.
 */
export type CurrentCanonicalMmv = Readonly<{
  id: string;
  market: string;
  brand: string;
  model: string;
  official_version_label: string;
  powertrain_label: string | null;
  propulsion: string | null;
  status: string;
}>;

function sameCanonicalIdentity(
  proposal: Record<string, unknown>,
  item: CurrentCanonicalMmv,
  market: string,
): boolean {
  const brand = value(proposal.brand), model = value(proposal.model);
  const version = value(proposal.officialVersionLabel) || value(proposal.trim);
  if (!brand || !model || !version || item.status !== 'ACTIVE' ||
      market !== item.market ||
      vehicleBrandComparisonKey(brand) !== vehicleBrandComparisonKey(item.brand) ||
      key(model) !== key(item.model) ||
      key(version) !== key(item.official_version_label)) return false;
  const propulsion = value(proposal.propulsion);
  const powertrain = value(proposal.powertrainLabel);
  return (!propulsion || !item.propulsion || key(propulsion) === key(item.propulsion)) &&
    (!powertrain || !item.powertrain_label ||
      key(powertrain) === key(item.powertrain_label));
}

export function isResolvedMmvCase(
  candidate: ProjectedCase,
  canonical: readonly CurrentCanonicalMmv[],
): boolean {
  if (candidate.kind === 'MMV_NEW') {
    const identities = objects(obj(candidate.finding.proposal)?.identities);
    return identities.length > 0 && identities.every(identity =>
      canonical.some(item => sameCanonicalIdentity(identity,item,candidate.run.market ?? 'BR')));
  }
  if (candidate.kind !== 'MMV_AMBIGUOUS' ||
      value(candidate.finding.payload?.reasonCode) !== 'AMBIGUOUS_IDENTITY') return false;
  const observed = candidate.finding.subject;
  const known = objects(observed.canonicalMmv);
  const brand=value(observed.brand), model=value(observed.model);
  const version=value(observed.officialVersionLabel);
  return !!brand && !!model && !!version && known.some(match =>
    canonical.some(item =>
      item.id===value(match.id) &&
      sameCanonicalIdentity({brand,model,officialVersionLabel:version},
        item,candidate.run.market??'BR')));
}
