import { describe, expect, it } from 'vitest';
import { detectWatcherEvents } from '../src/agents/watcher-event-detection';
import { resolveWatcherEventEntity } from '../src/agents/watcher-event-entity-resolution';
import { proposeWatcherIdentityLeads } from '../src/agents/watcher-identity-leads';
import type { WatcherIntelligenceContext } from '../src/agents/watcher-intelligence';
const context: Pick<WatcherIntelligenceContext,'brands'|'mmvs'> = {
  brands:[{id:'byd',market:'BR',canonicalName:'BYD',canonicalKey:'byd',aliases:[]}],
  mmvs:[],
};
const run=(title:string)=>detectWatcherEvents({title}).flatMap(event =>
  proposeWatcherIdentityLeads(event,resolveWatcherEventEntity(event,context)));
describe('Watcher identity leads — literal review only',()=>{
  it('suggests unknown MG without inserting canonical brand',()=>{
    expect(run('MG chega ao Brasil com novo SUV')).toEqual([
      expect.objectContaining({kind:'UNKNOWN_BRAND',label:'MG',status:'REVIEW_REQUIRED'}),
    ]);
  });
  it('extracts BYD Song Pro as unverified model span',()=>{
    expect(run('BYD Song Pro ganha nova versão no Brasil')).toEqual([
      expect.objectContaining({kind:'UNKNOWN_MODEL',label:'Song Pro',status:'REVIEW_REQUIRED'}),
    ]);
  });
  it('does not invent a model from an unrelated industry headline',()=>{
    expect(run('BYD contrata empregados em fábrica')).toEqual([]);
  });
  it('does not produce leads for unknown syntax without an explicit subject',()=>{
    expect(run('Nova marca chegará ao Brasil em breve')).toEqual([]);
  });
});
