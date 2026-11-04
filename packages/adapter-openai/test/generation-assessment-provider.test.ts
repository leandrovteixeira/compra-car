import {describe,it,expect,vi} from 'vitest';
import {OpenAIGenerationAssessmentProvider} from '../src/generation-assessment-provider';
import type {MatchedProductCandidate} from '@compra-car/core/agents';

const url=(year:number)=>'https://www.gwmmotors.com.br/h6/'+year+'.pdf';
const snap=(year:number,flex:boolean)=>({
 modelYear:year,
 dimensionMeasurements:{lengthMm:4703,widthMm:1886,heightMm:1730,wheelbaseMm:2738},
 dimensionsSource:{modelYear:year,url:url(year),sourceKind:'MANUFACTURER' as const,excerpt:'Measured in official sheet'},
 powertrain:{propulsion:'PHEV' as const,architecture:'PHEV19',engineFamily:'1.5 Turbo',
  fuel: flex?'FLEX' as const:'GASOLINE' as const,transmissionFamily:'DHT'},
 powertrainSource:{modelYear:year,url:url(year),sourceKind:'MANUFACTURER' as const,excerpt:'Official engine'},
});
const match={
 matchedMmvIdentities:[{id:'real-mmv-id'}],
 candidate:{modelYear:2027},
} as unknown as MatchedProductCandidate;
const img='data:image/png;base64,'+'A'.repeat(200);
const pair={
 currentMmvId:'real-mmv-id',previous:snap(2026,false),current:snap(2027,true),
 designImages:{before:{modelYear:2026,sourceUrl:url(2026),imageDataUrl:img},
   after:{modelYear:2027,sourceUrl:url(2027),imageDataUrl:img}},
 designSources:[
  {modelYear:2026,url:url(2026),sourceKind:'MANUFACTURER' as const,excerpt:'Official photo 2026'},
  {modelYear:2027,url:url(2027),sourceKind:'MANUFACTURER' as const,excerpt:'Official photo 2027'},
 ] as const,
};
describe('Generation assessment provider integrates with MMV matched candidate',()=>{
 it('uses exact predecessor MY, sends image comparison once and yields minor change',async()=>{
  const assess=vi.fn(async()=>({severity:0 as const,reason:'same visible body'}));
  const provider=new OpenAIGenerationAssessmentProvider({
   repository:{load:async()=>pair},
   vision:{assess} as any,
  });
  const got=await provider.assess({scope:{country:'BR',brand:'GWM'},matchedCandidates:[match]});
  expect(got).toHaveLength(1);
  expect(got[0]?.signals.map(s=>s.severity)).toEqual([0,1,0]);
  expect(assess).toHaveBeenCalledOnce();
 });
 it('does not call IA if no official image pair exists and flags design UNKNOWN',async()=>{
  const assess=vi.fn();
  const provider=new OpenAIGenerationAssessmentProvider({
   repository:{load:async()=>({...pair,designImages:null,designSources:null})},
   vision:{assess} as any,
  });
  const got=await provider.assess({scope:{country:'BR',brand:'GWM'},matchedCandidates:[match]});
  expect(got[0]?.signals[0]?.severity).toBeNull();
  expect(assess).not.toHaveBeenCalled();
 });
 it('rejects source images that are from unrelated MY/URL',async()=>{
  const provider=new OpenAIGenerationAssessmentProvider({
   repository:{load:async()=>({...pair,designImages:{...pair.designImages,
     before:{...pair.designImages.before,sourceUrl:url(2027)}}})},
   vision:{assess:vi.fn()} as any,
  });
  await expect(provider.assess({scope:{country:'BR',brand:'GWM'},matchedCandidates:[match]}))
   .rejects.toThrow('GENERATION_IMAGE_PAIR_BINDING_INVALID');
 });
 it('does not call the provider for ambiguous MMVs',async()=>{
  const assess=vi.fn();
  const provider=new OpenAIGenerationAssessmentProvider({
   repository:{load:assess},vision:{assess} as any,
  });
  const got=await provider.assess({scope:{country:'BR',brand:'GWM'},
   matchedCandidates:[{...match,matchedMmvIdentities:[{id:'a'},{id:'b'}]} as unknown as MatchedProductCandidate]});
  expect(got).toHaveLength(0);
  expect(assess).not.toHaveBeenCalled();
 });
});