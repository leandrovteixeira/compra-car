import {describe,it,expect} from 'vitest';
import {suggestVocabularyMatches27} from '../src/agents/spec-vocabulary-hints';

const catalog=[
 {code:'CO_0017',label:'Painel de instrumentos digital',kind:'numeric' as const,unit:'inch'},
 {code:'PW_0028',label:'Capacidade da bateria (kW/h)',kind:'numeric' as const,unit:'kWh'},
 {code:'OW_0002',label:'Consumo urbano na gasolina (Km/L)',kind:'numeric' as const,unit:'km/L'},
 {code:'OW_0003',label:'Consumo rodoviário na gasolina (Km/L)',kind:'numeric' as const,unit:'km/L'},
 {code:'OW_0004',label:'Consumo urbano no etanol (Km/L)',kind:'numeric' as const,unit:'km/L'},
];
describe('supervised lexical spec review hints',()=>{
 it('proposes a review hint for the 8-inch Ford instrument panel without approving it',()=>{
  const rows=suggestVocabularyMatches27({
   label:'Painel de instrumentos colorido',rawLabel:'Painel de instrumentos colorido de 8’’',
   kind:'numeric',catalog
  });
  expect(rows[0]).toMatchObject({code:'CO_0017',reasons:['LEXICAL_REVIEW_HINT','UNIT_MATCH']});
  expect(rows[0]!.score).toBeLessThan(1);
 });
 it('never maps unknown or 12V auxiliary battery capacities to HV traction kWh',()=>{
  for(const label of ['Capacidade da bateria','Capacidade da bateria auxiliar 12 V','Bateria 12V']){
   expect(suggestVocabularyMatches27({label,kind:'numeric',catalog})).toEqual([]);
  }
 });
 it('never maps diesel consumption to gasoline or ethanol consumption',()=>{
  expect(suggestVocabularyMatches27({
   label:'Consumo urbano diesel',unit:'km/L',kind:'numeric',catalog
  })).toEqual([]);
 });
 it('never matches incompatible numeric units',()=>{
  expect(suggestVocabularyMatches27({
   label:'Consumo urbano na gasolina',unit:'MJ/km',kind:'numeric',catalog
  })).toEqual([]);
 });
 it('returns only same-kind review candidates, never automatic matching',()=>{
  expect(suggestVocabularyMatches27({
   label:'Painel de instrumentos digital',kind:'binary',catalog
  })).toEqual([]);
 });
});
