import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, isAbsolute } from 'node:path';
import { extractWatcherNewsWithOpenAi } from '@compra-car/adapter-openai';
import { loadWatcherAiPilotConfig } from './watcher-ai-pilot-config';

const directory = resolve(process.cwd(), '../../.local-reports/watcher-24b');
const RESERVE_PER_ARTICLE_USD = 0.0125;
const INPUT_USD_PER_MILLION = 0.75;
const OUTPUT_USD_PER_MILLION = 4.50;

type Input = Readonly<{revisionId:string; text:string}>;
type Preview = {
  mode: string;
  sourceId: string;
  eventDetection: {revisionId:string}[];
  analyses: {revision:{id:string;item:{title:string;excerpt:string|null}}}[];
};
function fail(message: string): never { throw new Error(message); }
function loadInput(raw:unknown): Input[] {
  if (!raw || typeof raw!=='object') return fail('WATCHER_AI_INPUT_INVALID');
  const p=raw as Preview;
  if (p.mode!=='READ_ONLY' || p.sourceId!=='motor1-br-pilot' ||
      !Array.isArray(p.eventDetection) || !Array.isArray(p.analyses) ||
      p.eventDetection.length!==20 || p.analyses.length!==20)
    return fail('WATCHER_AI_INPUT_INVALID');
  if (p.analyses.some(a=>!a || !a.revision || !a.revision.item))
    return fail('WATCHER_AI_INPUT_INVALID');
  const docs=new Map(p.analyses.map(a=>[a.revision.id,a]));
  const ids=p.eventDetection.map(e=>e.revisionId);
  if (docs.size!==20 || new Set(ids).size!==20 || ids.some(id=>!docs.has(id)))
    return fail('WATCHER_AI_INPUT_INVALID');
  return ids.map(revisionId=>{
    const original=docs.get(revisionId)!.revision.item;
    if (typeof original.title!=='string' || !original.title.trim() || original.title.length>600 ||
        (original.excerpt!==null && (typeof original.excerpt!=='string' || original.excerpt.length>1200)))
      return fail('WATCHER_AI_INPUT_INVALID');
    return {revisionId,text:[original.title,original.excerpt].filter(Boolean).join('\n')};
  });
}
let phase: 'ARGUMENTS' | 'CONFIG' | 'INPUT' | 'RECEIPT' | 'API' | 'SAVE' | 'FINISHED' = 'ARGUMENTS';
async function main() {
  if (process.argv.length!==4 || process.argv[2]!=='--run-once')
    fail('WATCHER_AI_MANUAL_OPT_IN_REQUIRED');
  const file=resolve(process.argv[3]!);
  if (!isAbsolute(process.argv[3]!) || !file.startsWith(directory+'\\') ||
      !/^intelligence-preview-.*\.json$/u.test(file.split(/[\\/]/u).at(-1)??''))
    fail('WATCHER_AI_INPUT_PATH_DENIED');
  phase='CONFIG';
  const config=await loadWatcherAiPilotConfig();
  phase='INPUT';
  const inputBytes=await readFile(file);
  const previewHash=createHash('sha256').update(inputBytes).digest('hex');
  const items=loadInput(JSON.parse(inputBytes.toString('utf8')));
  if (items.length!==config.maxArticles || config.hardCostCapUsd + 1e-10 < items.length*RESERVE_PER_ARTICLE_USD)
    fail('WATCHER_AI_BUDGET_BLOCKED');
  await mkdir(directory,{recursive:true});
  const runId=randomUUID();
  const receipt=resolve(directory,'ai-pilot-'+previewHash.slice(0,16)+'.started');
  phase='RECEIPT';
  const marker=await open(receipt,'wx'); // Do not automatically retry a possibly charged run.
  try { await marker.writeFile(JSON.stringify({runId,sourceHash:previewHash,model:config.model,articles:items.length})+'\n'); }
  finally { await marker.close(); }
  let spentUsd=0, calls=0;
  const rows=[];
  for (const item of items) {
    // Worst-case pre-flight reserve, in addition to measured spend.
    const remaining=items.length-calls;
    if (spentUsd+remaining*RESERVE_PER_ARTICLE_USD>config.hardCostCapUsd+1e-10)
      fail('WATCHER_AI_BUDGET_BLOCKED');
    phase='API';
    const output=await extractWatcherNewsWithOpenAi({
      apiKey:config.apiKey,
      model:'gpt-5.4-mini',
      text:item.text,
    });
    calls++;
    phase='SAVE';
    const cost=output.inputTokens*INPUT_USD_PER_MILLION/1_000_000+
      output.outputTokens*OUTPUT_USD_PER_MILLION/1_000_000;
    spentUsd+=cost;
    // Save independently immediately so partial runs never lose successful API results.
    await writeFile(resolve(directory,'ai-'+previewHash.slice(0,16)+'-'+String(calls).padStart(2,'0')+'.json'),
      JSON.stringify({runId,revisionId:item.revisionId,events:output.events,inputTokens:output.inputTokens,
        outputTokens:output.outputTokens,costUsd:cost},null,2)+'\n',
      {flag:'wx',mode:0o600});
    rows.push({revisionId:item.revisionId,events:output.events});
    if (spentUsd>config.hardCostCapUsd) fail('WATCHER_AI_BUDGET_EXCEEDED');
  }
  const resultPath=resolve(directory,'ai-pilot-'+previewHash.slice(0,16)+'.json');
  await writeFile(resultPath,JSON.stringify({schemaVersion:'watcher-ai-pilot/1',
    runId,sourceHash:previewHash,model:config.model,articles:items.length,calls,
    costUsd:spentUsd,rows},null,2)+'\n',{flag:'wx',mode:0o600});
  phase='FINISHED';
  console.log(JSON.stringify({status:'PASS',articles:items.length,calls,
    costUsd:spentUsd,resultFile:resultPath}));
}
main().catch(error=>{
  const allowed=/^WATCHER_AI_[A-Z_]+$/u;
  const osError=error as NodeJS.ErrnoException;
  const fileCode=osError?.code==='ENOENT' ? 'WATCHER_AI_REQUIRED_FILE_MISSING' :
    osError?.code==='EEXIST' ? 'WATCHER_AI_ALREADY_STARTED' :
    osError?.code==='EACCES' ? 'WATCHER_AI_FILE_ACCESS_DENIED' : null;
  const code=fileCode ?? (error instanceof Error && allowed.test(error.message)
    ? error.message : 'WATCHER_AI_PILOT_BLOCKED');
  const status = typeof (error as { status?:unknown })?.status==='number' ? (error as {status:number}).status : null;
  console.error(JSON.stringify({code,phase,httpStatus:status}));
  process.exitCode=1;
});
