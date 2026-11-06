/** QA-only, zero-LLM Ford PDF geometry probe. No canonical writes.
 * Extract true PDF text positions with Poppler's pdftotext -bbox.
 */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {RANGER_XLS_MATRIX_PDF} from '@compra-car/core/agents';
import {createLegacySupabaseClient} from '@compra-car/adapter-supabase';
import {officialFordPdfBytes} from './ford-supervised-pdf-job';
type Db=ReturnType<typeof createLegacySupabaseClient>;

export interface FordPdfWord27 {text:string;x:number;y:number;w:number;h:number}
export interface FordPdfGeometry27 {
 sha256:string;pageWidth:number;pageHeight:number;
 words:FordPdfWord27[];
}
const decoded=(text:string)=>text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/giu,
 token=>{
  switch(token){case '&amp;':return '&';case '&lt;':return '<';
   case '&gt;':return '>';case '&quot;':return '"';case '&apos;':return "'";}
  const hex=/^&#x([0-9a-f]+);$/iu.exec(token);
  const dec=/^&#(\d+);$/u.exec(token);
  const code=hex?parseInt(hex[1]!,16):dec?Number(dec[1]):0;
  return code>0&&code<=0x10ffff?String.fromCodePoint(code):token;
 });
export function readFordPdfBbox27(xml:string,sha256:string):FordPdfGeometry27{
 const page=/<page\b[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/u.exec(xml);
 if(!page)throw new Error('FORD_PDF_BBOX_PAGE_UNREADABLE');
 const pageWidth=Number(page[1]),pageHeight=Number(page[2]);
 if(!Number.isFinite(pageWidth)||!Number.isFinite(pageHeight)||
    pageWidth<100||pageHeight<100)throw new Error('FORD_PDF_BBOX_DIMENSIONS_INVALID');
 const words:FordPdfWord27[]=[];
 const re=/<word\b[^>]*xMin="([\d.]+)"[^>]*yMin="([\d.]+)"[^>]*xMax="([\d.]+)"[^>]*yMax="([\d.]+)"[^>]*>([^<]*)<\/word>/gu;
 for(const match of xml.matchAll(re)){
  const x=Number(match[1]),y=Number(match[2]);
  const xmax=Number(match[3]),ymax=Number(match[4]);
  if(![x,y,xmax,ymax].every(Number.isFinite)||
     xmax<x||ymax<y||x<0||y<0||xmax>pageWidth+1||ymax>pageHeight+1)
   throw new Error('FORD_PDF_BBOX_WORD_INVALID');
  words.push({text:decoded(match[5]??''),x,y,w:xmax-x,h:ymax-y});
  if(words.length>10000)throw new Error('FORD_PDF_BBOX_TOO_MANY_WORDS');
 }
 if(words.length<100)throw new Error('FORD_PDF_BBOX_TEXT_MISSING');
 return {sha256,pageWidth,pageHeight,words};
}
export async function extractFordPdfGeometry27(pdf:Uint8Array):Promise<FordPdfGeometry27>{
 if(Buffer.from(pdf).subarray(0,4).toString('ascii')!=='%PDF')
  throw new Error('FORD_PDF_INVALID');
 const output=await new Promise<string>((resolve,reject)=>{
  const p=spawn('pdftotext',['-f','2','-l','2','-bbox','-','-'],{
   stdio:['pipe','pipe','pipe'],env:{...process.env,LC_ALL:'C.UTF-8'}});
  let output='';let stderr='';let finished=false;
  const timer=setTimeout(()=>p.kill('SIGKILL'),20000);
  const end=(error?:Error)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   if(error)reject(error);else resolve(output);
  };
  p.on('error',()=>end(new Error('FORD_PDF_POPPLER_UNAVAILABLE')));
  p.stdout.setEncoding('utf8');
  p.stdout.on('data',(part:string)=>{output+=part;
   if(output.length>5_000_000)p.kill('SIGKILL');});
  p.stderr.setEncoding('utf8');
  p.stderr.on('data',(part:string)=>{stderr=(stderr+part).slice(-300);});
  p.on('close',code=>end(code===0?undefined:
   new Error(code===null?'FORD_PDF_POPPLER_TIMEOUT':'FORD_PDF_POPPLER_FAILED')));
  p.stdin.on('error',()=>{});
  p.stdin.end(Buffer.from(pdf));
 });
 const sha256=createHash('sha256').update(pdf).digest('hex');
 return readFordPdfBbox27(output,sha256);
}
export function summarizeFordPdfGeometry27(geometry:FordPdfGeometry27){
 // Coordinates in the original PDF, never guessed from screenshot pixels.
 const w=geometry.pageWidth,h=geometry.pageHeight;
 const zones=[
  {name:'TOP_LEFT',minX:0,maxX:0.40,minY:0,maxY:0.55},
  {name:'LOWER_MIDDLE',minX:0.20,maxX:0.63,minY:0.48,maxY:0.99},
  {name:'LOWER_RIGHT',minX:0.60,maxX:1,minY:0.48,maxY:0.94}
 ];
 const lines=zones.map(zone=>{
  const words=geometry.words.filter(a=>a.x/w>=zone.minX&&a.x/w<zone.maxX&&
   a.y/h>=zone.minY&&a.y/h<zone.maxY).sort((a,b)=>a.y-b.y||a.x-b.x);
  const rows:{y:number;words:FordPdfWord27[]}[]=[];
  for(const word of words){
   const row=rows.find(r=>Math.abs(r.y-word.y)<Math.max(1.8,word.h*0.45));
   if(row)row.words.push(word);else rows.push({y:word.y,words:[word]});
  }
  return {zone:zone.name,lines:rows.sort((a,b)=>a.y-b.y).map(r=>({
   y:Math.round(r.y*10)/10,
   words:r.words.sort((a,b)=>a.x-b.x).map(v=>[Math.round(v.x*10)/10,v.text])
  })).slice(0,160)};
 });
 return {documentSha256:geometry.sha256,pageWidth:w,pageHeight:h,wordCount:geometry.words.length,
  regions:lines};
}
export async function runFordXlsCoordinateProbe27(input:{
 db:Db;jobId:string;createdAt:string;productId:number;
}):Promise<{runId:string;wordCount:number}>{
 if(input.productId!==1236)throw new Error('FORD_XLS_GEOMETRY_SCOPE_DENIED');
 const pdf=await officialFordPdfBytes(RANGER_XLS_MATRIX_PDF);
 const geometry=await extractFordPdfGeometry27(pdf);
 const report=summarizeFordPdfGeometry27(geometry);
 const {error}=await input.db.from('agent_runs').insert({
  id:input.jobId,agent_type:'SPEC_INTELLIGENCE',status:'COMPLETED',
  brand:'Ford',market:'BR',provider:'deterministic',
  run_mode:'SOURCE_GEOMETRY_ONLY',schema_version:'S27-FORD-POPPLER.1',
  started_at:input.createdAt,completed_at:new Date().toISOString(),
  input:{sourceUrl:RANGER_XLS_MATRIX_PDF,targetProductId:input.productId},
  summary:{...report,reviewOnly:true,noProductSpecWrites:true,noCatalogWrites:true,aiCalls:0},
  config_snapshot:{qaOnly:true,supervised:true,pdfGeometry:true}
 });
 if(error)throw new Error('FORD_XLS_GEOMETRY_RUN_PERSIST_FAILED');
 return {runId:input.jobId,wordCount:geometry.words.length};
}
