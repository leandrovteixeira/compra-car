import {describe,it,expect} from 'vitest';
import type {Response} from 'openai/resources/responses/responses';
import {extractManufacturerPdfClaims27} from '../src/spec-pdf-extraction';
const source={brand:'Ford',model:'Ranger',version:'Limited',modelYear:2027,
 sourceUrl:'https://media.ford.com/content/dam/ranger-limited-my27.pdf',
 bytes:Buffer.from('%PDF'+'.'.repeat(600))};
const response=(year='Ranger MY 2027')=>({
 status:'completed',model:'gpt-5.4-mini-2026-03-17',
 usage:{input_tokens:5000,output_tokens:250,input_tokens_details:{cached_tokens:0}},
 output_text:JSON.stringify({modelYearEvidence:year,versionEvidence:'Ranger Limited',
  claims:[{ordinal:1,page:2,label:'Trava da tampa da caçamba',kind:'binary',
    rawValue:'S',unit:null,sourceExcerpt:'Trava da tampa da caçamba - Limited S'}]})
}) as unknown as Response;
describe('manufacturer PDF supervised adapter',()=>{
 it('extracts only model-year and version-bound claims with usage telemetry',async()=>{
  const events:unknown[]=[];
  const r=await extractManufacturerPdfClaims27({source,apiKey:'test',
   transport:async()=>response(),onUsage:x=>{events.push(x)}});
  expect(r.claims).toHaveLength(1);
  expect(r.documentSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(r.estimatedCostUsd).toBeGreaterThan(0);
  expect(events).toHaveLength(1);
 });
 it('rejects an unproven model year',async()=>{
  await expect(extractManufacturerPdfClaims27({source,apiKey:'test',
   transport:async()=>response('Ranger MY 2025')}))
   .rejects.toThrow('SPEC_PDF_MY_VERSION_UNVERIFIED');
 });
 it('does not fetch untrusted source or accept corrupt PDFs',async()=>{
  await expect(extractManufacturerPdfClaims27({source:{
    ...source,sourceUrl:'https://example.com/fake.pdf'},apiKey:'test',
    transport:async()=>response()})).rejects.toThrow('SPEC_PDF_SOURCE_INVALID');
  await expect(extractManufacturerPdfClaims27({source:{
    ...source,bytes:Buffer.from('not-a-pdf')},apiKey:'test',
    transport:async()=>response()})).rejects.toThrow('SPEC_PDF_FILE_INVALID');
 });
 it('does not execute when admission cap is too low',async()=>{
  await expect(extractManufacturerPdfClaims27({source,apiKey:'test',maxCostUsd:0.01,
    transport:async()=>{throw Error('unexpected provider request')}}))
    .rejects.toThrow('SPEC_PDF_BUDGET_PRECHECK_FAILED');
 });
});
