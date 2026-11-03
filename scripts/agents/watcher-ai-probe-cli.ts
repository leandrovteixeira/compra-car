import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractWatcherNewsWithOpenAi } from '@compra-car/adapter-openai';
import { loadWatcherAiPilotConfig } from './watcher-ai-pilot-config';

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--one-article')
    throw new Error('WATCHER_AI_PROBE_OPT_IN_REQUIRED');
  const config=await loadWatcherAiPilotConfig();
  const directory=resolve(process.cwd(),'../../.local-reports/watcher-24b');
  const { readdir } = await import('node:fs/promises');
  const files=(await readdir(directory)).filter(x=>/^intelligence-preview-.*\.json$/u.test(x));
  if (!files.length) throw new Error('WATCHER_AI_PROBE_NO_REPORT');
  const { stat }=await import('node:fs/promises');
  const ranked=await Promise.all(files.map(async name=>({name,time:(await stat(resolve(directory,name))).mtimeMs})));
  ranked.sort((a,b)=>b.time-a.time);
  const raw=JSON.parse(await readFile(resolve(directory,ranked[0]!.name),'utf8')) as {
    sourceId:string; mode:string; analyses:{revision:{item:{title:string;excerpt:string|null}}}[];
  };
  if (raw.mode!=='READ_ONLY'||raw.sourceId!=='motor1-br-pilot'||raw.analyses?.length!==20)
    throw new Error('WATCHER_AI_PROBE_INVALID_REPORT');
  const first=raw.analyses[0]?.revision?.item;
  if (!first || typeof first.title!=='string'||!first.title||first.title.length>600)
    throw new Error('WATCHER_AI_PROBE_INVALID_REPORT');
  const text=[first.title,typeof first.excerpt==='string'?first.excerpt:''].filter(Boolean).join('\n');
  console.log('WATCHER_AI_PROBE_CALL_START');
  const result=await extractWatcherNewsWithOpenAi({apiKey:config.apiKey,model:'gpt-5.4-mini',text});
  console.log(JSON.stringify({status:'PASS',model:config.model,
    events:result.events,inputTokens:result.inputTokens,outputTokens:result.outputTokens}));
}
main().catch(error=>{
  const e=error as {status?:number;code?:string;message?:string;name?:string};
  const safeCode=/^[A-Z0-9_]{3,80}$/u.test(e?.message??'') ? e.message : null;
  console.error(JSON.stringify({status:'FAIL',
    code:safeCode ?? 'WATCHER_AI_API_OR_RUNTIME_FAILURE',
    httpStatus:Number.isInteger(e?.status)?e.status:null,
    sdkCode:typeof e?.code==='string' && /^[a-z_]{2,60}$/u.test(e.code)?e.code:null,
    type:typeof e?.name==='string'&&/^[A-Za-z]{1,60}$/u.test(e.name)?e.name:null}));
  process.exitCode=1;
});
