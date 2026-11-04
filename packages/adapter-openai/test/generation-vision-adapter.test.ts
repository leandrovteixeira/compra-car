import {describe,it,expect,vi} from 'vitest';
import type {Response} from 'openai/resources/responses/responses';
import {OpenAIGenerationVisionAdapter,GenerationVisionError} from '../src/generation-vision-adapter';
const IMG='data:image/png;base64,'+'A'.repeat(200);
const pair={
 before:{modelYear:2026,sourceUrl:'https://www.gwmmotors.com.br/files/my26.pdf',imageDataUrl:IMG},
 after:{modelYear:2027,sourceUrl:'https://www.gwmmotors.com.br/files/my27.pdf',imageDataUrl:IMG},
};
const pricing={inputUsdPerMillion:0.75,cachedInputUsdPerMillion:0.075,outputUsdPerMillion:4.5};
function response(input:Partial<{status:string;output_text:string;usage:boolean}>={}):Response{
 return {
  id:'resp-test',model:'gpt-5.4-mini',
  status:input.status??'completed',
  output_text:input.output_text??JSON.stringify({severity:1,reason:'Updated front fascia only',visibleChanges:['grille']}),
  usage:input.usage===false?null:{
   input_tokens:500,input_tokens_details:{cached_tokens:100},
   output_tokens:70,total_tokens:570,
  },
  output:[],
 } as unknown as Response;
}
describe('OpenAI Generation Vision adapter',()=>{
 it('uses low-detail source images, dedicated key, no web search and reports actual usage',async()=>{
  const transport=vi.fn(async()=>response());
  const onUsage=vi.fn();
  const agent=new OpenAIGenerationVisionAdapter({
   apiKey:'fixture-only',model:'gpt-5.4-mini',pricing,
   transport,onUsage,
  });
  const result=await agent.assess(pair);
  expect(result.severity).toBe(1);
  expect(transport).toHaveBeenCalledOnce();
  const request=transport.mock.calls[0]![0] as any;
  expect(request.store).toBe(false);
  expect(request.tools).toBeUndefined();
  expect(request.input[0].content.filter((c:any)=>c.type==='input_image')).toHaveLength(2);
  expect(request.input[0].content[1].detail).toBe('low');
  expect(onUsage).toHaveBeenCalledOnce();
  expect(onUsage.mock.calls[0]![0]).toMatchObject({
   inputTokens:500,cachedInputTokens:100,outputTokens:70,
   reason:'GENERATION_DESIGN_COMPARISON',
  });
 });
 it('records actual billed usage even when model JSON is unusable',async()=>{
  const onUsage=vi.fn();
  const agent=new OpenAIGenerationVisionAdapter({
   apiKey:'fixture-only',model:'gpt-5.4-mini',pricing,onUsage,
   transport:async()=>response({output_text:'not-json'}),
  });
  await expect(agent.assess(pair)).rejects.toMatchObject({code:'GENERATION_MODEL_INVALID_OUTPUT'});
  expect(onUsage).toHaveBeenCalledOnce();
 });
 it('fails closed when usage is unavailable',async()=>{
  const agent=new OpenAIGenerationVisionAdapter({
   apiKey:'fixture-only',model:'gpt-5.4-mini',pricing,
   transport:async()=>response({usage:false}),
  });
  await expect(agent.assess(pair)).rejects.toMatchObject({code:'GENERATION_MODEL_INCOMPLETE'});
 });
 it('fails closed when model is incomplete',async()=>{
  const agent=new OpenAIGenerationVisionAdapter({
   apiKey:'fixture-only',model:'gpt-5.4-mini',pricing,
   transport:async()=>response({status:'incomplete'}),
  });
  await expect(agent.assess(pair)).rejects.toMatchObject({code:'GENERATION_MODEL_INCOMPLETE'});
 });
 it('rejects bad sources/images BEFORE issuing requests',async()=>{
  const transport=vi.fn(async()=>response());
  const agent=new OpenAIGenerationVisionAdapter({apiKey:'fixture-only',model:'gpt-5.4-mini',pricing,transport});
  await expect(agent.assess({...pair,before:{...pair.before,sourceUrl:'http://not-secure.com/a'}}))
    .rejects.toMatchObject({code:'GENERATION_SOURCE_INVALID'});
  await expect(agent.assess({...pair,after:{...pair.after,imageDataUrl:'https://example.com/a.jpg'}}))
    .rejects.toMatchObject({code:'GENERATION_IMAGE_INVALID'});
  expect(transport).not.toHaveBeenCalled();
 });
 it('rejects unknown pricing and costly requests',async()=>{
  expect(()=>new OpenAIGenerationVisionAdapter({
   apiKey:'fixture-only',model:'gpt-5.4-mini',pricing:{...pricing,inputUsdPerMillion:NaN},
  })).toThrow(GenerationVisionError);
  const transport=vi.fn(async()=>response());
  const agent=new OpenAIGenerationVisionAdapter({
   apiKey:'fixture-only',model:'gpt-5.4-mini',pricing,maxRunCostUsd:0.001,transport,
  });
  await expect(agent.assess(pair)).rejects.toMatchObject({code:'GENERATION_BUDGET_EXCEEDED'});
  expect(transport).not.toHaveBeenCalled();
 });
});