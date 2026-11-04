/** Explicit, bounded pilot. Not part of the autonomous worker schedule.
 * Example: pnpm --filter @compra-car/agents exec tsx generation-one-shot.ts \
 *   docs/agents/fixtures/gwm-h6-2026-2027-generation.json --offline
 * Live QA additionally requires two verified MY image files and --live-qa.
 */
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {
 buildGenerationAssessment,classifyMmvGenerationChange,
 type GenerationDocumentSnapshot,type GenerationSourceDocument,
} from '@compra-car/core/agents';
import {
 OpenAIGenerationVisionAdapter,type GenerationVisionUsage,
} from '@compra-car/adapter-openai';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';

type PilotManifest={
 previousMmvId:string;currentMmvId:string;brand:string;
 previous:GenerationDocumentSnapshot;current:GenerationDocumentSnapshot;
 designSources:readonly [GenerationSourceDocument,GenerationSourceDocument]|null;
 images: {beforeFile:string;afterFile:string}|null;
};
function within(root:string,p:string):string {
 const full=resolve(root,p), rel=relative(root,full);
 if(isAbsolute(rel)||rel.startsWith('..')||p.includes('\0'))throw new Error('GENERATION_PATH_REJECTED');
 return full;
}
function requireSource(doc:GenerationSourceDocument|null,year:number) {
 if(!doc||doc.modelYear!==year||!doc.url.startsWith('https://www.gwmmotors.com.br/'))
  throw new Error('GENERATION_SOURCE_NOT_OFFICIAL');
}
async function fileImage(root:string,p:string):Promise<string>{
 const path=within(root,p);
 if(!/\.(png|jpe?g|webp)$/iu.test(path))throw new Error('GENERATION_IMAGE_FORMAT_INVALID');
 const buf=await readFile(path);
 if(buf.length<32||buf.length>2_000_000)throw new Error('GENERATION_IMAGE_SIZE_INVALID');
 const mime=/\.png$/iu.test(path)?'png':/\.webp$/iu.test(path)?'webp':'jpeg';
 return 'data:image/'+mime+';base64,'+buf.toString('base64');
}
function boundedPricing(model:string) {
 // Confirmed official OpenAI GPT-5.4 Mini standard rates (November 2026).
 if(!['gpt-5.4-mini','gpt-5.4-mini-2026-03-17'].includes(model))
  throw new Error('GENERATION_MODEL_PRICING_UNVERIFIED');
 return {inputUsdPerMillion:0.75,cachedInputUsdPerMillion:0.075,outputUsdPerMillion:4.50};
}
export async function runGenerationPilot(
 args:readonly string[],env:NodeJS.ProcessEnv=process.env,
 out:(message:string)=>void=console.log,
 root=resolve(import.meta.dirname,'../..'),
):Promise<number>{
 const [source,mode,...extra]=args.filter(x=>x!=='--');
 if(!source||!['--offline','--live-qa'].includes(mode??'')||extra.length)
  throw new Error('GENERATION_PILOT_ARGUMENTS_INVALID');
 if(!source.startsWith('docs/agents/')||!source.endsWith('.json'))
  throw new Error('GENERATION_PILOT_SOURCE_PATH_INVALID');
 const manifest=JSON.parse(await readFile(within(root,source),'utf8')) as PilotManifest;
 if(!manifest||!manifest.brand||!manifest.previousMmvId||!manifest.currentMmvId||
    manifest.previous.modelYear>=manifest.current.modelYear)throw new Error('GENERATION_MANIFEST_INVALID');
 for(const snapshot of [manifest.previous,manifest.current]){
  requireSource(snapshot.dimensionsSource,snapshot.modelYear);
  requireSource(snapshot.powertrainSource,snapshot.modelYear);
 }
 let design=null;
 let usage:GenerationVisionUsage|null=null;
 let client:ReturnType<typeof createLegacySupabaseClient>|null=null;
 const runId=randomUUID();
 if(mode==='--live-qa'){
  if(env.APP_ENV!=='qa'||!env.SUPABASE_URL?.includes('shfsjyjxmgwnlexmdkcs')||
     !env.SUPABASE_SERVER_KEY)throw new Error('GENERATION_QA_ONLY');
  if(!env.OPENAI_GENERATION_CLASSIFIER_API_KEY?.trim())
    throw new Error('GENERATION_KEY_NOT_CONFIGURED');
  if(!manifest.images||!manifest.designSources)
    throw new Error('GENERATION_OFFICIAL_IMAGE_PAIR_REQUIRED');
  requireSource(manifest.designSources[0],manifest.previous.modelYear);
  requireSource(manifest.designSources[1],manifest.current.modelYear);
  client=createLegacySupabaseClient({
    url:env.SUPABASE_URL,serverKey:env.SUPABASE_SERVER_KEY,
  });
  const {error:insertErr}=await client.from('agent_runs').insert({
    id:runId,agent_type:'MMV_DISCOVERY',status:'RUNNING',market:'BR',brand:manifest.brand,
    provider:'openai',run_mode:'generation-pilot-qa',
    schema_version:'GENERATION-VISION.1',
    started_at:new Date().toISOString(),
    input:{targetMmvId:manifest.currentMmvId,previousModelYear:manifest.previous.modelYear,
      currentModelYear:manifest.current.modelYear,sourceUrls:manifest.designSources.map(x=>x.url)},
    summary:{stage:'VISION'},config_snapshot:{maxUsd:2,callBudget:1,model:'gpt-5.4-mini'},
  });
  if(insertErr)throw new Error('GENERATION_QA_RUN_INSERT_FAILED');
  try{
    const model='gpt-5.4-mini-2026-03-17';
    const vision=new OpenAIGenerationVisionAdapter({
      apiKey:env.OPENAI_GENERATION_CLASSIFIER_API_KEY,model,
      pricing:boundedPricing(model),maxRunCostUsd:2,
      onUsage:async event=>{
        usage=event;
        const {error}=await client!.from('agent_ai_usage_events').insert({
          run_id:runId,agent_type:'MMV_DISCOVERY',market:'BR',brand:manifest.brand,
          provider:'openai',model:event.providerModel,
          input_tokens:event.inputTokens,output_tokens:event.outputTokens,
          total_tokens:event.inputTokens+event.outputTokens,web_search_count:0,
          estimated_cost_usd:event.estimatedCostUsd,
          reason:'GENERATION_DESIGN_COMPARISON',
        });
        if(error)throw new Error('GENERATION_TELEMETRY_PERSIST_FAILED');
      },
    });
    design=await vision.assess({
      before:{
        modelYear:manifest.previous.modelYear,sourceUrl:manifest.designSources[0].url,
        imageDataUrl:await fileImage(root,manifest.images.beforeFile),
      },after:{
        modelYear:manifest.current.modelYear,sourceUrl:manifest.designSources[1].url,
        imageDataUrl:await fileImage(root,manifest.images.afterFile),
      },
    });
  }catch(e){
    await client.from('agent_runs').update({
      status:'FAILED',completed_at:new Date().toISOString(),
      error:{code:e instanceof Error?e.message:'GENERATION_UNKNOWN_FAILURE'},
      summary:{usageRecorded:usage!==null,stage:'FAILED'},
    }).eq('id',runId);
    throw e;
  }
 }
 const assessment=buildGenerationAssessment({
  previousMmvId:manifest.previousMmvId,currentMmvId:manifest.currentMmvId,
  previous:manifest.previous,current:manifest.current,design,
  designSources:mode==='--live-qa'?manifest.designSources:null,
 });
 const classification=classifyMmvGenerationChange(assessment);
 if(client){
  const {error}=await client.from('agent_runs').update({
    status:'COMPLETED',completed_at:new Date().toISOString(),
    summary:{changeType:classification.changeType,weightedScore:classification.weightedScore,
      usageRecorded:usage!==null,estimatedCostUsd:usage?.estimatedCostUsd??0,
      cachedInputTokens:usage?.cachedInputTokens??0,requiresReview:true,
      appliedToCatalog:false},
  }).eq('id',runId);
  if(error)throw new Error('GENERATION_QA_RUN_FINALIZE_FAILED');
 }
 out(JSON.stringify({runId:client?runId:null,mode,
  classification:classification.changeType,score:classification.weightedScore,
  signals:assessment.signals.map(x=>({dimension:x.dimension,severity:x.severity,
    evidenceCount:x.evidence.length})),usage:usage?{
      inputTokens:usage.inputTokens,cachedInputTokens:usage.cachedInputTokens,
      outputTokens:usage.outputTokens,estimatedCostUsd:usage.estimatedCostUsd,
    }:null,reviewOnly:true,canonicalWrites:false}));
 return 0;
}
if(process.argv[1]?.endsWith('generation-one-shot.ts')){
  void runGenerationPilot(process.argv.slice(2)).then(
    code=>{process.exitCode=code},
    e=>{console.error(e instanceof Error?e.message:'GENERATION_PILOT_ERROR');process.exitCode=1},
  );
}
