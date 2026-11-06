import type {
  MmvGenerationAssessment, MmvGenerationEvidence, MmvGenerationMeasurements,
  MmvGenerationSeverity, MmvGenerationSignal,
} from './mmv-generation-change-classifier';
import { suggestMmvDimensionSeverity, classifyMmvGenerationChange } from './mmv-generation-change-classifier';

export type GenerationSourceDocument = Readonly<{
  modelYear: number;
  url: string;
  excerpt: string;
  sourceKind: 'MANUFACTURER' | 'TECHNICAL_DOCUMENT';
}>;

export interface GenerationPowertrainSnapshot {
  /** Technical architecture, not merely a marketing fuel label. */
  readonly propulsion: 'ICE'|'MHEV'|'HEV'|'PHEV'|'REEV'|'BEV';
  readonly architecture: string;
  readonly engineFamily: string | null;
  readonly fuel: 'GASOLINE'|'ETHANOL'|'FLEX'|'DIESEL'|'ELECTRIC'|'OTHER';
  readonly transmissionFamily: string | null;
}

export interface GenerationDocumentSnapshot {
  readonly modelYear: number;
  readonly dimensionMeasurements: MmvGenerationMeasurements | null;
  readonly dimensionsSource: GenerationSourceDocument | null;
  readonly powertrain: GenerationPowertrainSnapshot | null;
  readonly powertrainSource: GenerationSourceDocument | null;
}

/** Comparison's design images must be supplied by a trusted document adapter.
 * This function does not download or render manufacturer PDFs. */
export interface GenerationImageComparison {
  readonly before: { readonly modelYear: number; readonly sourceUrl: string; readonly imageDataUrl: string };
  readonly after: { readonly modelYear: number; readonly sourceUrl: string; readonly imageDataUrl: string };
}
export interface GenerationVisionResult {
  readonly severity: MmvGenerationSeverity | null;
  readonly reason: string;
}

function valid(doc:GenerationSourceDocument|null, year:number):doc is GenerationSourceDocument {
  return !!doc && doc.modelYear===year && /^https:\/\/[^\s/]+\//u.test(doc.url) &&
    !!doc.excerpt.trim() && doc.excerpt.length<=2000;
}
function evidence(
  previous:GenerationSourceDocument, current:GenerationSourceDocument,
):readonly MmvGenerationEvidence[] {
  return [previous,current].map(doc=>({
    sourceUrl:doc.url,sourceKind:doc.sourceKind,excerpt:doc.excerpt,modelYear:doc.modelYear,
  }));
}
function unknown(dimension:MmvGenerationSignal['dimension'],reason:string):MmvGenerationSignal {
  return {dimension,severity:null,reason,evidence:[]};
}
function powertrainChange(
  a:GenerationPowertrainSnapshot,b:GenerationPowertrainSnapshot,
):{severity:MmvGenerationSeverity; reason:string}{
  const normalize=(x:string|null)=>(x??'').normalize('NFKD').toLowerCase().replace(/\s+/gu,' ').trim();
  const propulsion=a.propulsion!==b.propulsion;
  const architecture=normalize(a.architecture)!==normalize(b.architecture);
  const engine=normalize(a.engineFamily)!==normalize(b.engineFamily);
  const transmission=normalize(a.transmissionFamily)!==normalize(b.transmissionFamily);
  const fuel=a.fuel!==b.fuel;
  const severity:MmvGenerationSeverity=propulsion||architecture?3:engine||transmission?2:fuel?1:0;
  return {severity,reason:[
    'Manufacturer technical architecture comparison',
    'propulsion '+a.propulsion+' -> '+b.propulsion,
    'architecture '+a.architecture+' -> '+b.architecture,
    'engine family '+(a.engineFamily??'?')+' -> '+(b.engineFamily??'?'),
    'fuel '+a.fuel+' -> '+b.fuel,
    'transmission '+(a.transmissionFamily??'?')+' -> '+(b.transmissionFamily??'?'),
  ].join('; ').slice(0,2000)};
}

/** Builds an evidence-gated assessment. Missing source means null rather than 0.
 * The vision inference is a separate source-backed opinion and never edits specs.
 */
export function buildGenerationAssessment(input:{
  previousMmvId:string;
  currentMmvId:string;
  previous:GenerationDocumentSnapshot;
  current:GenerationDocumentSnapshot;
  design:GenerationVisionResult|null;
  designSources:readonly [GenerationSourceDocument,GenerationSourceDocument]|null;
}):MmvGenerationAssessment {
  const {previous,current}=input;
  if(previous.modelYear>=current.modelYear)throw new Error('GENERATION_MODEL_YEAR_ORDER_INVALID');
  let dimensions=unknown('dimensions','Comparable official dimensions unavailable for both MYs');
  if(previous.dimensionMeasurements && current.dimensionMeasurements &&
     valid(previous.dimensionsSource,previous.modelYear) &&
     valid(current.dimensionsSource,current.modelYear)) {
    const d=suggestMmvDimensionSeverity(previous.dimensionMeasurements,current.dimensionMeasurements);
    dimensions={dimension:'dimensions',severity:d.severity,reason:d.reason,
      evidence:evidence(previous.dimensionsSource,current.dimensionsSource)};
  }
  let powertrain=unknown('powertrain','Official structural powertrain snapshots unavailable for both MYs');
  if(previous.powertrain && current.powertrain &&
     valid(previous.powertrainSource,previous.modelYear) &&
     valid(current.powertrainSource,current.modelYear)){
    const d=powertrainChange(previous.powertrain,current.powertrain);
    powertrain={dimension:'powertrain',severity:d.severity,reason:d.reason,
      evidence:evidence(previous.powertrainSource,current.powertrainSource)};
  }
  let design=unknown('design','Visual assessment unavailable or inconclusive');
  if(input.design?.severity!==null && input.design!==null &&
     input.designSources && valid(input.designSources[0],previous.modelYear) &&
     valid(input.designSources[1],current.modelYear)) {
    if(!Number.isInteger(input.design.severity)||input.design.severity!<0||input.design.severity!>3||
       !input.design.reason.trim())throw new Error('GENERATION_DESIGN_RESULT_INVALID');
    design={dimension:'design',severity:input.design.severity,
      reason:input.design.reason.slice(0,1800),
      evidence:evidence(input.designSources[0],input.designSources[1])};
  }
  const assessment={
    previousModelYear:previous.modelYear,currentModelYear:current.modelYear,
    previousMmvId:input.previousMmvId,currentMmvId:input.currentMmvId,
    signals:[design,powertrain,dimensions],
  };
  // The classifier is the sole authority for generation and carry-over hints.
  classifyMmvGenerationChange(assessment);
  return assessment;
}
