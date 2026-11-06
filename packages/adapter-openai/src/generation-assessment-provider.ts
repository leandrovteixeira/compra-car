import {
  buildGenerationAssessment,
  type GenerationDocumentSnapshot,
  type GenerationImageComparison,
  type GenerationSourceDocument,
  type MmvGenerationAssessmentProvider,
  type MatchedProductCandidate,
} from '@compra-car/core/agents';
import {OpenAIGenerationVisionAdapter} from './generation-vision-adapter';

export interface VerifiedGenerationComparison {
  readonly currentMmvId:string;
  readonly previous:GenerationDocumentSnapshot;
  readonly current:GenerationDocumentSnapshot;
  readonly designImages:GenerationImageComparison|null;
  readonly designSources:readonly [GenerationSourceDocument,GenerationSourceDocument]|null;
}
export interface GenerationComparisonRepository {
  /** Reads verified technical snapshots and prepared manufacturer images.
   * This is NOT a web scraper or permission to scrape official sites. */
  load(input:{
    readonly currentMmvId:string;
    readonly currentModelYear:number;
  }):Promise<VerifiedGenerationComparison|null>;
}

/** Optional MMV Discovery assessment port: calls vision only when a verified
 * pair of official images exists. Otherwise returns UNKNOWN design for review.
 * It never modifies MMV, MY, specs, or executes background searches.
 */
export class OpenAIGenerationAssessmentProvider implements MmvGenerationAssessmentProvider {
  constructor(private readonly config:{
    repository:GenerationComparisonRepository;
    vision:OpenAIGenerationVisionAdapter;
    maxPairsPerRun?:number;
  }){}
  async assess(input:Parameters<MmvGenerationAssessmentProvider['assess']>[0]){
    const results=[];
    const seen=new Set<string>();
    const limit=this.config.maxPairsPerRun??1;
    if(!Number.isInteger(limit)||limit<1||limit>5)throw new Error('GENERATION_PAIR_BUDGET_INVALID');
    for(const matched of input.matchedCandidates){
      if(matched.matchedMmvIdentities.length!==1 || !matched.candidate.modelYear)continue;
      const mmv=matched.matchedMmvIdentities[0]!.id;
      const year=matched.candidate.modelYear;
      const key=mmv+':'+year;
      if(seen.has(key))continue;
      seen.add(key);
      if(results.length>=limit)break;
      const pair=await this.config.repository.load({currentMmvId:mmv,currentModelYear:year});
      if(!pair)continue;
      if(pair.currentMmvId!==mmv||pair.current.modelYear!==year||
         pair.previous.modelYear>=pair.current.modelYear)
        throw new Error('GENERATION_SOURCE_PAIR_BINDING_INVALID');
      if(pair.designImages && pair.designSources &&
         (pair.designImages.before.modelYear!==pair.previous.modelYear||
          pair.designImages.after.modelYear!==year||
          pair.designImages.before.sourceUrl!==pair.designSources[0].url||
          pair.designImages.after.sourceUrl!==pair.designSources[1].url))
        throw new Error('GENERATION_IMAGE_PAIR_BINDING_INVALID');
      const visual=pair.designImages && pair.designSources
        ? await this.config.vision.assess(pair.designImages):null;
      results.push(buildGenerationAssessment({
        previousMmvId:mmv,currentMmvId:mmv,
        previous:pair.previous,current:pair.current,
        design:visual,designSources:pair.designSources,
      }));
    }
    return results;
  }
}
