import {describe,expect,it} from 'vitest';
import {suggestCanonicalSpecs27} from '../src/agents/spec-agent-catalog-suggestions';
import type {SpecCatalogDisplay27} from '../src/agents/spec-agent-catalog-suggestions';
const evidence={sourceId:'baic',documentHash:'hash',capturedAt:'2026-11-03',authority:'MANUFACTURER' as const};
const catalog:SpecCatalogDisplay27[]=[
 {id:'12',code:'PW_0022',type:'numeric',unit:'cv',groupName:'Powertrain',equipmentGroup:'Electric engine',specSet:'FR Max power',detail:'Front electric power',displayPt:'Potência máxima do motor elétrico dianteiro (cv)'},
 {id:'13',code:'PW_0032',type:'numeric',unit:'cv',groupName:'Powertrain',equipmentGroup:'Combined performance',specSet:'Total max power',detail:'Combined power',displayPt:'Potência combinada (cv)'},
 {id:'14',code:'SF_0015',type:'binary',unit:null,groupName:'Safety',equipmentGroup:'Airbags',specSet:'Curtain airbags',detail:'Curtain airbags',displayPt:'Airbags de cortina'},
];
describe('Spec catalog suggestions',()=>{
 it('suggests exact canonical match but always requires review',()=>{
  const result=suggestCanonicalSpecs27({observations:[{label:'Airbags de cortina',kind:'binary',value:'STANDARD',evidence}],catalog});
  expect(result[0]?.decision).toBe('REVIEW_REQUIRED');
  expect(result[0]?.candidates[0]).toMatchObject({specCode:'SF_0015',score:1});
 });
 it('refuses incompatible numeric units instead of equating kW with cv',()=>{
  const result=suggestCanonicalSpecs27({observations:[{label:'Potência máxima motor elétrico dianteiro',kind:'numeric',unit:'kW',value:70,evidence}],catalog});
  expect(result[0]?.candidates).toHaveLength(0);
 });
 it('does not recommend numeric specs for binary equipment',()=>{
  const result=suggestCanonicalSpecs27({observations:[{label:'Potência combinada',kind:'binary',value:'STANDARD',evidence}],catalog});
  expect(result[0]?.candidates.every(x=>x.kind==='binary')).toBe(true);
 });
});
