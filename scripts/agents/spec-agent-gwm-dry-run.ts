/**
 * GWM technical extraction smoke runner (zero LLM, no database writes).
 * Usage:
 *   pnpm --filter @compra-car/agents exec tsx spec-agent-gwm-dry-run.ts --text path.txt
 *   pnpm --filter @compra-car/agents exec tsx spec-agent-gwm-dry-run.ts --pdf path.pdf
 * Requires pdftotext from Poppler for --pdf. Never fetches a URL itself.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {extractGwmH6Technical27} from '@compra-car/core/agents';

const [mode,path]=process.argv.slice(2);
if(!path || !['--text','--pdf'].includes(mode)){
  process.stderr.write('Usage: spec-agent-gwm-dry-run.ts (--text|--pdf) local_path\n');
  process.exitCode=2;
} else {
  const inputs: {mode:string,text:string}[] = mode==='--pdf'
    ? ['-layout','-raw'].map(layout=>({
      mode:layout,
      text:execFileSync('pdftotext',[layout,path,'-'],{encoding:'utf8',maxBuffer:12*1024*1024}),
    }))
    : [{mode:'text',text:readFileSync(path,'utf8')}];
  const attempts=inputs.map(x=>{
    try{return {...x,result:extractGwmH6Technical27(x.text),error:null};}
    catch(error){return {...x,result:null,error:String(error)};}
  });
  const best=attempts.filter(x=>x.result!==null)
    .sort((a,b)=>(b.result?.summary.recognizedFields??0)-(a.result?.summary.recognizedFields??0))[0];
  if(!best){
    process.stderr.write('GWM_TECHNICAL_EXTRACTION_FAILED: '+attempts.map(x=>x.error).join('; ')+'\n');
    process.exitCode=1;
  }else{
    const r=best.result!;
    const report={
      inputMode:mode, chosenTextMode:best.mode,
      summary:r.summary, observations:r.observations, unresolved:r.unresolved,
      reconciledAutomatically:0,
      reconciliationNote:'No approved contextual aliases supplied; this measures extraction only.',
      databaseWrites:0, llmCalls:0,
    };
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }
}
