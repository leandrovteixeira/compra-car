import type { WatcherLaunchExtraction } from '@compra-car/adapter-openai';
import type { LaunchEvidence } from '../../packages/core/src/agents/watcher-launching-map';

export type ScoredLaunch = Readonly<{
  evidence:LaunchEvidence;
  confidence:number;
  probability:number;
  decision:'MAP_ELIGIBLE'|'RUMOR_EXCLUDED'|'INSUFFICIENT_EVIDENCE';
}>;
/**
 * Evidence quality != probability of arrival. Conservative deterministic v1,
 * requiring literal future-intent evidence and explicit Brazil context upstream.
 * Neither field authorizes canonical updates.
 */
export function scoreWatcherLaunch(
  revisionId:string, extraction:WatcherLaunchExtraction,
):ScoredLaunch {
  const supported=extraction.brand!==null&&extraction.model!==null&&extraction.evidence!==null;
  // Literal source evidence is necessary but not sufficient for a model launch.
  // A brand-level arrival date must not become a model-level date.
  const dateOnlyForBrand=!!extraction.dateEvidence &&
    /\\b(?:marca|fabricante|montadora)\\b/iu.test(extraction.dateEvidence) &&
    !extraction.dateEvidence.toLocaleLowerCase().includes(extraction.model?.toLocaleLowerCase()??'\u0000');
  const motorcycleModels=new Set(['f 450 gs','cg 160']);
  const outOfScope=motorcycleModels.has((extraction.model??'').toLowerCase().trim());
  const decision:ScoredLaunch['decision']=extraction.intention==='RUMOR'?'RUMOR_EXCLUDED':
    supported&&!dateOnlyForBrand&&!outOfScope&&['CONFIRMED','PROBABLE'].includes(extraction.intention)?
      'MAP_ELIGIBLE':'INSUFFICIENT_EVIDENCE';
  const official=extraction.intention==='CONFIRMED'&&!!extraction.officialEvidence;
  const dated=extraction.datePrecision!=='UNKNOWN'&&!!extraction.dateEvidence;
  const confidence=decision!=='MAP_ELIGIBLE'?0:
    Math.min(100,(official?75:45)+(dated?15:0));
  const probability=decision!=='MAP_ELIGIBLE'?0:official?90:dated?65:50;
  const start=extraction.datePrecision==='MONTH'||extraction.datePrecision==='RANGE'
    ? extraction.expectedStart:null;
  const end=extraction.datePrecision==='RANGE'?extraction.expectedEnd:null;
  return {
    evidence:{revisionId,brand:extraction.brand,model:extraction.model,
      market:'BR',category:'MARKET_ENTRY',uncertain:decision!=='MAP_ELIGIBLE',
      quote:extraction.evidence??'',
      expectedStart:start,expectedEnd:end,precision:extraction.datePrecision,
      officialBrazilConfirmation:official},
    confidence,probability,decision,
  };
}
