import {describe,it,expect} from 'vitest';
import {planApprovedSpecValue27} from '../src/agents/spec-review-value-commit';
import type {GuardedFordProposal27} from '../src/agents/ford-xls-source-quality-gate';
const pdf={concept:'Entradas USB',rawLabel:'Entradas USB',value:'4',unit:null,
 availability:'STANDARD' as const,sourceUrl:'https://www.ford.com.br/a.pdf',
 sourceSha256:'a'.repeat(64),sourcePage:2,scope:'XLS_MATRIX_CELL' as const,evidenceExcerpt:'XLS cell: 4'};
const html={...pdf,scope:'XLS_MY2027_PAGE' as const,sourcePage:null,
 sourceSha256:'b'.repeat(64),evidenceExcerpt:'Entradas USB 4'};
const p:GuardedFordProposal27={concept:'Entradas USB',value:'4',unit:null,
 availability:'STANDARD',decision:'REVIEW_REQUIRED',reason:'BOTH_OFFICIAL_SOURCES_CORROBORATE',
 evidence:[pdf,html],quality:'CORROBORATED',sourceQualityReasons:[],eligibleForCatalogApplication:false};
const target={productId:1236,modelYear:2027};
describe('S27D reviewed spec value persistence contract',()=>{
 it('accepts numeric value with no unit and exact target',()=>{
  expect(planApprovedSpecValue27({proposal:p,target,
   spec:{id:19,type:'numeric',unit:null}})).toMatchObject({
    productId:1236,specId:19,kind:'numeric',value:4,isPresent:null
   });
 });
 it('does not silently convert units',()=>{
  expect(()=>planApprovedSpecValue27({proposal:{...p,unit:'inch'},target,
   spec:{id:19,type:'numeric',unit:'mm'}})).toThrow('SPEC_VALUE_UNIT_CONVERSION_REQUIRED');
 });
 it('supports standard and absent binary values without numeric value',()=>{
  const binary={...p,value:null,availability:'STANDARD' as const};
  expect(planApprovedSpecValue27({proposal:binary,target,
   spec:{id:21,type:'binary',unit:null}}).isPresent).toBe(true);
  expect(planApprovedSpecValue27({proposal:{...binary,availability:'NOT_AVAILABLE'},target,
   spec:{id:21,type:'binary',unit:null}}).isPresent).toBe(false);
 });
 it('blocks ambiguous sources, optional equipment, or unresolved scale',()=>{
  expect(()=>planApprovedSpecValue27({proposal:{...p,quality:'SOURCE_AMBIGUOUS'},target,
   spec:{id:19,type:'numeric',unit:null}})).toThrow('SPEC_VALUE_SOURCE_NOT_APPROVABLE');
  expect(()=>planApprovedSpecValue27({proposal:{...p,availability:'OPTIONAL'},target,
   spec:{id:19,type:'numeric',unit:null}})).toThrow('SPEC_VALUE_AVAILABILITY_UNRESOLVED');
  expect(()=>planApprovedSpecValue27({proposal:p,target,
   spec:{id:19,type:'scale',unit:null}})).toThrow('SPEC_VALUE_SCALE_REQUIRES_MAPPING');
 });
 it('blocks target mismatch and contradictory typed values',()=>{
  expect(()=>planApprovedSpecValue27({proposal:p,target:{...target,productId:1237},
   spec:{id:19,type:'numeric',unit:null}})).toThrow('SPEC_VALUE_TARGET_INVALID');
  expect(()=>planApprovedSpecValue27({proposal:p,target,
   spec:{id:19,type:'binary',unit:null}})).toThrow('SPEC_VALUE_BINARY_HAS_VALUE');
 });
});