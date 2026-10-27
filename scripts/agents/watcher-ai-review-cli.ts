import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { reviewWatcherAiEvents } from './watcher-ai-review';
import type { WatcherAiExtractedEvent } from '@compra-car/adapter-openai';

async function main() {
  const arg=process.argv[2];
  if (process.argv.length!==3 || !arg) throw new Error('WATCHER_REVIEW_FILE_REQUIRED');
  const file=resolve(arg);
  if (!/^ai-pilot-[a-f0-9]{16}\.json$/u.test(basename(file)) ||
      !file.includes('.local-reports')) throw new Error('WATCHER_REVIEW_PATH_DENIED');
  const data=JSON.parse(await readFile(file,'utf8')) as {
    schemaVersion:string;articles:number;rows:{revisionId:string;events:WatcherAiExtractedEvent[]}[];
  };
  if(data.schemaVersion!=='watcher-ai-pilot/1'||data.articles!==20||
    !Array.isArray(data.rows)||data.rows.length!==20)
    throw new Error('WATCHER_REVIEW_INPUT_INVALID');
  const items=data.rows.flatMap(row=>reviewWatcherAiEvents(row.events).map(item=>({...item,revisionId:row.revisionId})));
  const counts=items.reduce((a,item)=>({...a,[item.route]:(a[item.route]??0)+1}),
    {} as Record<string,number>);
  const output=resolve(dirname(file),basename(file).replace('.json','-review.json'));
  await writeFile(output,JSON.stringify({status:'REVIEW_REQUIRED',articles:20,
    extractedEvents:data.rows.reduce((n,r)=>n+r.events.length,0),
    reviewItems:items.length,counts,items},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PASS',reviewItems:items.length,counts,reportFile:output}));
}
main().catch(e=>{console.error(e instanceof Error && /^WATCHER_[A-Z_]+$/u.test(e.message)?
  e.message:'WATCHER_REVIEW_BLOCKED');process.exitCode=1;});
