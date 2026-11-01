import {OpenAIProductResearchProvider,productResearchMaxWaitMs} from '@compra-car/adapter-openai';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {requireAgentOpenAiApiKey} from './agent-openai-credentials';
import {loadAgentEnvironment} from './agent-environment';
import {resolve} from 'node:path';

export async function runMyLaunchBenchmark(
 job:{id:string;brand:string;model:string;version:string},
 environment:Readonly<Record<string,string|undefined>>=process.env,
 log:(s:string)=>void=console.log,
):Promise<void>{
 const env=await loadAgentEnvironment(resolve(process.cwd(),'../..'),environment);
 if(env.APP_ENV!=='qa'||env.SUPABASE_URL!=='https://shfsjyjxmgwnlexmdkcs.supabase.co')
   throw new Error('MY_BENCHMARK_QA_ONLY');
 if(!env.SUPABASE_SERVER_KEY||!env.OPENAI_AGENT_MODEL)throw new Error('MY_BENCHMARK_CONFIG_REQUIRED');
 const db=createLegacySupabaseClient({url:env.SUPABASE_URL,serverKey:env.SUPABASE_SERVER_KEY});
 const prompt=[
  'You are testing launch model-year discovery for one exact Brazilian vehicle version.',
  'Target brand: '+job.brand,'Target model: '+job.model,'Target version: '+job.version,
  'Find ONLY the MY (model year) explicitly advertised for THIS exact version.',
  'DO NOT use FIPE, FIPE mirrors, model-year price databases or FIPE API.',
  'Search official Brazilian automaker commercial conditions, vehicle configurators, authorized dealer 0-km offers and auto industry press beyond official brand domains.',
  'Prefer explicit 0-km MY in a current or dated offer. A 2026/2027 offer proves MY 2027.',
  'Ignore production year completely. Do not infer MY from launch or publication date.',
  'Do not return a different trim or model, even if similar. An unknown result is better than guessing.',
  'Output candidates only for exactly the specified brand, model and version; include verbatim supporting excerpt and direct evidence URLs.',
  'Use the required official_product_candidates schema. Each candidate must contain its explicit MY if confirmed. If no evidence is found, return an empty candidates array.',
 ].join('\n');
 const provider=new OpenAIProductResearchProvider({
  apiKey:requireAgentOpenAiApiKey(env,'MODEL_YEAR'),model:env.OPENAI_AGENT_MODEL,
  prompt,allowExternalSources:true,maxWaitMs:productResearchMaxWaitMs(env.OPENAI_AGENT_MAX_WAIT_MS),
 });
 const response=await provider.researchProducts({country:'BR',brand:job.brand});
 const raw=response.candidates as unknown as Array<Record<string,unknown>>;
 const norm=(v:unknown)=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const matches=raw.filter(x=>norm(x.brand)===norm(job.brand)&&norm(x.model)===norm(job.model)&&
  norm(x.officialVersionLabel??x.trim)===norm(job.version));
 const years=[...new Set(matches.map(x=>Number(x.modelYear)).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2100))];
 const evidence=matches.flatMap(x=>Array.isArray(x.evidence)?x.evidence:[]);
 const status=years.length>1?'CONFLICT':years.length===1&&evidence.length>0?'CONFIRMED':'UNKNOWN';
 const metadata=response.metadata;
 const {error}=await db.from('agent_my_benchmark_results').insert({
  job_id:job.id,brand:job.brand,model:job.model,version:job.version,status,
  detected_model_year:years.length===1?years[0]:null,
  candidate_payload:matches,evidence,
  input_tokens:metadata.inputTokens||0,output_tokens:metadata.outputTokens||0,
  web_search_count:metadata.webSearchCount||0,
 });
 if(error)throw new Error('MY_BENCHMARK_RESULT_WRITE_FAILED');
 log('MY benchmark '+job.brand+' '+job.model+' '+job.version+' status='+status+' MY='+years.join(','));
}
