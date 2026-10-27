import {describe,it,expect} from 'vitest';
import {scoreWatcherLaunch} from '../watcher-launch-scoring';
import type {WatcherLaunchExtraction} from '@compra-car/adapter-openai';
const sample:WatcherLaunchExtraction={brand:'MG',model:'IM 6',intention:'PROBABLE',
 datePrecision:'YEAR',expectedStart:'2028',expectedEnd:null,
 evidence:'IM 6 virá ao Brasil',dateEvidence:'em 2028',officialEvidence:null};
describe('24C launch evidence scores',()=>{
 it('separates probability from confidence and preserves year-only dates',()=>{
  const r=scoreWatcherLaunch('rev1',sample);
  expect(r).toMatchObject({decision:'MAP_ELIGIBLE',confidence:60,probability:65,
    evidence:{expectedStart:null,precision:'YEAR'}});
 });
 it('keeps rumors out of the map',()=>{
  expect(scoreWatcherLaunch('rev1',{...sample,intention:'RUMOR'}).decision).toBe('RUMOR_EXCLUDED');
 });
 it('requires identified brand and model',()=>{
  expect(scoreWatcherLaunch('rev1',{...sample,model:null}).decision).toBe('INSUFFICIENT_EVIDENCE');
 });
});
