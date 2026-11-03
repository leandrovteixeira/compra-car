import {describe,expect,it} from 'vitest';
import {planSpecWrites27} from '../src/agents/spec-agent-write-plan';
import type {SpecChange27} from '../src/agents/spec-agent-reconciliation';
const catalog=[
 {id:'1',code:'POWER',type:'numeric' as const,unit:'kW',groupName:'Powertrain',equipmentGroup:'Motor',specSet:'Power',detail:'Power'},
 {id:'2',code:'ACC',type:'binary' as const,unit:null,groupName:'ADAS',equipmentGroup:'Cruise',specSet:'ACC',detail:'ACC'},
];
const change=(specCode:string,kind:'binary'|'numeric',value:number|string,extra:Record<string,unknown>={}):SpecChange27=>({
 specCode,next:{specCode,kind,value,confirmed:true,...extra},reason:'NEW'
});
describe('Spec Agent write plan (read-only)',()=>{
 it('maps numeric and binary values to legacy product_specs IDs',()=>{
  const result=planSpecWrites27({productId:'p',catalog,changes:[
   change('POWER','numeric',70,{unit:'kW'}),change('ACC','binary','STANDARD')
  ]});
  expect(result.upserts).toMatchObject([
   {productId:'p',specId:'1',specCode:'POWER',value:70,isPresent:null},
   {productId:'p',specId:'2',specCode:'ACC',value:null,isPresent:true}
  ]);
 });
 it('holds optional, inequality, inherited and measurement cycles instead of corrupting legacy representation',()=>{
  const result=planSpecWrites27({productId:'p',catalog,changes:[
   change('ACC','binary','OPTIONAL'),
   change('POWER','numeric',140,{unit:'kW',comparisonOperator:'>='}),
   change('POWER','numeric',70,{unit:'kW',confirmed:false}),
   change('POWER','numeric',283,{unit:'kW',methodology:'PBEV'})
  ]});
  expect(result.upserts).toHaveLength(0);
  expect(result.holds.map(x=>x.reason)).toEqual([
   'OPTIONAL_NEEDS_SEPARATE_STORAGE','NUMERIC_OPERATOR_NOT_REPRESENTABLE',
   'PROVISIONAL_VALUE','METHODOLOGY_NOT_REPRESENTABLE'
  ]);
 });
 it('only converts units with an explicit known conversion',()=>{
  const result=planSpecWrites27({productId:'p',catalog,changes:[change('POWER','numeric',70000,{unit:'W'})]});
  expect(result.holds[0]?.reason).toBe('UNIT_CONVERSION_REQUIRED');
  const yes=planSpecWrites27({productId:'p',catalog,changes:[change('POWER','numeric',70000,{unit:'W'})],
   unitConversions:[{unitFrom:'W',unitTo:'kW',multiplier:.001,offset:0}]});
  expect(yes.upserts[0]?.value).toBe(70);
 });
});
