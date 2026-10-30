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
  version: string;
  selectedIdentity: Record<string,unknown> | null;
  possibleAppearanceVariant: boolean;
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

/** Manufacturer-family naming used only for projection; findings stay immutable. */
function projectedModel(brand: string, model: string): string {
  if (vehicleBrandComparisonKey(brand) === 'gwm' && /^h[679]$/iu.test(model.trim()))
    return 'HAVAL ' + model.trim().toUpperCase();
  return model;
}
function projectedVersion(model: string, raw: string): string {
  const label = raw.trim();
  const normalizedModel = key(model);
  const normalizedLabel = key(label);
  if (!label || normalizedLabel === normalizedModel) return '';
  const tokens = model.trim().split(/\s+/u);
  const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/gu, '\\const GENERIC_BODY_TYPES = new Set([')).join('\\s+');
  return label.replace(new RegExp('^' + pattern + '(?:\\s+|$)', 'iu'), '').trim();
}

const GENERIC_BODY_TYPES = new Set([
  'suv','suv compacto','suv medio','suv grande','crossover',
  'hatch','hatchback','sedan','minivan','picape','pickup',
  'caminhonete','wagon','perua','coupe','cupe','conversivel',
  'picape cabine simples','picape cabine dupla','cabine simples','cabine dupla',
]);

function identityVariants(f: LegacyDiscovery): readonly Record<string,unknown>[] {
  // A slash-delimited list or model name alone is not a commercial version.
  // Keep the raw observation and evidence, but do not offer approval of a fake MMV.
  const model=projectedModel(value(f.subject.brand),value(f.subject.model)).toLocaleLowerCase('pt-BR').trim();
  return objects(obj(f.proposal)?.identities).filter(o=>{
    const label=projectedVersion(model,value(o.officialVersionLabel)||value(o.trim));
    return !!label &&
      label.toLocaleLowerCase('pt-BR').trim()!==model &&
      !/\s+\/\s+/u.test(label);
  });
}
function variants(f: LegacyDiscovery): readonly string[] {
  const m=projectedModel(value(f.subject.brand),value(f.subject.model));
  return [...new Set(identityVariants(f).map(o=>projectedVersion(m,value(o.officialVersionLabel)||value(o.trim))))];
}
function variantLabel(identity: Record<string,unknown>): string {
  return value(identity.officialVersionLabel) || value(identity.trim);
}
function appearanceParent(
  identity: Record<string,unknown>,
  siblings: readonly Record<string,unknown>[],
): string | null {
  const label=variantLabel(identity);
  // An explicitly offered appearance suffix is a *review hint*, not an automatic merge.
  const base=label.replace(/\s+(?:fosco|fosca|matte|matt)$/iu,'').trim();
  if(base===label)return null;
  const found=siblings.find(other=>key(variantLabel(other))===key(base));
  return found ? variantLabel(found) : null;
}
function candidateVersion(f: LegacyDiscovery): string {
  const raw = obj(f.payload?.structuredCandidate);
  const model=projectedModel(value(f.subject.brand),value(f.subject.model));
  return projectedVersion(model,value(f.subject.officialVersionLabel) ||
    value(raw?.officialVersionLabel) || value(raw?.trim));
}
function subject(f: LegacyDiscovery, r: LegacyRun) {
  const raw = obj(f.payload?.structuredCandidate);
  const brand = value(f.subject.brand) || value(raw?.brand) || r.brand || '';
  const model = projectedModel(brand,value(f.subject.model) || value(raw?.model));
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
    const proposedVariants=r.agent_type==='MMV_DISCOVERY' &&
      ['NEW_MODEL','NEW_VERSION'].includes(f.finding_type)
      ?identityVariants(f):[];
    // One projected business case per commercial identity. Old source finding IDs
    // remain intact: each row links to the same original evidence snapshot.
    const individual=proposedVariants.length>0
      ?proposedVariants : [null];
    for(const identity of individual){
      const label=identity?projectedVersion(model,variantLabel(identity)):v;
      const paintParent=identity?appearanceParent(identity,proposedVariants):null;
      let kind:ReviewCaseKind|null=null;
      let businessKey='';
      let discovery='';
      let recommendation='';

      if(r.agent_type==='BRAND_CONNECTOR'){
        if(f.finding_type==='NEW_BRAND_CONNECTOR'){
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
        if(identity&&['NEW_MODEL','NEW_VERSION'].includes(f.finding_type)){
          kind=paintParent?'MMV_AMBIGUOUS':'MMV_NEW';
          businessKey=JSON.stringify(['MMV',baseKey,key(label)]);
          discovery=paintParent?'Possível variação de acabamento':'Nova versão';
          recommendation=paintParent?'Criar ou vincular à '+paintParent:'Validar novo MMV';
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
            discovery='Identidade comercial ambígua';
            recommendation='Criar ou vincular MMV';
          }
        }
      }else if(r.agent_type==='MODEL_YEAR'||r.agent_type==='PRODUCT_YEAR'){
        if(r.agent_type==='MODEL_YEAR'){
          diagnostics.legacyYear++;continue;
        }
        if(f.finding_type==='POSSIBLE_NEW_MMV'||f.finding_type==='PRODUCT_YEAR_CONFLICT'){
          diagnostics.yearToMmv++;
          diagnostics.yearToMmvIdentities.add(JSON.stringify([baseKey,key(v)]));
          continue;
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
          version:label,selectedIdentity:identity,possibleAppearanceVariant:!!paintParent,
          discovery,recommendation,priorRuns:1,reviewedSameFingerprint:review});
      }else{
        old.priorRuns++;
        // Do not convert a version's semantic identity when replacing evidence.
        if(better(f,old.finding)){
          old.finding=f;old.run=r;old.brand=brand;old.model=model;
          old.version=label;old.selectedIdentity=identity;
          old.possibleAppearanceVariant=!!paintParent;
          old.discovery=discovery;old.recommendation=recommendation;
          old.kind=kind;
          old.reviewedSameFingerprint=review;
        }else if(f.fingerprint===old.finding.fingerprint&&!old.reviewedSameFingerprint){
          old.reviewedSameFingerprint=review;
        }
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
  if (candidate.selectedIdentity &&
      ['MMV_NEW','MMV_AMBIGUOUS'].includes(candidate.kind)) {
    return canonical.some(item =>
      sameCanonicalIdentity(candidate.selectedIdentity!,item,candidate.run.market ?? 'BR'));
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
