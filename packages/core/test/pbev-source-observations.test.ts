import {describe,expect,it} from 'vitest';
import {inspectPbevSourceRow27,type PbevSourceRow27,type PbevMmvIdentity27}
  from '../src/agents/pbev-source-observations';
const row:PbevSourceRow27={
  sourceEditionYear:2026,
  sourceUrl:'https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular/',
  documentSha256:'a'.repeat(64),sourcePage:8,
  brand:'FORD',model:'Nova Ranger 4x4',version:'XLS',
  engine:'3.0 V6 - 24V',transmission:'A-10',fuel:'DIESEL',
  cityKmL:8.6,highwayKmL:10.1,combinedKmL:9.2,energyMjKm:2.93
};
const identity:PbevMmvIdentity27={
 brand:'Ford',model:'Nova Ranger 4x4',version:'XLS',
 engine:'3.0 V6 - 24V',transmission:'A-10',modelYear:2026
};
describe('PBEV official observations',()=>{
 it('produces review-only fuel-scoped observations without diesel mapped as gasoline',()=>{
  const out=inspectPbevSourceRow27(row,identity);
  expect(out.match).toBe('REVIEW_REQUIRED');
  expect(out.observations).toHaveLength(4);
  expect(out.observations.find(x=>x.metric==='EFFICIENCY_MJ_KM'))
    .toMatchObject({value:2.93,canonicalCode:'OW_0001'});
  expect(out.observations.filter(x=>x.unit==='km/L').every(x=>x.canonicalCode===null))
    .toBe(true);
 });
 it('refuses to carry a PBEV 2026 row into Ford Ranger MY2027',()=>{
  expect(inspectPbevSourceRow27(row,{...identity,modelYear:2027}))
   .toEqual({match:'ABSTAIN',reasons:['MY_NOT_VERIFIED_BY_PBEV'],observations:[]});
 });
 it('abstains on transmission, engine and version mismatch',()=>{
  for(const key of ['engine','transmission','version'] as const){
   const alt={...identity,[key]:'not the same vehicle'};
   expect(inspectPbevSourceRow27(row,alt).match).toBe('ABSTAIN');
  }
 });
 it('rejects nonofficial URLs and impossible readings',()=>{
  expect(()=>inspectPbevSourceRow27({...row,sourceUrl:'https://fake.gov.br/inmetro/'},identity))
   .toThrow('PBEV_SOURCE_INVALID');
  expect(()=>inspectPbevSourceRow27({...row,cityKmL:-1},identity))
   .toThrow('PBEV_SOURCE_INVALID');
 });
 it('retains gasoline codes only for true gasoline source rows',()=>{
  const out=inspectPbevSourceRow27({...row,fuel:'GASOLINE'},identity);
  expect(out.observations.find(x=>x.metric==='CITY_KM_L')?.canonicalCode).toBe('OW_0002');
 });
});
