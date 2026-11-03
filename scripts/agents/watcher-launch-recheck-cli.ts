import {readFile,writeFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {scoreWatcherLaunch} from './watcher-launch-scoring';
import type {WatcherLaunchExtraction} from '@compra-car/adapter-openai';

async function main(){
  if(process.argv.length!==3)throw new Error('WATCHER_LAUNCH_RECHECK_INPUT_REQUIRED');
  const name=basename(process.argv[2]!);
  if(!/^launch-ai-[a-f0-9]{16}\.json$/u.test(name))
    throw new Error('WATCHER_LAUNCH_RECHECK_INPUT_INVALID');
  const dir=resolve(process.cwd(),'../../.local-reports/watcher-24b');
  const file=resolve(dir,name);
  const input=JSON.parse(await readFile(file,'utf8')) as {
    schemaVersion:string;results:{revisionId:string;launches:WatcherLaunchExtraction[]}[];
  };
  if(input.schemaVersion!=='watcher-launch-ai/1'||input.results?.length!==20||
    input.results.some(r=>typeof r.revisionId!=='string'||!Array.isArray(r.launches)))
    throw new Error('WATCHER_LAUNCH_RECHECK_INPUT_INVALID');
  const scored=input.results.flatMap(row=>row.launches.map(launch=>scoreWatcherLaunch(row.revisionId,launch)));
  const counts=scored.reduce((acc,item)=>{
    acc[item.decision]=(acc[item.decision]??0)+1;return acc;
  },{} as Record<string,number>);
  const out=resolve(dir,name.replace('.json','-rechecked.json'));
  await writeFile(out,JSON.stringify({mode:'READ_ONLY',counts,scored},null,2)+'\n',
    {flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PASS',costUsd:0,counts,output:out}));
}
main().catch(error=>{
  const e=error as {code?:string;message?:string};
  console.error(e.code==='EEXIST'?'WATCHER_LAUNCH_RECHECK_ALREADY_EXISTS':
    e.message?.startsWith('WATCHER_LAUNCH_RECHECK_')?e.message:'WATCHER_LAUNCH_RECHECK_BLOCKED');
  process.exitCode=1;
});
