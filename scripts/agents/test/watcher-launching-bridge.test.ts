import {describe,it,expect} from 'vitest';
import {projectWatcherLaunches} from '../watcher-launching-bridge';
import type {WatcherAiExtractedEvent} from '@compra-car/adapter-openai';
const event:WatcherAiExtractedEvent={category:'MARKET_ENTRY',brand:'MG',model:'IM 6',
 version:null,market:'BR',evidence:'MG IM 6 chega ao Brasil',uncertain:false};
describe('24C AI launching-map bridge',()=>{
 it('groups repeat evidence while keeping undated launches out of active map',()=>{
  const out=projectWatcherLaunches([{revisionId:'r1',events:[event,event]}],[],'2026-10');
  expect(out).toMatchObject({eligibleEvidence:2,pendingTemporalVerification:1});
  expect(out.map).toHaveLength(1);
  expect(out.map[0]).toMatchObject({visible:false,start:null,precision:'UNKNOWN'});
 });
 it('excludes rumor and unsupported foreign market from map',()=>{
  const out=projectWatcherLaunches([{revisionId:'r1',events:[
    {...event,uncertain:true},{...event,market:'FOREIGN'}]}],[],'2026-10');
  expect(out.map).toHaveLength(0);
  expect(out).toMatchObject({excludedUncertain:1,excludedUnknownMarket:1});
 });
 it('first approved MMV closes launch lead and all projected versions',()=>{
  const out=projectWatcherLaunches([{revisionId:'r1',events:[
    {...event,version:'A'},{...event,version:'B'}]}],
    [{id:'canonical-1',brand:'MG',model:'IM 6',approved:true}],'2026-10');
  expect(out.map[0]).toMatchObject({state:'CLOSED',closedByMmvId:'canonical-1',versions:['A','B']});
 });
});
