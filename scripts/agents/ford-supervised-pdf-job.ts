/** QA Ford supervised PDF source intake.
 * The operator supplies an approved, official HTTPS PDF URL and exact target.
 * The PDF body is fetched once without redirects or ambient credentials.
 */
import {createHash} from 'node:crypto';
import {extractManufacturerPdfClaims27} from '@compra-car/adapter-openai';
import {runSupervisedFordSpecJob} from './spec-supervised-worker';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';

type Client=ReturnType<typeof createLegacySupabaseClient>;
export interface SupervisedFordPdfJob {
 readonly productId:number;
 readonly model:string;
 readonly version:string;
 readonly modelYear:number;
 readonly url:string;
 readonly expectedSha256?:string;
}
function officialFordUrl(url:string):URL{
 let u:URL;
 try{u=new URL(url);}catch{throw new Error('FORD_PDF_SOURCE_INVALID');}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||
   !['www.ford.com.br','ford.com.br','media.ford.com'].includes(u.hostname))
    throw new Error('FORD_PDF_SOURCE_INVALID');
 if(!/\.pdf(?:$)/iu.test(u.pathname))throw new Error('FORD_PDF_EXPECTED');
 return u;
}
export async function officialFordPdfBytes(url:string):Promise<Uint8Array>{
 const target=officialFordUrl(url);
 const response=await fetch(target.href,{redirect:'manual',signal:AbortSignal.timeout(30000),
  headers:{accept:'application/pdf'}});
 if(!response.ok||response.status>=300||!response.body)
  throw new Error('FORD_PDF_FETCH_FAILED');
 const cap=3_000_000;
 if(Number(response.headers.get('content-length')??0)>cap)
  throw new Error('FORD_PDF_TOO_LARGE');
 const reader=response.body.getReader();
 const chunks:Uint8Array[]=[];
 let total=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;
   if(total>cap)throw new Error('FORD_PDF_TOO_LARGE');
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=Buffer.concat(chunks.map(x=>Buffer.from(x)));
 if(bytes.length<512||bytes.subarray(0,4).toString('ascii')!=='%PDF')
   throw new Error('FORD_PDF_INVALID');
 return bytes;
}
export async function runSupervisedFordPdfJob(input:{
 jobId:string;jobCreatedAt:string;brand:string;market:string;
 source:SupervisedFordPdfJob;db:Client;apiKey:string;
}):Promise<{runId:string;reviewFindings:number;unmatched:number}>{
 if(input.market!=='BR'||input.brand.toUpperCase()!=='FORD'||!input.apiKey?.trim()||
   !Number.isSafeInteger(input.source.productId)||input.source.productId<1||
   !input.source.model.trim()||!input.source.version.trim()||
   !Number.isInteger(input.source.modelYear)||
   !Number.isFinite(Date.parse(input.jobCreatedAt)))
   throw new Error('FORD_PDF_JOB_INVALID');
 const {data:product,error:productError}=await input.db.from('products')
  .select('id,brand,model,version,model_year,mmv_id')
  .eq('id',input.source.productId).maybeSingle();
 if(productError||!product||!product.mmv_id||
   String(product.brand).toLowerCase()!=='ford'||
   String(product.model).toLowerCase()!==input.source.model.toLowerCase()||
   String(product.version).toLowerCase()!==input.source.version.toLowerCase()||
   Number(product.model_year)!==input.source.modelYear)
   throw new Error('FORD_PDF_CANONICAL_TARGET_REQUIRED');
 const bytes=await officialFordPdfBytes(input.source.url);
 const hash=createHash('sha256').update(bytes).digest('hex');
 if(input.source.expectedSha256&&input.source.expectedSha256!==hash)
  throw new Error('FORD_PDF_REVISION_CHANGED');
 const extracted=await extractManufacturerPdfClaims27({
  source:{brand:'Ford',model:input.source.model,version:input.source.version,
   modelYear:input.source.modelYear,sourceUrl:input.source.url,bytes},
  apiKey:input.apiKey,
  maxCostUsd:2,
  onUsage:async usage=>{
   // Record provider usage even if later validation/mapping fails; prevents
   // invisible charges. This ledger row belongs to the claimed agent job.
   const {error}=await input.db.from('agent_ai_usage_events').insert({
    job_id:input.jobId,agent_type:'SPEC_INTELLIGENCE',market:'BR',brand:'Ford',
    provider:'openai',model:usage.model,input_tokens:usage.inputTokens,
    output_tokens:usage.outputTokens,
    total_tokens:usage.inputTokens+usage.outputTokens,
    web_search_count:0,estimated_cost_usd:usage.estimatedCostUsd,
    reason:'SPEC_PDF_CLAIM_EXTRACTION'
   });
   if(error)throw new Error('FORD_PDF_USAGE_LEDGER_FAILED');
  }
 });
 if(extracted.documentSha256!==hash||extracted.modelYear!==input.source.modelYear)
  throw new Error('FORD_PDF_EXTRACTED_IDENTITY_INVALID');
 return runSupervisedFordSpecJob({
  jobId:input.jobId,jobCreatedAt:input.jobCreatedAt,
  market:input.market,brand:input.brand,db:input.db,
  snapshot:{
   target:{productId:input.source.productId,modelYear:input.source.modelYear,
    brand:'Ford',model:input.source.model,version:input.source.version},
   source:{url:input.source.url,sha256:hash,
    capturedAt:new Date().toISOString(),declaredModelYear:input.source.modelYear,
    authority:'MANUFACTURER'},
   claims:extracted.claims.map(c=>({
    ordinal:c.ordinal,page:c.page,label:c.label,rawLabel:c.rawLabel,kind:c.kind,
    unit:c.unit,rawValue:c.rawValue
   })),
   operatorVerified:true
  }
 });
}
