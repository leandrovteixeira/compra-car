import {describe,expect,it} from 'vitest';
import {validateFordRangerXlsMatrix27,RANGER_XLS_MATRIX_PDF,
 type RangerXlsMatrixCell27,type RangerXlsMatrixBinding27}
 from '../src/agents/ford-ranger-xls-matrix';

export const binding:RangerXlsMatrixBinding27={
 page:2,headers:['XLS 4x4','Black','XLS 4WD','XLT 4WD','Limited'],columnIndex:2,
 engineRowLabel:'Motor 3.0 V6 turbo Diesel',
 engineCells:['-','-','x','x','x'],
 transmissionRowLabel:'Transmissão',
 transmissionCells:['AT 6 Vel.','AT 6 Vel.','AT 10 Vel.','AT 10 Vel.','AT 10 Vel.']
};
export const cell:RangerXlsMatrixCell27={
 ordinal:1,page:2,rowSection:'INTERIOR',
 rowLabel:'Painel de instrumentos colorido, configuráveis através de comandos no volante',
 columnHeader:'XLS 4WD',legendExcerpt:'',
 rawCell:'8”',rawRowExcerpt:'Painel de instrumentos colorido, configuráveis através de comandos no volante',
 concept:'Painel de instrumentos digital',value:'8',unit:'inch',availability:'STANDARD'
};
const input={pdfUrl:RANGER_XLS_MATRIX_PDF,sha256:'a'.repeat(64),binding,cells:[cell]};
describe('Ford actual printed XLS 4WD matrix binding',()=>{
 it('accepts third XLS 4WD column only when engine/transmission align',()=>{
  expect(validateFordRangerXlsMatrix27(input)[0]).toMatchObject({
   value:'8',unit:'inch',availability:'STANDARD',scope:'XLS_MATRIX_CELL',
   evidenceExcerpt:expect.stringContaining('Coluna impressa 3/5: XLS 4WD')
  });
 });
 it('maps printed x to STANDARD (present), never OPTIONAL',()=>{
  expect(validateFordRangerXlsMatrix27({...input,cells:[
   {...cell,rawCell:'x',availability:'STANDARD'}
  ]})[0]?.availability).toBe('STANDARD');
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[
   {...cell,rawCell:'x',availability:'OPTIONAL'}
  ]})).toThrow('FORD_XLS_MATRIX_AVAILABILITY_MISMATCH');
 });
 it('maps dash to NOT_AVAILABLE, not optional',()=>{
  expect(validateFordRangerXlsMatrix27({...input,cells:[
   {...cell,rawCell:'-',value:null,availability:'NOT_AVAILABLE'}
  ]})[0]?.availability).toBe('NOT_AVAILABLE');
 });
 it('rejects first XLS 4x4, Limited, false technical header, and wrong engine binding',()=>{
  for(const heading of ['XLS 4x4','Limited','Ranger XLS 3.0 V6 Diesel 4WD AT']){
   expect(()=>validateFordRangerXlsMatrix27({...input,cells:[
    {...cell,columnHeader:heading}
   ]})).toThrow('FORD_XLS_MATRIX_CELL_INVALID');
  }
  expect(()=>validateFordRangerXlsMatrix27({...input,binding:{
   ...binding,engineCells:['x','-','-','x','x']
  }})).toThrow('FORD_XLS_MATRIX_COLUMN_IDENTITY_UNVERIFIED');
 });
 it('excludes Limited optional 12.4-inch content from XLS',()=>{
  expect(()=>validateFordRangerXlsMatrix27({...input,cells:[{
   ...cell,columnHeader:'Limited',rawCell:'OPT',value:'12.4',
   rowLabel:'Kit Opcional da versão Limited – Painel de instrumentos 12,4 polegadas',
   availability:'OPTIONAL'
  }]})).toThrow('FORD_XLS_MATRIX_CELL_INVALID');
 });
 it('catches third-column drift when LLM copies x from another version',()=>{
  for(const rowLabel of ['Bagageiro de teto','Estribo Plataforma','Faróis de neblina em Led']){
   expect(()=>validateFordRangerXlsMatrix27({...input,cells:[{
    ...cell,rowLabel,rawRowExcerpt:rowLabel,rawCell:'x',
    value:null,availability:'STANDARD'
   }]})).toThrow('FORD_XLS_MATRIX_GOLDEN_ROW_MISMATCH');
  }
 });
 it('recognizes verified Ford XLS anchor cells',()=>{
  expect(validateFordRangerXlsMatrix27({...input,cells:[{
   ...cell,rowLabel:'Bagageiro de teto',rawRowExcerpt:'Bagageiro de teto',
   rawCell:'-',value:null,availability:'NOT_AVAILABLE'
  }]})[0]?.availability).toBe('NOT_AVAILABLE');
 });
 it('keeps unknown or ambiguous cells UNKNOWN',()=>{
  expect(validateFordRangerXlsMatrix27({...input,cells:[
   {...cell,rawCell:'',value:null,availability:'UNKNOWN'}
  ]})[0]?.availability).toBe('UNKNOWN');
 });
});
