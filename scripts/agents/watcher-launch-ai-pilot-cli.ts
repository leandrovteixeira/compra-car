import { readFile, writeFile, open, mkdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, basename, isAbsolute } from 'node:path';
import { extractWatcherLaunchesWithOpenAi } from '@compra-car/adapter-openai';
import { loadWatcherAiPilotConfig } from './watcher-ai-pilot-config';
import { scoreWatcherLaunch } from './watcher-launch-scoring';

const directory=resolve(process.cwd(),'../../.local-reports/watcher-24b');
const MAX_ARTICLES=20;
const PER_CALL_RESERVE_USD=0.0125;
function fail(code:string):never {throw new Error(code);}
type Preview={mode:string;sourceId:string;eventDetection:{revisionId:string}[];
 analyses:{revision:{id:string;item:{title:string;excerpt:string|null}}}[]};
async function main() {
 if(process.argv.length!==4||process.argv[2]!=='--run-once')
   fail('WATCHER_LAUNCH_AI_OPT_IN_REQUIRED');
 const arg=process.argv[3]!;
 const path=resolve(arg);
 if(!isAbsolute(arg)||!path.startsWith(directory+'\\')||
    !/^intelligence-preview-[\w-]+\.json$/u.test(basename(path)))
   fail('WATCHER_LAUNCH_AI_INPUT_DENIED');
 const config=await loadWatcherAiPilotConfig();
 const bytes=await readFile(path);
 const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
 const input=JSON.parse(bytes.toString('utf8')) as Preview;
 if(input.mode!=='READ_ONLY'||input.sourceId!=='motor1-br-pilot'||
  input.analyses?.length!==MAX_ARTICLES||input.eventDetection?.length!==MAX_ARTICLES)
    fail('WATCHER_LAUNCH_AI_INPUT_INVALID');
 const byId=new Map(input.analyses.map(row=>[row.revision?.id,row]));
 if(byId.size!==MAX_ARTICLES||config.maxArticles!==MAX_ARTICLES||
   config.hardCostCapUsd+1e-10<MAX_ARTICLES*PER_CALL_RESERVE_USD)
   fail('WATCHER_LAUNCH_AI_INPUT_INVALID');
 const rows=input.eventDetection.map(ref=>{
  const original=byId.get(ref.revisionId)?.revision?.item;
  if(!original||typeof original.title!=='string'||!original.title.trim()||
     original.title.length>600||
     (original.excerpt!==null&&(typeof original.excerpt!=='string'||original.excerpt.length>1200)))
    fail('WATCHER_LAUNCH_AI_INPUT_INVALID');
  return {revisionId:ref.revisionId,text:[original.title,original.excerpt].filter(Boolean).join('\n')};
 });
 await mkdir(directory,{recursive:true});
 const markerPath=resolve(directory,'launch-ai-'+hash+'.started');
 const runId=randomUUID();
 const marker=await open(markerPath,'wx');
 try{await marker.writeFile(JSON.stringify({runId,sourceHash:hash,model:config.model,articles:MAX_ARTICLES})+'\n');}
 finally{await marker.close();}
 let calls=0,spentUsd=0;
 const results=[];
 for(const row of rows) {
   if(spentUsd+(MAX_ARTICLES-calls)*PER_CALL_RESERVE_USD>config.hardCostCapUsd+1e-10)
     fail('WATCHER_LAUNCH_AI_BUDGET_BLOCKED');
   const result=await extractWatcherLaunchesWithOpenAi({
      apiKey:config.apiKey,model:'gpt-5.4-mini',text:row.text});
   calls++;
   const costUsd=(result.inputTokens*0.75+result.outputTokens*4.5)/1_000_000;
   spentUsd+=costUsd;
   const scored=result.launches.map(launch=>scoreWatcherLaunch(row.revisionId,launch));
   const record={revisionId:row.revisionId,launches:result.launches,
     scored,inputTokens:result.inputTokens,outputTokens:result.outputTokens,costUsd};
   await writeFile(resolve(directory,'launch-ai-'+hash+'-'+String(calls).padStart(2,'0')+'.json'),
    JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});
   results.push(record);
   if(spentUsd>config.hardCostCapUsd)fail('WATCHER_LAUNCH_AI_BUDGET_EXCEEDED');
 }
 const output=resolve(directory,'launch-ai-'+hash+'.json');
 await writeFile(output,JSON.stringify({schemaVersion:'watcher-launch-ai/1',model:config.model,
  sourceHash:hash,calls,spentUsd,results},null,2)+'\n',{flag:'wx',mode:0o600});
 const all=results.flatMap(row=>row.scored);
 console.log(JSON.stringify({status:'PASS',articles:MAX_ARTICLES,calls,
   extractedLaunchMentions:all.length,eligible:all.filter(x=>x.decision==='MAP_ELIGIBLE').length,
   rumors:all.filter(x=>x.decision==='RUMOR_EXCLUDED').length,costUsd:spentUsd,resultFile:output}));
}
main().catch(error=>{
 const code=error&&typeof error==='object'&&'code' in error?(error as {code?:unknown}).code:null;
 const name=error instanceof Error&&/^WATCHER_LAUNCH_AI_[A-Z_]+$/u.test(error.message)?
   error.message:code==='EEXIST'?'WATCHER_LAUNCH_AI_ALREADY_STARTED':'WATCHER_LAUNCH_AI_BLOCKED';
 console.error(name);process.exitCode=1;
});
