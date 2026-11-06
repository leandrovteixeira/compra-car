import {describe,expect,it} from 'vitest';
import {separateSpecConceptAndValue27} from '../src/agents/spec-claim-value-separation';

describe('source concept and measured-value separation',()=>{
 it('splits the Ford instrument cluster dimensions without discarding the literal label',()=>{
  expect(separateSpecConceptAndValue27('Painel de instrumentos colorido de 8’’')).toEqual({
    rawLabel:'Painel de instrumentos colorido de 8’’',
    specLabel:'Painel de instrumentos colorido',observedValue:'8',
    observedUnit:'inch',valueSource:'EMBEDDED_LABEL',
  });
  expect(separateSpecConceptAndValue27('Painel de instrumentos digital de 12,3”'))
    .toMatchObject({specLabel:'Painel de instrumentos digital',observedValue:'12.3',observedUnit:'inch'});
 });
 it('extracts panel size with steering wheel configuration clause without deleting original text',()=>{
  const original='Painel de instrumentos colorido de 12,4" configurável através de comandos no volante';
  expect(separateSpecConceptAndValue27(original)).toMatchObject({
    rawLabel:original,specLabel:'Painel de instrumentos colorido',
    observedValue:'12.4',observedUnit:'inch',valueSource:'EMBEDDED_LABEL'
  });
 });
 it('does not collapse a 12V auxiliary battery into a traction battery',()=>{
  for(const raw of ['Capacidade da bateria','Bateria auxiliar 12 V',
    'Bateria de tração de alta tensão 77 kWh','Provisão elétrica de reboque']){
    expect(separateSpecConceptAndValue27(raw)).toMatchObject({
      rawLabel:raw,specLabel:raw,observedValue:null,observedUnit:null,
      valueSource:'NONE',
    });
  }
 });
 it('does not invent availability, numeric value or unit from unrelated words',()=>{
  expect(separateSpecConceptAndValue27('Painel de instrumentos digital'))
    .toMatchObject({specLabel:'Painel de instrumentos digital',observedValue:null});
 });
});
