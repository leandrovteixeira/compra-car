import {describe,it,expect} from 'vitest';
import type {Response} from 'openai/resources/responses/responses';
import {extractFordRangerXlsMatrix27} from '../src/ford-ranger-xls-matrix-extraction';
import {RANGER_XLS_MATRIX_PDF} from '@compra-car/core/agents';
const binding={page:2,
 headers:['XLS 4x4','Black','XLS 4WD','XLT 4WD','Limited'],columnIndex:2,
 engineRowLabel:'Motor 3.0 V6 turbo Diesel',
 engineCells:['-','-','x','x','x'],
 transmissionRowLabel:'Transmissão',
 transmissionCells:['AT 6 Vel.','AT 6 Vel.','AT 10 Vel.','AT 10 Vel.','AT 10 Vel.']
};
const cell={ordinal:1,page:2,rowSection:'INTERIOR',
 rowLabel:'Painel de instrumentos colorido, configuráveis através de comandos no volante',
 columnHeader:'XLS 4WD',legendExcerpt:'',
 rawCell:'8”',rowCells:['8”','8”','8”','8”','8”'],rawRowExcerpt:'Painel de instrumentos colorido, configuráveis através de comandos no volante',
 concept:'Painel de instrumentos digital',value:'8',unit:'inch',
 availability:'STANDARD'};
const result=(cells:unknown[],b:unknown=binding)=>({
 status:'completed',model:'gpt-5.4-mini-2026-03-17',
 usage:{input_tokens:4200,output_tokens:1900,input_tokens_details:{cached_tokens:0}},
 output_text:JSON.stringify({binding:b,cells})
}) as unknown as Response;
const base={sourceUrl:RANGER_XLS_MATRIX_PDF,
 pdf:Buffer.from('%PDF'+'.'.repeat(1200)),apiKey:'test'};
describe('Ford actual XLS matrix extractor',()=>{
 it('binds source SHA to actual printed third XLS column',async()=>{
  const usage:unknown[]=[];
  const r=await extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([cell]),onUsage:x=>{usage.push(x)}
  });
  expect(r.documentSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(r.claims[0]).toMatchObject({
   value:'8',availability:'STANDARD',scope:'XLS_MATRIX_CELL'
  });
  expect(usage).toHaveLength(1);
 });
 it('rejects x as OPTIONAL rather than present',async()=>{
  await expect(extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([{...cell,rawCell:'x',rowCells:['x','x','x','x','x'],availability:'OPTIONAL'}])
  })).rejects.toThrow('FORD_XLS_MATRIX_AVAILABILITY_MISMATCH');
 });
 it('rejects hallucinated V6 label instead of printed XLS 4WD header',async()=>{
  await expect(extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([{...cell,columnHeader:'Ranger XLS 3.0 V6 Diesel 4WD AT'}])
  })).rejects.toThrow('FORD_XLS_MATRIX_CELL_INVALID');
 });
 it('rejects wrong 3.0 engine alignment',async()=>{
  await expect(extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([cell],{...binding,engineCells:['x','-','-','x','x']})
  })).rejects.toThrow('FORD_XLS_MATRIX_COLUMN_IDENTITY_UNVERIFIED');
 });
});
