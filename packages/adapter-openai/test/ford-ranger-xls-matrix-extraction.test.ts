import {describe,it,expect} from 'vitest';
import type {Response} from 'openai/resources/responses/responses';
import {extractFordRangerXlsMatrix27} from '../src/ford-ranger-xls-matrix-extraction';
import {RANGER_XLS_MATRIX_PDF} from '@compra-car/core/agents';
const cell={
 ordinal:1,page:2,rowLabel:'Painel de instrumentos colorido de 8 polegadas',
 columnHeader:'Ranger XLS 3.0 V6 Diesel 4WD AT',
 legendExcerpt:'S = série, O = opcional, — = indisponível',
 rawCell:'S',rawRowExcerpt:'Painel de instrumentos colorido de 8 polegadas',
 concept:'Painel de instrumentos digital',value:'8',unit:'inch',
 availability:'STANDARD'
};
const result=(cells:unknown[])=>({
 status:'completed',model:'gpt-5.4-mini-2026-03-17',
 usage:{input_tokens:4200,output_tokens:1900,input_tokens_details:{cached_tokens:0}},
 output_text:JSON.stringify({columns:['Ranger XLS 3.0 V6 Diesel 4WD AT'],
  legendExcerpt:'S = série, O = opcional',cells})
}) as unknown as Response;
const base={sourceUrl:RANGER_XLS_MATRIX_PDF,
 pdf:Buffer.from('%PDF'+'.'.repeat(1200)),apiKey:'test'};
describe('Ford XLS matrix AI extractor',()=>{
 it('produces a review-only claim bound to exact XLS cell and PDF hash',async()=>{
  const events:unknown[]=[];
  const r=await extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([cell]),
   onUsage:e=>{events.push(e)}
  });
  expect(r.documentSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(r.claims[0]).toMatchObject({
   value:'8',unit:'inch',availability:'STANDARD',scope:'XLS_MATRIX_CELL'
  });
  expect(events).toHaveLength(1);
 });
 it('rejects a Limited-only optional 12.4-inch cell masquerading as XLS',async()=>{
  await expect(extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([{
    ...cell,columnHeader:'Ranger Limited 3.0 V6 Diesel 4WD AT',
    value:'12.4',rawCell:'O',availability:'OPTIONAL'
   }])
  })).rejects.toThrow('FORD_XLS_MATRIX_CELL_INVALID');
 });
 it('rejects a cell with no equipment legend',async()=>{
  await expect(extractFordRangerXlsMatrix27({...base,
   transport:async()=>result([{...cell,legendExcerpt:''}])
  })).rejects.toThrow('FORD_XLS_MATRIX_LEGEND_MISSING');
 });
 it('enforces official PDF and PDF byte safety',async()=>{
  await expect(extractFordRangerXlsMatrix27({...base,sourceUrl:'https://example.org/ranger.pdf',
   transport:async()=>result([cell])
  })).rejects.toThrow('FORD_XLS_MATRIX_SOURCE_INVALID');
 });
});
