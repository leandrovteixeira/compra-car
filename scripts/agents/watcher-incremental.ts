import { randomUUID } from 'node:crypto';
import type { WatcherRepository } from '@compra-car/core/agents';
import { ingestWatcherFeed, type WatcherFeedTransport } from './watcher-feed-ingestion';
import { WATCHER_PILOT } from './watcher-pilot';

type Reader=Pick<WatcherRepository,'listSources'|'getSourceState'|'listSourceItems'|'listSourceRevisions'|'claimLease'|'persistBatch'|'releaseLease'>;
async function pages<T>(fetch:(limit:number,offset:number)=>Promise<readonly T[]>):Promise<T[]>{
 const all:T[]=[];
 for(let offset=0;offset<1000;offset+=100){
  const page=await fetch(100,offset);
  if(page.length>100)throw new Error('WATCHER_INCREMENTAL_PAGE_INVALID');
  all.push(...page);
  if(page.length<100)return all;
 }
 throw new Error('WATCHER_INCREMENTAL_PAGE_LIMIT');
}
export async function runWatcherIncremental(input:{
 repository:Reader;transport:WatcherFeedTransport;now:string;
}){
 const {repository,transport,now}=input;
 const sources=await repository.listSources(100,0);
 const source=sources.find(s=>s.source.id===WATCHER_PILOT.source.id);
 if(!source||!source.source.enabled||
    source.settings.requestUrl!==WATCHER_PILOT.settings.requestUrl)
    throw new Error('WATCHER_INCREMENTAL_SOURCE_NOT_READY');
 const state=await repository.getSourceState(source.source.id);
 if(!state)throw new Error('WATCHER_INCREMENTAL_STATE_MISSING');
 const currentItems=await pages((limit,offset)=>repository.listSourceItems(source.source.id,limit,offset));
 const revisions=await pages((limit,offset)=>repository.listSourceRevisions(source.source.id,limit,offset));
 const current=currentItems.map(item=>item.currentObservation);
 // Validate current revisions are stored and consistent before fetching.
 const revisionIds=new Set(revisions.map(revision=>revision.id));
 if(currentItems.some(item=>!revisionIds.has(item.currentRevisionId)))
   throw new Error('WATCHER_INCREMENTAL_REVISION_MISMATCH');
 const keyById=new Map(currentItems.map(i=>[i.id,i.itemKey]));
 const history=revisions.map(revision=>({item:revision.item,itemKey:keyById.get(revision.feedItemId) ?? '',
   observedAt:revision.firstObservedAt,evidenceFingerprint:revision.evidenceFingerprint}));
 if(history.some(h=>!h.itemKey))throw new Error('WATCHER_INCREMENTAL_ITEM_KEY_MISSING');
 const lease=await repository.claimLease(source.source.id,'watcher-24c-incremental',120);
 if(!lease)throw new Error('WATCHER_INCREMENTAL_LEASE_BUSY');
 let persisted=false;
 try{
  if(lease.configVersion!==source.configVersion || lease.stateVersion!==state.stateVersion)
   throw new Error('WATCHER_INCREMENTAL_STALE_LEASE');
  const result=await ingestWatcherFeed({
   source:source.source,settings:source.settings,observedAt:now,
   history,current,checkpoint:state.checkpoint,transport,
   parserOptions:{allowedArticleHosts:source.settings.allowedArticleHosts,
    allowRelativeUrls:source.settings.allowRelativeUrls},
  });
  if(!['OK','NOT_MODIFIED'].includes(result.status)||!result.checkpointAdvanced||
    result.batch.failures.length)
   throw new Error('WATCHER_INCREMENTAL_INGESTION_FAILED');
  const receipt=await repository.persistBatch({
   batchId:randomUUID(),lease,batch:result.batch,checkpoint:result.checkpoint!,
   advanceCheckpoint:result.checkpointAdvanced,checkpointBlockedReason:null,
   diagnostics:result.diagnostics,
  });
  persisted=true;
  if(receipt.status!=='COMMITTED')throw new Error('WATCHER_INCREMENTAL_COMMIT_UNCERTAIN');
  return {status:'PASS' as const,sourceId:source.source.id,received:result.batch.observations.length,
   receipt:receipt.batchId};
 }finally{
  if(!persisted)await repository.releaseLease(source.source.id,lease.token,'PERSISTENCE_FAILED');
 }
}
