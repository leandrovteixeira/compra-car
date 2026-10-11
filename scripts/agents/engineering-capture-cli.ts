import { resolve } from 'node:path';
import { captureEngineeringSources } from './engineering-source-capture';
import { createSafeCaptureTransport } from './engineering-safe-capture-transport';
import { nodePinnedCaptureNetwork } from './engineering-node-pinned-network';

/** Explicit one-shot capture, never invoked during tests or regular agent runs. */
async function main(args:readonly string[]):Promise<number> {
 if(args.length!==2 || args[0]!=='--output') throw new Error('ENGINEERING_CAPTURE_ARGUMENTS');
 const output=resolve(args[1]!);
 const inventory=resolve(import.meta.dirname,'../../docs/agents/fixtures/brand-pilot-official-source-inventory.json');
 const capture=await captureEngineeringSources(
  inventory,output,createSafeCaptureTransport(nodePinnedCaptureNetwork()),
 );
 console.log(JSON.stringify({captures:capture.captures.length,failures:capture.failures.length,
  reviewed:capture.independentlyReviewed,failuresByReason:capture.failures.reduce<Record<string,number>>((counts,item)=>{counts[item.reason]=(counts[item.reason]??0)+1;return counts;},{}),output}));
 return capture.failures.length ? 2 : 0;
}
void main(process.argv.slice(2)).then(code=>{process.exitCode=code;})
 .catch(()=>{console.error('ENGINEERING_CAPTURE_FAILED');process.exitCode=1;});
