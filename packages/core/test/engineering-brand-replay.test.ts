import {describe,it,expect} from 'vitest';
import {evaluateBrandWarmReuse} from '../src/agents/engineering-brand-replay';
import type {BrandReplayEvidence} from '../src/agents/engineering-brand-replay';
const fixture=(brand:string):BrandReplayEvidence=>{
 const url='https://www.'+(brand==='Kia'?'kia.com.br':'vw.com.br')+'/modelos';
 return {independentReview:true,reviewReference:'external-reviewed-capture-1',
 connector:{brand,market:'BR',allowedDomains:[new URL(url).hostname],sourceEntries:[
 {type:'MODEL_INDEX',url,priority:1}],searchHints:[],terminologyHints:[]},
 snapshots:[{brand,market:'BR',sourceUrl:url,sourceContentSha256:'a'.repeat(64),capturedAt:'2026-10-09T12:00:00Z'}]};
};
describe('Brand Connector cold/warm snapshot contract',()=>{
 it.each(['Kia','Volkswagen'])('reuses reviewed matching %s snapshots without claiming actual savings',brand=>{
  const cold=fixture(brand);
  const warm={...cold,snapshots:cold.snapshots.map(s=>({...s,capturedAt:'2026-10-10T12:00:00Z'}))};
  expect(evaluateBrandWarmReuse(cold,warm)).toMatchObject({reusable:true,reason:'REUSABLE'});
 });
 it('rejects changed source hash',()=>{
  const base=fixture('Kia');
  expect(evaluateBrandWarmReuse(base,{...base,snapshots:base.snapshots.map(s=>({...s,sourceContentSha256:'b'.repeat(64)}))}).reason).toBe('SOURCE_CHANGED');
 });
 it('requires independent review and exact source census',()=>{
  const base=fixture('Kia');
  expect(evaluateBrandWarmReuse(base,{...base,independentReview:false}).reason).toBe('REVIEW_REQUIRED');
  expect(evaluateBrandWarmReuse(base,{...base,snapshots:[]}).reason).toBe('INVALID_SNAPSHOT');
 });
 it('rejects connector drift',()=>{
  const base=fixture('Kia');
  expect(evaluateBrandWarmReuse(base,{...base,connector:{...base.connector,terminologyHints:['different']}}).reason).toBe('CONNECTOR_CHANGED');
 });
});
