import { buildLaunchingMap, type LaunchEvidence, type CanonicalMmvEvent } from '../../packages/core/src/agents/watcher-launching-map';
import type { WatcherAiExtractedEvent } from '@compra-car/adapter-openai';

export type WatcherAiPilotRow = Readonly<{
  revisionId:string;
  events:readonly WatcherAiExtractedEvent[];
}>;
export type WatcherLaunchProjection = Readonly<{
  articles:number;
  extractedEvents:number;
  eligibleEvidence:number;
  excludedUnknownMarket:number;
  excludedUncertain:number;
  pendingTemporalVerification:number;
  map:ReturnType<typeof buildLaunchingMap>;
}>;

/** Offline and conservative: titles/excerpts alone cannot establish an upcoming date. */
export function projectWatcherLaunches(
  rows:readonly WatcherAiPilotRow[],
  canonicalMmvs:readonly CanonicalMmvEvent[],
  referenceMonth:string,
):WatcherLaunchProjection {
  const evidence:LaunchEvidence[]=[];
  let excludedUnknownMarket=0;
  let excludedUncertain=0;
  for(const row of rows) {
    for(const event of row.events) {
      if(!['NEW_MODEL','MARKET_ENTRY'].includes(event.category))continue;
      if(event.market!=='BR') {excludedUnknownMarket++;continue;}
      if(event.uncertain) {excludedUncertain++;continue;}
      if(!event.brand?.trim()||!event.model?.trim())continue;
      evidence.push({
        revisionId:row.revisionId,
        brand:event.brand,model:event.model,version:event.version,
        market:'BR',category:event.category,uncertain:false,
        quote:event.evidence,expectedStart:null,expectedEnd:null,
        precision:'UNKNOWN',officialBrazilConfirmation:false,
      });
    }
  }
  // A mention of a commercial arrival isn't evidence that it is still upcoming.
  // Without a dated, verified future launch, keep leads out of the active map.
  const map=buildLaunchingMap(evidence,canonicalMmvs,referenceMonth).map(item=>({
    ...item,visible:false, // Future temporal verification required.
  }));
  return {articles:rows.length,extractedEvents:rows.reduce((n,row)=>n+row.events.length,0),
    eligibleEvidence:evidence.length,excludedUnknownMarket,excludedUncertain,
    pendingTemporalVerification:map.filter(item=>item.state!=='CLOSED').length,map};
}
