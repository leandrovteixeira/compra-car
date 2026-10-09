import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { isIP } from 'node:net';
import type { SafeCaptureNetwork } from './engineering-safe-capture-transport';

/** HTTPS destination is pinned to the previously validated IP while SNI and cert
 * verification use the original official hostname. No redirects or proxies. */
export function nodePinnedCaptureNetwork(): SafeCaptureNetwork {
 return {
  async resolve(host) {
   const addresses=await lookup(host,{all:true});
   return addresses.map(a=>a.address);
  },
  request(url,address,signal) {
   return new Promise((resolve,reject)=>{
    const target=new URL(url);
    if(target.protocol!=='https:'||!isIP(address)) {
     reject(new Error('ENGINEERING_INVALID_DESTINATION'));return;
    }
    const req=httpsRequest(target,{
     method:'GET',agent:false,signal,autoSelectFamily:false,
     servername:target.hostname,
     rejectUnauthorized:true,
     lookup:(_hostname,_options,callback)=>{
      callback(null,address,isIP(address));
     },
     headers:{accept:'text/html,application/json;q=0.9',
       'user-agent':'CompraCarEngineeringCapture/1.0'},
    },response=>{
     resolve({
      status:response.statusCode??0,
      headers:{get:(name:string)=>{
       const value=response.headers[name.toLowerCase()];
       return Array.isArray(value)?value.join(','):value??null;
      }},
      body:Readable.toWeb(response) as ReadableStream<Uint8Array>,
     });
    });
    req.on('error',(error: NodeJS.ErrnoException)=>{
     const known=new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','EHOSTUNREACH','ENETUNREACH','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
     reject(new Error(known.has(error.code??'') ? 'ENGINEERING_NETWORK_'+error.code : 'ENGINEERING_NETWORK_FAILED'));
    });
    req.end();
   });
  },
 };
}
