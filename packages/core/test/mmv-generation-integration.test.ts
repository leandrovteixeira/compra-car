import {describe,expect,it,vi} from 'vitest';
import {
  NewProductCheckAgent,FixtureProductCatalogReader,
  FixtureProductResearchProvider,mapMmvRunToPlatform,
  type MmvGenerationAssessment,
} from '../src/agents';

const scope={country:'BR',brand:'Toyota'} as const;
function makeAssessment(input:{
  candidateYear:number;
  mmvId:string;
  sourceUrl:string;
  severity?:[0|1|2|3,0|1|2|3,0|1|2|3];
}):MmvGenerationAssessment{
  const dims=['design','powertrain','dimensions'] as const;
  const grades=input.severity??[0,1,0];
  return {
    previousModelYear:input.candidateYear-1,
    currentModelYear:input.candidateYear,
    previousMmvId:input.mmvId,
    currentMmvId:input.mmvId,
    signals:dims.map((dimension,i)=>({
      dimension,severity:grades[i]!,
      reason:dimension+' checked in source',
      evidence:[{sourceUrl:input.sourceUrl,sourceKind:'MANUFACTURER' as const,
        excerpt:dimension+' comparison (test fixture)',modelYear:input.candidateYear}],
    })),
  };
}
describe('MMV Generation end-to-end discovery review integration',()=>{
 it('produces one review-only generation finding from a matched MMV, without altering catalog',async()=>{
  const writer=vi.fn(async()=>{});
  const provider=vi.fn(async({matchedCandidates}:{
    matchedCandidates:readonly import('../src/agents').MatchedProductCandidate[]
  })=>{
    const match=matchedCandidates.find(m=>m.candidate.modelYear!==null)!;
    return [makeAssessment({
      candidateYear:match.candidate.modelYear!,
      mmvId:match.matchedMmvIdentities[0]!.id,
      sourceUrl:match.candidate.evidence[0]!.url,
    })];
  });
  const result=await new NewProductCheckAgent({
    research:new FixtureProductResearchProvider(),
    catalog:new FixtureProductCatalogReader(),
    reports:{write:writer},
    generationAssessmentProvider:{assess:provider},
    now:()=>new Date('2030-01-01T00:00:00Z'),
  }).run(scope,'00000000-0000-4000-8000-000000000011');
  expect(provider).toHaveBeenCalledOnce();
  expect(writer).toHaveBeenCalledOnce();
  expect(result.generationChangeProposals).toHaveLength(1);
  expect(result.generationChangeProposals?.[0]?.classification.changeType).toBe('MINOR_CHANGE');

  const bundle=mapMmvRunToPlatform(result,{provider:'test'});
  const review=bundle.findings.find(f=>f.finding.proposal?.action==='REVIEW_GENERATION_CHANGE');
  expect(review?.finding).toMatchObject({
    findingType:'AMBIGUOUS_MMV',requiresReview:true,
    payload:{reasonCode:'GENERATION_CHANGE_REVIEW',noAutomaticCarryOver:true},
    proposal:{action:'REVIEW_GENERATION_CHANGE',
      changeType:'MINOR_CHANGE',specCarryOverPolicy:'CANDIDATE_HIGH'},
  });
  expect(review?.evidence).toHaveLength(3);
  expect(review?.evidence.every(e=>e.sourceUrl.startsWith('https://'))).toBe(true);
  expect(bundle.run.summary.generationChangeProposals).toBe(1);
  expect(bundle.findings.filter(f=>f.finding.proposal?.action==='STAGE_MMV_IDENTITIES')
    .every(f=>f.finding.payload.reasonCode!=='GENERATION_CHANGE_REVIEW')).toBe(true);
 });
 it('keeps legacy flow unchanged when generation evidence provider is disconnected',async()=>{
  const result=await new NewProductCheckAgent({
    research:new FixtureProductResearchProvider(),
    catalog:new FixtureProductCatalogReader(),
    reports:{write:async()=>{}},
  }).run(scope,'00000000-0000-4000-8000-000000000012');
  expect(result.generationChangeProposals).toEqual([]);
  const bundle=mapMmvRunToPlatform(result,{provider:'test'});
  expect(bundle.findings.some(f=>f.finding.proposal?.action==='REVIEW_GENERATION_CHANGE')).toBe(false);
 });
 it('rejects foreign-source evidence and fails closed before publishing review finding',async()=>{
  await expect(new NewProductCheckAgent({
    research:new FixtureProductResearchProvider(),
    catalog:new FixtureProductCatalogReader(),
    reports:{write:async()=>{}},
    generationAssessmentProvider:{
      assess:async({matchedCandidates})=>{
        const match=matchedCandidates.find(m=>m.candidate.modelYear!==null)!;
        return [makeAssessment({
          candidateYear:match.candidate.modelYear!,
          mmvId:match.matchedMmvIdentities[0]!.id,
          sourceUrl:'https://not-the-manufacturer.example.org/other.pdf',
        })];
      },
    },
  }).run(scope,'00000000-0000-4000-8000-000000000013'))
    .rejects.toThrow('MMV_GENERATION_SOURCE_OUT_OF_SCOPE');
 });
});
