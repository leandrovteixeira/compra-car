import OpenAI from 'openai';

export type LaunchMyLookup = Readonly<{
 modelYear:number|null; confidence:number;
 sourceUrl:string|null; evidence:string|null;
 status:'CONFIRMED'|'UNKNOWN'|'CONFLICT';
 alternatives:number[];
}>;
export type LaunchMyUsage = Readonly<{
 model:string;inputTokens:number;outputTokens:number;webSearchCount:number;
}>;
const schema={
 type:'object',additionalProperties:false,
 required:['status','modelYear','confidence','sourceUrl','evidence','alternatives'],
 properties:{
  status:{type:'string',enum:['CONFIRMED','UNKNOWN','CONFLICT']},
  modelYear:{type:['integer','null']},
  confidence:{type:'number'},
  sourceUrl:{type:['string','null']},
  evidence:{type:['string','null']},
  alternatives:{type:'array',items:{type:'integer'}},
 },
} as const;

export async function lookupLaunchModelYear(input:Readonly<{
 apiKey:string;model:string;brand:string;vehicleModel:string;version:string|null;
}>):Promise<{result:LaunchMyLookup;usage:LaunchMyUsage}>{
 const client=new OpenAI({apiKey:input.apiKey,timeout:60_000,maxRetries:0,logLevel:'off'});
 const query=[input.brand,input.vehicleModel,input.version??'','ano modelo MY Brasil 0km condições comerciais concessionária'].filter(Boolean).join(' ');
 const instructions=[
  'Determine ONLY the Brazilian launch model year (MY) of this exact commercial vehicle version.',
  'Search the open web: official commercial conditions, automaker configurator, authorized dealer 0-km offers and auto journalism.',
  'Do not use FIPE or FIPE mirror sites. Do not use the publication year as MY.',
  'A listing 2026/2027 establishes MY 2027. Ignore production year.',
  'Never borrow MY from a different trim, unrelated model or different country.',
  'Provide the direct URL and a short evidence excerpt that explicitly supports the MY.',
  'If explicit evidence is not found return UNKNOWN with null MY, URL and excerpt.',
  'If conflicting explicit MY offers, return CONFLICT and observed alternatives.',
  'Do not include any production year or other catalog metadata.',
 ].join('\n');
 let response=await client.responses.create({
   model:input.model,background:true,store:true,
   instructions,
   input:JSON.stringify({brand:input.brand,model:input.vehicleModel,version:input.version,market:'BR',searchQuery:query}),
   tools:[{type:'web_search',user_location:{type:'approximate',country:'BR'}}],
   tool_choice:'required',
   include:['web_search_call.action.sources'],
   text:{format:{type:'json_schema',name:'launch_my_lookup_v1',strict:true,schema}},
 });
 const deadline=Date.now()+180_000;
 while(response.status==='queued'||response.status==='in_progress'){
   if(Date.now()>deadline)throw new Error('MY_LOOKUP_TIMEOUT');
   await new Promise<void>(r=>setTimeout(r,1500));
   response=await client.responses.retrieve(response.id,{include:['web_search_call.action.sources']});
 }
 if(response.status!=='completed')throw new Error('MY_LOOKUP_INCOMPLETE');
 let decoded:LaunchMyLookup;
 try{decoded=JSON.parse(response.output_text) as LaunchMyLookup;}catch{throw new Error('MY_LOOKUP_INVALID_JSON');}
 const webSearchCount=response.output.filter(x=>x.type==='web_search_call').length;
 if(webSearchCount<1)throw new Error('MY_LOOKUP_NO_WEB_SEARCH');
 const result={...decoded};
 if(result.status==='CONFIRMED'&&(
    !Number.isInteger(result.modelYear)||result.modelYear!<2000||result.modelYear!>2100||
    !result.sourceUrl?.startsWith('https://')||!result.evidence?.trim()
 ))throw new Error('MY_LOOKUP_EVIDENCE_INCOMPLETE');
 if(result.status!=='CONFIRMED')result.modelYear=null;
 return {result,usage:{
  model:response.model,inputTokens:response.usage?.input_tokens??0,
  outputTokens:response.usage?.output_tokens??0,webSearchCount,
 }};
}
