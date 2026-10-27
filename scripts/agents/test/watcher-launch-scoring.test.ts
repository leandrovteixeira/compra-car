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

describe('24C pilot false-positive guards',()=>{
 it('does not transfer the Lepas brand entry date to Aura',()=>{
  const r=scoreWatcherLaunch('rev-lepas',{
   brand:'Lepas',model:'Aura',intention:'CONFIRMED',datePrecision:'YEAR',
   expectedStart:'2027',expectedEnd:null,
   evidence:'Lepas mostra seu primeiro carro-conceito e marca vem ao Brasil em 2027',
   dateEvidence:'marca vem ao Brasil em 2027',officialEvidence:'marca vem ao Brasil em 2027',
  });
  expect(r.decision).toBe('INSUFFICIENT_EVIDENCE');
 });
 it('excludes known motorcycle BMW F 450 GS from automobile map',()=>{
  const r=scoreWatcherLaunch('rev-bmw',{
   brand:'BMW',model:'F 450 GS',intention:'PROBABLE',datePrecision:'UNKNOWN',
   expectedStart:null,expectedEnd:null,
   evidence:'BMW já testa F 450 GS no Brasil',dateEvidence:null,officialEvidence:null,
  });
  expect(r.decision).toBe('INSUFFICIENT_EVIDENCE');
 });
});
