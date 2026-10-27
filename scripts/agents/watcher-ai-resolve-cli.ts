import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createLegacySupabaseClient } from '@compra-car/adapter-supabase';
import { readWatcherCanonicalContext, type WatcherCanonicalReader } from '@compra-car/adapter-supabase/watcher-intelligence-context';
import { createWatcherQaExecutor, WATCHER_QA_URL } from '@compra-car/adapter-supabase/watcher-qa';
import { loadWatcherQaEnvironment } from './watcher-qa-environment';
import { resolveWatcherAiReview } from './watcher-ai-entity-resolution';
import type { WatcherReviewItem } from './watcher-ai-review';

async function main() {
  if (process.argv.length!==3) throw new Error('WATCHER_RESOLVE_INPUT_REQUIRED');
  const dir=resolve(process.cwd(),'../../.local-reports/watcher-24b');
  const filename=basename(process.argv[2]!);
  if (!/^ai-pilot-[a-f0-9]{16}-review\.json$/u.test(filename))
    throw new Error('WATCHER_RESOLVE_INPUT_INVALID');
  const input=JSON.parse(await readFile(resolve(dir,filename),'utf8')) as
    {status:string;articles:number;items:WatcherReviewItem[]};
  if(input.status!=='REVIEW_REQUIRED'||input.articles!==20||
    !Array.isArray(input.items)||input.items.length>100||
    input.items.some(i=>!i||i.status!=='REVIEW_REQUIRED'))
    throw new Error('WATCHER_RESOLVE_INPUT_INVALID');
  const env=await loadWatcherQaEnvironment();
  const executor=createWatcherQaExecutor(()=>env);
  const context=await executor.run(async()=>{
    const client=createLegacySupabaseClient({url:WATCHER_QA_URL,serverKey:env.SUPABASE_SERVER_KEY!});
    return readWatcherCanonicalContext(client as unknown as WatcherCanonicalReader);
  });
  const items=input.items.map(item=>resolveWatcherAiReview(item,context));
  const counts=items.reduce((acc,item)=>{
    acc[item.nextAction]=(acc[item.nextAction]??0)+1;
    return acc;
  },{} as Record<string,number>);
  const output=resolve(dir,filename.replace('-review.json','-resolved.json'));
  await writeFile(output,JSON.stringify({status:'REVIEW_REQUIRED',articles:20,
    canonicalBrandCount:context.brands.length,canonicalMmvCount:context.mmvs.length,
    items,counts},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PASS',readOnly:true,items:items.length,
    canonicalBrands:context.brands.length,canonicalMmvs:context.mmvs.length,
    counts,reportFile:output}));
}
main().catch(error=>{
  const code=error && typeof error==='object' && 'code' in error ? (error as {code?:unknown}).code:null;
  const message=error instanceof Error && /^WATCHER_[A-Z_]+$/u.test(error.message)?
    error.message:'WATCHER_RESOLVE_BLOCKED';
  console.error(code==='EEXIST'?'WATCHER_RESOLVE_ALREADY_EXISTS':message);
  process.exitCode=1;
});
