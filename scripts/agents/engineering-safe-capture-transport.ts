import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { safeConnectorUrl } from '@compra-car/core/agents';
import type { CaptureTransport } from './engineering-source-capture';

const ALLOWED = ['kia.com.br', 'vw.com.br'];
function publicIp(ip:string):boolean {
 if(isIP(ip)===4){
  const a=ip.split('.').map(Number), [x,y]=a;
  return x!==0&&x!==10&&x!==127&&x!==169&&x!==192&&x!==224&&x!==255
    &&!(x===172&&y!>=16&&y!<=31)&&!(x===192&&y===168)
    &&!(x===100&&y!>=64&&y!<=127)&&!(x===198&&y===18)
    &&!(x===198&&y===19)&&!(x===192&&y===0)
    &&!(x===198&&y===51)&&!(x===203&&y===0);
 }
 if(isIP(ip)===6){
  const v=ip.toLowerCase();
  return v!=='::'&&v!=='::1'&&!v.startsWith('fc')&&!v.startsWith('fd')
    &&!v.startsWith('fe')&&!v.startsWith('ff')&&!v.startsWith('2001:db8')
    &&!v.startsWith('::ffff:');
 }
 return false;
}
export interface SafeCaptureNetwork {
 readonly resolve:(host:string)=>Promise<readonly string[]>;
 readonly request:(url:string, signal:AbortSignal)=>Promise<{
  status:number;headers:{get(name:string):string|null};
  body:ReadableStream<Uint8Array>|null;
 }>;
}
export function createSafeCaptureTransport(
 network:SafeCaptureNetwork,
 options:{maxBytes?:number;timeoutMs?:number}={},
):CaptureTransport {
 const maxBytes=options.maxBytes??5_000_000, timeoutMs=options.timeoutMs??10_000;
 if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>5_000_000
   ||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30_000)
  throw new Error('ENGINEERING_INVALID_TRANSPORT_LIMIT');
 return {async fetchSource(value:string){
  const url=safeConnectorUrl(value,ALLOWED);
  if(!url||!url.startsWith('https://'))throw new Error('ENGINEERING_UNSAFE_SOURCE');
  const hostname=new URL(url).hostname;
  const addresses=await network.resolve(hostname);
  if(!addresses.length||addresses.some(ip=>!publicIp(ip)))
   throw new Error('ENGINEERING_PRIVATE_DNS');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await network.request(url,controller.signal);
   if(response.status>=300&&response.status<400)throw new Error('ENGINEERING_REDIRECT_BLOCKED');
   const type=response.headers.get('content-type')??'';
   if(response.status!==200||!(/^(?:text\/html|application\/json)(?:;|$)/iu.test(type)))
    throw new Error('ENGINEERING_UNSUPPORTED_SOURCE');
   const reader=response.body?.getReader();
   if(!reader)throw new Error('ENGINEERING_EMPTY_BODY');
   const chunks:Uint8Array[]=[];
   let size=0;
   try{
    while(true){
     const chunk=await reader.read();
     if(chunk.done)break;
     size+=chunk.value.byteLength;
     if(size>maxBytes)throw new Error('ENGINEERING_SOURCE_SIZE');
     chunks.push(chunk.value);
    }
   }finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
   if(!size)throw new Error('ENGINEERING_EMPTY_BODY');
   return {status:200,finalUrl:url,contentType:type,body:Buffer.concat(chunks).toString('utf8')};
  }finally{clearTimeout(timer);}
 }};
}
/** Only use with a pinned-address transport. Fetch is not DNS-pinned. */
export async function resolveOfficialCaptureAddresses(host:string):Promise<readonly string[]>{
 const records=await lookup(host,{all:true});
 return records.map(r=>r.address);
}
