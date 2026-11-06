import {describe,expect,it} from 'vitest';
import {validateFordRangerXlsMatrix27,RANGER_XLS_MATRIX_PDF,type RangerXlsMatrixCell27}
 from '../src/agents/ford-ranger-xls-matrix';
const base:RangerXlsMatrixCell27={
 ordinal:1,page:2,rowLabel:'Painel de instrumentos colorido de 8 polegadas',
 columnHeader:'Ranger XLS 3.0 V6 Diesel 4x4 AT',
 legendExcerpt:'S = série; O = opcional; — = indisponível',
 rawCell:'S',rawRowExcerpt:'Painel instrumentos colorido de 8 polegadas',
 concept:'Painel de instrumentos digital',value:'8',unit:'inch',
 availability:'STANDARD',
};
const input={pdfUrl:RANGER_XLS_MATRIX_PDF,sha256:'a'.repeat(64),cells:[base]};
describe('Ford XLS matrix cells',()=>{
 it('keeps only the exact XLS diesel V6 4x4 cell and its legend',()=>{
  expect(validateFordRangerXlsMatrix27(input)[0]).toMatchObject({
   availability:'STANDARD',value:'8',unit:'inch',scope:'XLS_MATRIX_CELL',
   evidenceExcerpt:expect.stringContaining('Coluna: Ranger XLS 3.0 V6')
  });
 });
 it('rejects Limited optional screen even though the PDF contains it',()=>{
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[
    {...base,columnHeader:'Ranger Limited 3.0 V6 Diesel 4x4 AT',
     rowLabel:'Painel de instrumentos 12,4 polegadas',value:'12.4',
     availability:'OPTIONAL',rawCell:'O'}
  ]})).toThrow('FORD_XLS_MATRIX_CELL_INVALID');
 });
 it('does not guess availability without legend',()=>{
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[
   {...base,legendExcerpt:''}
  ]})).toThrow('FORD_XLS_MATRIX_LEGEND_MISSING');
 });
 it('requires a cell to justify absence',()=>{
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[
   {...base,availability:'NOT_AVAILABLE',rawCell:''}
  ]})).toThrow('FORD_XLS_MATRIX_LEGEND_MISSING');
 });
 it('rejects a header falsely presented as the equipment legend',()=>{
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[{
   ...base,rawCell:'x',availability:'OPTIONAL',
   legendExcerpt:'VERSÕES: XLS 3.0 V6 Diesel 4WD AT'
  }]})).toThrow('FORD_XLS_MATRIX_LEGEND_UNVERIFIED');
 });
 it('will not invent x meaning: the official legend must define the symbol',()=>{
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[{
   ...base,rawCell:'x',availability:'OPTIONAL',
   legendExcerpt:'S = série; O = opcional; - = não disponível'
  }]})).toThrow('FORD_XLS_MATRIX_LEGEND_UNVERIFIED');
 });
 it('keeps UNKNOWN when manufacturer table is unclear',()=>{
  expect(validateFordRangerXlsMatrix27({...input,cells:[
   {...base,availability:'UNKNOWN',rawCell:'',legendExcerpt:''}
  ]})[0]?.availability).toBe('UNKNOWN');
 });
});
