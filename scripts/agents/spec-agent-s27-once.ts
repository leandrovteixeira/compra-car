/** GWM PHEV19 2027: isolated one-shot Railway entrypoint.
 * No secrets are read or copied here; the AI pilot uses its existing runtime provider configuration.
 * No canonical database writes.
 */
import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const fixturePath = new URL('./fixtures/gwm-phev19-2027-claims.zlib.b64', import.meta.url);
const snapshot = JSON.parse(inflateSync(Buffer.from(readFileSync(fixturePath,'utf8').trim(),'base64')).toString('utf8')) as {
 target:{ productId:number; modelYear:number };
 findings: unknown[];
};
if(snapshot.target.productId!==1166 || snapshot.target.modelYear!==2027 || snapshot.findings.length!==79){
 throw new Error('SPEC_PILOT_SNAPSHOT_INVALID');
}
const inputPath='/tmp/spec-pilot-input.json';
writeFileSync(inputPath,JSON.stringify(snapshot));
console.log('SPEC_PILOT_INPUT_READY',snapshot.findings.length);
process.argv=[process.argv[0]??'node', 'spec-agent-gwm-ai-pilot', '--execute', inputPath];

let failed=false;
try {
 await import('./spec-agent-gwm-ai-pilot');
} catch (error) {
 failed=true;
 console.error('SPEC_PILOT_EXECUTION_FAILED',String(error));
}
const reportPath='/tmp/gwm-spec-ai-pilot.json';
if(existsSync(reportPath)){
 const report=JSON.parse(readFileSync(reportPath,'utf8')) as Record<string,unknown>;
 const {proposals,...telemetry}=report;
 console.log('SPEC_PILOT_TELEMETRY',JSON.stringify(telemetry));
 if(Array.isArray(proposals)){
  for(let i=0;i<proposals.length;i+=10)
   console.log('SPEC_PILOT_PROPOSALS',i,JSON.stringify(proposals.slice(i,i+10)));
 }
 if(report.status!=='COMPLETED_REVIEW_ONLY')failed=true;
}else{
 console.error('SPEC_PILOT_REPORT_MISSING');
 failed=true;
}
if(failed)process.exitCode=1;
