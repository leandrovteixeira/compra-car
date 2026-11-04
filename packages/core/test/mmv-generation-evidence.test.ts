import {describe,it,expect} from 'vitest';
import {
  buildGenerationAssessment,classifyMmvGenerationChange,
  type GenerationDocumentSnapshot,
} from '../src/agents';
const oldUrl='https://www.gwmmotors.com.br/documents/h6-2026.pdf';
const newUrl='https://www.gwmmotors.com.br/documents/h6-2027.pdf';
const old:GenerationDocumentSnapshot={
  modelYear:2026,
  dimensionMeasurements:{lengthMm:4703,widthMm:1886,heightMm:1730,wheelbaseMm:2738},
  dimensionsSource:{modelYear:2026,url:oldUrl,sourceKind:'MANUFACTURER',excerpt:'4703/1886/1730/2738 from 2026 PDF'},
  powertrain:{propulsion:'PHEV',architecture:'PHEV19',engineFamily:'1.5 T',fuel:'GASOLINE',transmissionFamily:'DHT'},
  powertrainSource:{modelYear:2026,url:oldUrl,sourceKind:'MANUFACTURER',excerpt:'1.5 turbo gasoline PHEV19'},
};
const now:GenerationDocumentSnapshot={
  modelYear:2027,
  dimensionMeasurements:{...old.dimensionMeasurements!},
  dimensionsSource:{modelYear:2027,url:newUrl,sourceKind:'MANUFACTURER',excerpt:'4703/1886/1730/2738 from 2027 PDF'},
  powertrain:{...old.powertrain!,fuel:'FLEX'},
  powertrainSource:{modelYear:2027,url:newUrl,sourceKind:'MANUFACTURER',excerpt:'1.5 turbo flex PHEV19'},
};
const identity={previousMmvId:'mmv-h6',currentMmvId:'mmv-h6'};
describe('Generation evidence: no invented continuity',()=>{
 it('takes same official dimensions and Flex conversion as minor change only when image design is corroborated',()=>{
  const a=buildGenerationAssessment({...identity,previous:old,current:now,
    design:{severity:0,reason:'Body design continuity assessed visually'},
    designSources:[old.dimensionsSource!,now.dimensionsSource!]});
  expect(a.signals.map(s=>s.severity)).toEqual([0,1,0]);
  expect(classifyMmvGenerationChange(a).changeType).toBe('MINOR_CHANGE');
  expect(classifyMmvGenerationChange(a).specCarryOverPolicy).toBe('CANDIDATE_HIGH');
  expect(a.signals[0]?.evidence).toHaveLength(2);
 });
 it('keeps UNKNOWN when visual evidence is not supplied',()=>{
  const a=buildGenerationAssessment({...identity,previous:old,current:now,design:null,designSources:null});
  expect(classifyMmvGenerationChange(a).changeType).toBe('UNKNOWN');
  expect(a.signals[0]?.evidence).toHaveLength(0);
 });
 it('does not invent unchanged when old dimensions come from unverified record',()=>{
  const a=buildGenerationAssessment({...identity,previous:{...old,dimensionsSource:null},current:now,
    design:null,designSources:null});
  expect(a.signals.find(s=>s.dimension==='dimensions')?.severity).toBeNull();
 });
 it('treats structural propulsion changes as strong powertrain but never alone new generation',()=>{
  const a=buildGenerationAssessment({...identity,previous:old,
    current:{...now,powertrain:{...now.powertrain!,propulsion:'BEV',architecture:'pure BEV'}},
    design:{severity:0,reason:'Same design'},designSources:[old.dimensionsSource!,now.dimensionsSource!]});
  expect(a.signals[1]?.severity).toBe(3);
  expect(classifyMmvGenerationChange(a).changeType).toBe('MINOR_CHANGE');
 });
 it('rejects reverse MY order',()=>{
  expect(()=>buildGenerationAssessment({...identity,previous:now,current:old,design:null,designSources:null}))
    .toThrow('GENERATION_MODEL_YEAR_ORDER_INVALID');
 });
});