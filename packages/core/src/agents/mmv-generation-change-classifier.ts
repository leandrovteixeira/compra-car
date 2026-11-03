/**
 * Generation change classification for the MMV Discovery pipeline.
 *
 * Independent of MMV identity: a commercial version/powertrain change is not
 * itself a new vehicle generation. This module NEVER writes to the catalogue.
 *
 * All scores are evidenced 0..3 severity assessments; missing observations
 * remain null (unknown), never silently assigned zero.
 */
export const MMV_GENERATION_CHANGE_TYPES = [
  'UNCHANGED','MINOR_CHANGE','FACELIFT','NEW_GENERATION','UNKNOWN',
] as const;
export type MmvGenerationChangeType =
  (typeof MMV_GENERATION_CHANGE_TYPES)[number];
export type MmvGenerationDimension = 'design'|'powertrain'|'dimensions';
export type MmvGenerationSeverity = 0|1|2|3;

export const MMV_GENERATION_WEIGHTS = {
  design:0.35,
  powertrain:0.35,
  dimensions:0.30,
} as const;

export interface MmvGenerationEvidence {
  /** Stable URL/hash to an authoritative source, not merely a model guess. */
  readonly sourceUrl:string;
  readonly sourceKind:'MANUFACTURER'|'REGULATORY'|'TECHNICAL_DOCUMENT'|'SECONDARY';
  readonly excerpt:string;
  readonly modelYear:number;
}
export interface MmvGenerationSignal {
  readonly dimension:MmvGenerationDimension;
  /** null = no evidence; 0 = explicit evidence of continuity. */
  readonly severity:MmvGenerationSeverity|null;
  readonly reason:string;
  readonly evidence:readonly MmvGenerationEvidence[];
}
export interface MmvGenerationAssessment {
  readonly previousModelYear:number;
  readonly currentModelYear:number;
  readonly previousMmvId:string;
  readonly currentMmvId:string;
  readonly signals:readonly MmvGenerationSignal[];
}
export interface MmvGenerationClassification {
  readonly changeType:MmvGenerationChangeType;
  readonly weightedScore:number|null;
  readonly normalizedScore:number|null;
  readonly weights:typeof MMV_GENERATION_WEIGHTS;
  readonly requiresReview:true;
  readonly rationale:readonly string[];
  readonly insufficientDimensions:readonly MmvGenerationDimension[];
  /** For Spec Agent: only advisory risk scopes. No spec is approved/inherited. */
  readonly specCarryOverPolicy:'REVIEW_ONLY_UNCLASSIFIED'|
    'CANDIDATE_HIGH'|'CANDIDATE_SELECTIVE'|'DO_NOT_ASSUME';
  readonly revalidateSubsystems:readonly (
    'POWERTRAIN'|'HOMOLOGATION'|'DIMENSIONS'|'BODY'|'INTERIOR'|'SAFETY'|'EQUIPMENT'
  )[];
}
const DIMENSIONS=['design','powertrain','dimensions'] as const;
const validYear=(x:number)=>Number.isInteger(x)&&x>=2000&&x<=2100;
const round=(n:number)=>Math.round(n*1000)/1000;
function validate(input:MmvGenerationAssessment):void {
  if(!validYear(input.previousModelYear)||!validYear(input.currentModelYear)||
     input.previousModelYear>=input.currentModelYear||
     !input.previousMmvId?.trim()||!input.currentMmvId?.trim())
    throw new Error('MMV_GENERATION_IDENTITY_INVALID');
  if(input.signals.length!==3 ||
     new Set(input.signals.map(x=>x.dimension)).size!==3 ||
     input.signals.some(x=>!DIMENSIONS.includes(x.dimension)))
    throw new Error('MMV_GENERATION_SIGNALS_INVALID');
  for(const signal of input.signals){
    if(signal.severity!==null &&
      (!Number.isInteger(signal.severity)||signal.severity<0||signal.severity>3))
      throw new Error('MMV_GENERATION_SEVERITY_INVALID');
    if(signal.severity===null){
      if(signal.evidence.length)throw new Error('MMV_GENERATION_UNASSESSED_WITH_EVIDENCE');
      continue;
    }
    if(!signal.reason.trim()||!signal.evidence.length)
      throw new Error('MMV_GENERATION_EVIDENCE_REQUIRED');
    for(const e of signal.evidence){
      if(!/^https:\/\/[^\s/]+\//u.test(e.sourceUrl)||!e.excerpt.trim()||
         !validYear(e.modelYear)||
         ![input.previousModelYear,input.currentModelYear].includes(e.modelYear)||
         !['MANUFACTURER','REGULATORY','TECHNICAL_DOCUMENT','SECONDARY'].includes(e.sourceKind))
        throw new Error('MMV_GENERATION_EVIDENCE_INVALID');
    }
  }
}
/** Scores are weighted; classification is deliberately more conservative
 * than a scalar threshold. NEW_GENERATION requires strong independent
 * BODY/DESIGN and DIMENSION change. Powertrain alone can never suffice.
 */
