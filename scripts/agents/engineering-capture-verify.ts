import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import type {SourceCaptureManifest} from './engineering-source-capture';

export interface EngineeringCaptureIntegrity {
 schemaVersion:'engineering-capture-integrity-v1';
 captured:number;
 verified:number;
 failures:number;
 allVerified:boolean;
 independentlyReviewed:false;
}
export async function verifyEngineeringCapture(manifestPath:string):Promise<EngineeringCaptureIntegrity>{
 const parsed:unknown=JSON.parse(await readFile(manifestPath,'utf8'));
 if(!parsed||typeof parsed!=='object')throw new Error('ENGINEERING_INVALID_CAPTURE_MANIFEST');
 const m=parsed as SourceCaptureManifest;
 if(m.schemaVersion!=='engineering-source-capture-v1'||!Array.isArray(m.captures)
   ||!Array.isArray(m.failures)||m.independentlyReviewed!==false)
   throw new Error('ENGINEERING_INVALID_CAPTURE_MANIFEST');
 let verified=0;
 const seen=new Set<string>();
 for(const item of m.captures){
  if(!/^[0-9a-f]{64}$/u.test(item.contentSha256)||seen.has(item.sourceUrl))
   throw new Error('ENGINEERING_CAPTURE_DUPLICATE_OR_INVALID');
  seen.add(item.sourceUrl);
  const bytes=await readFile(join(dirname(manifestPath),'snapshots',item.contentSha256+'.html'));
  if(bytes.length!==item.byteLength
    ||createHash('sha256').update(bytes).digest('hex')!==item.contentSha256)
   throw new Error('ENGINEERING_CAPTURE_INTEGRITY_FAILED');
  verified++;
 }
 return {schemaVersion:'engineering-capture-integrity-v1',captured:m.captures.length,
   verified,failures:m.failures.length,allVerified:verified===m.captures.length&&m.failures.length===0,
   independentlyReviewed:false};
}
async function main(args:readonly string[]){
 if(args.length!==2||args[0]!=='--manifest')throw new Error('ENGINEERING_REPLAY_ARGUMENTS');
 const report=await verifyEngineeringCapture(args[1]!);
 await writeFile(join(dirname(args[1]!),'integrity.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 process.exitCode=report.allVerified?0:2;
}
if(process.argv[1]?.endsWith('engineering-capture-verify.ts'))
 void main(process.argv.slice(2)).catch(()=>{console.error('ENGINEERING_CAPTURE_VERIFY_FAILED');process.exitCode=1;});
