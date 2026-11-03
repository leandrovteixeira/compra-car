/** Sprint 24C: deterministic Launching Map projection; never writes catalog records. */
export type LaunchEvidence = Readonly<{
  revisionId:string; brand:string|null; model:string|null; version?:string|null;
  market:'BR'|'FOREIGN'|'UNKNOWN'; category:string; uncertain:boolean;
  quote:string; expectedStart?:string|null; expectedEnd?:string|null;
  precision?:'MONTH'|'RANGE'|'YEAR'|'UNKNOWN';
  officialBrazilConfirmation?:boolean;
}>;
export type LaunchRecord = Readonly<{
  key:string; brand:string; model:string; state:'CONFIRMED'|'PROBABLE'|'UNVERIFIED'|'CLOSED';
  visible:boolean; start:string|null; end:string|null;
  precision:'MONTH'|'RANGE'|'YEAR'|'UNKNOWN'; revisions:readonly string[];
  versions:readonly string[]; confidence:number; closedByMmvId:string|null;
}>;
export type CanonicalMmvEvent = Readonly<{id:string;brand:string;model:string;approved:boolean}>;
const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .trim().toLowerCase().replace(/\s+/g,' ');
const launchKinds=new Set(['NEW_MODEL','MARKET_ENTRY','NEW_VERSION','MODEL_YEAR','FACELIFT','POWERTRAIN']);
const isoMonth=(s:string|null|undefined)=>s==null||!/^20\d\d-(0[1-9]|1[0-2])$/.test(s)?null:s;

/**
 * Group by explicit brand+model. Never merge unidentified or ambiguous subjects.
 * A first approved canonical MMV suppresses ALL provisional versions for its brand/model.
 */
export function buildLaunchingMap(
  evidence:readonly LaunchEvidence[], canonicalMmvs:readonly CanonicalMmvEvent[],
  referenceMonth:string,
):readonly LaunchRecord[] {
  if(!isoMonth(referenceMonth))throw new Error('WATCHER_LAUNCH_INVALID_MONTH');
  const groups=new Map<string,LaunchEvidence[]>();
  for(const e of evidence) {
    if(e.market!=='BR'||!launchKinds.has(e.category)||!e.brand?.trim()||!e.model?.trim())continue;
    const key=normalize(e.brand)+'|'+normalize(e.model);
    const group=groups.get(key)??[];group.push(e);groups.set(key,group);
  }
  const horizon=new Date(referenceMonth+'-01T00:00:00Z');
  horizon.setUTCMonth(horizon.getUTCMonth()+36);
  const limit=horizon.toISOString().slice(0,7);
  return [...groups].map(([key,entries])=>{
    const confirmed=entries.some(e=>e.officialBrazilConfirmation===true&&!e.uncertain);
    const probable=entries.some(e=>!e.uncertain);
    const state=confirmed?'CONFIRMED':probable?'PROBABLE':'UNVERIFIED';
    const dateEntries=entries.filter(e=>isoMonth(e.expectedStart)&&
      (!e.expectedEnd||isoMonth(e.expectedEnd)));
    const latest=dateEntries.at(-1);
    const start=isoMonth(latest?.expectedStart);
    const end=isoMonth(latest?.expectedEnd)??start;
    const closed=canonicalMmvs.find(m=>m.approved&&normalize(m.brand)+'|'+normalize(m.model)===key);
    const inHorizon=(!start||start<=limit)&&(!end||end>=referenceMonth);
    return {key,brand:entries[0]!.brand!,model:entries[0]!.model!,
      state:closed?'CLOSED' as const:state,visible:!closed&&state!=='UNVERIFIED'&&inHorizon,
      start,end,precision:latest?.precision??(entries.some(e=>e.precision==='YEAR')?'YEAR':'UNKNOWN'),
      versions:[...new Set(entries.map(e=>e.version?.trim()).filter((v):v is string=>!!v))],
      revisions:[...new Set(entries.map(e=>e.revisionId))],
      confidence:confirmed?100:probable?65:25,closedByMmvId:closed?.id??null};
  });
}