export function classifyMmvGenerationChange(
  input:MmvGenerationAssessment,
):MmvGenerationClassification {
  validate(input);
  const map=new Map(input.signals.map(s=>[s.dimension,s]));
  const missing=DIMENSIONS.filter(d=>map.get(d)?.severity===null);
  const score=missing.length?null:round(
    DIMENSIONS.reduce((sum,d)=>sum+
      map.get(d)!.severity!*MMV_GENERATION_WEIGHTS[d],0));
  const unknown=(notes:readonly string[]):MmvGenerationClassification=>({
    changeType:'UNKNOWN',weightedScore:score,normalizedScore:score===null?null:round(score/3),
    weights:MMV_GENERATION_WEIGHTS,requiresReview:true,rationale:notes,
    insufficientDimensions:missing,
    specCarryOverPolicy:'REVIEW_ONLY_UNCLASSIFIED',
    revalidateSubsystems:['POWERTRAIN','HOMOLOGATION','DIMENSIONS','BODY','INTERIOR','SAFETY','EQUIPMENT'],
  });
  if(missing.length)return unknown(['Insufficient source-backed observations for '+missing.join(', ')+'.']);
  const design=map.get('design')!.severity!;
  const powertrain=map.get('powertrain')!.severity!;
  const dimensions=map.get('dimensions')!.severity!;
  const reasons=input.signals.map(x=>x.dimension+': '+x.reason);
  let changeType:MmvGenerationChangeType;
  // Strong design AND dimensions are the gate. 2+2 must still outrank
  // isolated strong powertrain changes even at score 1.30.
  if(design>=2&&dimensions>=2)
    changeType='NEW_GENERATION';
  else if(design>=2)
    changeType='FACELIFT';
  else if(design>0 || powertrain>0 || dimensions>0)
    changeType='MINOR_CHANGE';
  else
    changeType='UNCHANGED';
  const revalidate:MmvGenerationClassification['revalidateSubsystems']=
    changeType==='NEW_GENERATION'
      ? ['POWERTRAIN','HOMOLOGATION','DIMENSIONS','BODY','INTERIOR','SAFETY','EQUIPMENT']
      : [
        ...(powertrain>0?['POWERTRAIN','HOMOLOGATION'] as const:[]),
        ...(dimensions>0?['DIMENSIONS','BODY'] as const:[]),
        ...(design>0?['BODY','INTERIOR','EQUIPMENT'] as const:[]),
      ];
  return {
    changeType,weightedScore:score,normalizedScore:round(score!/3),
    weights:MMV_GENERATION_WEIGHTS,requiresReview:true,
    rationale:[
      ...reasons,
      changeType==='NEW_GENERATION'
        ? 'Structural design and dimension changes jointly exceed the generation gate.'
        : 'No combined structural design-and-dimension evidence of a new generation.',
    ],
    insufficientDimensions:[],
    specCarryOverPolicy:changeType==='NEW_GENERATION'?'DO_NOT_ASSUME':
      changeType==='FACELIFT'?'CANDIDATE_SELECTIVE':'CANDIDATE_HIGH',
    revalidateSubsystems:[...new Set(revalidate)],
  };
}

/** Assess dimensional change from measurements. This is only a severity
 * suggestion; official evidence must be attached separately. */
export interface MmvGenerationMeasurements {
  readonly lengthMm:number;
  readonly widthMm:number;
  readonly heightMm:number;
  readonly wheelbaseMm:number;
}
export function suggestMmvDimensionSeverity(
  previous:MmvGenerationMeasurements,
  current:MmvGenerationMeasurements,
):{severity:MmvGenerationSeverity;deltas:Readonly<Record<keyof MmvGenerationMeasurements,number>>;reason:string}{
  const keys=['lengthMm','widthMm','heightMm','wheelbaseMm'] as const;
  const deltas={} as Record<(typeof keys)[number],number>;
  for(const k of keys){
    if(!Number.isFinite(previous[k])||!Number.isFinite(current[k])||
       previous[k]<=0||current[k]<=0)
      throw new Error('MMV_GENERATION_DIMENSIONS_INVALID');
    deltas[k]=round(Math.abs(current[k]-previous[k])/previous[k]*100);
  }
  const wheel=deltas.wheelbaseMm;
  const majorCount=keys.filter(k=>deltas[k]>=4).length;
  const severity:MmvGenerationSeverity=
    wheel>=5||majorCount>=2?3:
    wheel>=2||deltas.lengthMm>=5||deltas.widthMm>=4?2:
    wheel>=0.5||keys.some(k=>deltas[k]>=1)?1:0;
  return {severity,deltas,reason:
    'Observed dimension deltas (percent): length '+deltas.lengthMm+
    ', width '+deltas.widthMm+', height '+deltas.heightMm+
    ', wheelbase '+wheel+'. Thresholds are provisional and require validation.'};
}
