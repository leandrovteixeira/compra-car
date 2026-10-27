import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { projectWatcherLaunches, type WatcherAiPilotRow } from './watcher-launching-bridge';

async function main() {
  if(process.argv.length!==4 || process.argv[2]!=='--read-only')
    throw new Error('WATCHER_LAUNCH_READ_ONLY_REQUIRED');
  const name=basename(process.argv[3]!);
  if(!/^ai-pilot-[a-f0-9]{16}\.json$/u.test(name))
    throw new Error('WATCHER_LAUNCH_INPUT_INVALID');
  const dir=resolve(process.cwd(),'../../.local-reports/watcher-24b');
  const file=resolve(dir,name);
  const input=JSON.parse(await readFile(file,'utf8')) as {
    schemaVersion:string;articles:number;rows:WatcherAiPilotRow[];
  };
  if(input.schemaVersion!=='watcher-ai-pilot/1' || input.articles!==20 ||
    !Array.isArray(input.rows) || input.rows.length!==20 ||
    input.rows.some(row=>!row||typeof row.revisionId!=='string'||!Array.isArray(row.events)))
    throw new Error('WATCHER_LAUNCH_INPUT_INVALID');
  const result=projectWatcherLaunches(input.rows,[], '2026-10');
  const output=resolve(dir,name.replace('.json','-launching-preview.json'));
  await writeFile(output,JSON.stringify({mode:'READ_ONLY',dateEvidence:'NOT_YET_EXTRACTED',
    canonicalMmvClosure:'NOT_EVALUATED',...result},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PASS',mode:'READ_ONLY',
    articles:result.articles,extractedEvents:result.extractedEvents,
    eligibleEvidence:result.eligibleEvidence,launchLeads:result.map.length,
    activeLaunches:result.map.filter(x=>x.visible).length,
    pendingTemporalVerification:result.pendingTemporalVerification,reportFile:output}));
}
main().catch(error=>{
 const code=error && typeof error==='object' && 'code' in error?(error as {code?:unknown}).code:null;
 const safe=error instanceof Error&&/^WATCHER_LAUNCH_[A-Z_]+$/u.test(error.message)?
   error.message:code==='EEXIST'?'WATCHER_LAUNCH_ALREADY_EXISTS':'WATCHER_LAUNCH_BLOCKED';
 console.error(safe);process.exitCode=1;
});
