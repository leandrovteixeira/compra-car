import {describe,it,expect} from 'vitest';
import {resolveWatcherAiReview} from '../watcher-ai-entity-resolution';
import type {WatcherReviewItem} from '../watcher-ai-review';
import type {WatcherIntelligenceContext} from '@compra-car/core/agents';
const ctx:Pick<WatcherIntelligenceContext,'brands'|'mmvs'>={
 brands:[{id:'mg',market:'BR',canonicalName:'MG',canonicalKey:'mg',aliases:[]},
 {id:'volkswagen',market:'BR',canonicalName:'Volkswagen',canonicalKey:'volkswagen',aliases:['VW']}],
 mmvs:[{id:'mmv-nivus',market:'BR',brand:'Volkswagen',model:'Nivus',officialVersionLabel:'Sense'}],
};
const item:WatcherReviewItem={category:'NEW_MODEL',brand:'MG',model:'IM 6',version:null,
 market:'BR',uncertain:false,evidences:['MG IM 6 chega ao Brasil'],
 route:'CATALOG_REVIEW',status:'REVIEW_REQUIRED'};
describe('Watcher post-AI canonical resolution',()=>{
 it('proposes unknown model for MMV review, never auto-applies',()=>{
  expect(resolveWatcherAiReview(item,ctx)).toMatchObject({brandResolution:'KNOWN_BRAND',
   modelResolution:'UNVERIFIED_MODEL',nextAction:'MMV_DISCOVERY_REVIEW',applyAllowed:false});
 });
 it('resolves VW alias and existing model',()=>{
  expect(resolveWatcherAiReview({...item,brand:'VW',model:'Nivus'},ctx)).toMatchObject({
   canonicalBrandId:'volkswagen',modelResolution:'KNOWN_MODEL',
   canonicalModelIds:['mmv-nivus'],nextAction:'EXISTING_MODEL_EVENT_REVIEW'});
 });
 it('keeps unknown brand as a lead even with unknown model',()=>{
  expect(resolveWatcherAiReview({...item,brand:'DFM',model:null},ctx)).toMatchObject({
   brandResolution:'UNKNOWN_BRAND',nextAction:'BRAND_DISCOVERY_REVIEW'});
 });
 it('never promotes corporate news to catalog',()=>{
  expect(resolveWatcherAiReview({...item,category:'INDUSTRIAL',
   route:'COMPETITIVE_INTELLIGENCE'},ctx).nextAction).toBe('COMPETITIVE_INTELLIGENCE');
 });
});
