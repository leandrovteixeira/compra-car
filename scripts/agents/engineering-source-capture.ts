import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { safeConnectorUrl } from '@compra-car/core/agents';

interface InventorySource { url:string; kind:string }
interface InventoryBrand {brand:string;market:string;urls:InventorySource[]}
interface Inventory {schemaVersion:string;brands:InventoryBrand[]}
export interface CaptureTransport {
 fetchSource(url:string):Promise<{status:number;finalUrl:string;contentType:string;body:string}>;
}
export interface CapturedSource {
 brand:string;market:string;sourceUrl:string;finalUrl:string;kind:string;
 status:number;contentType:string;contentSha256:string;byteLength:number;
}
export interface SourceCaptureManifest {
 schemaVersion:'engineering-source-capture-v1';
 independentlyReviewed:false;
 sourceInventorySha256:string;
 captures:CapturedSource[];
 failures:{brand:string;sourceUrl:string;reason:string}[];
}
/**
 * Capture externally, then replay the same immutable bytes offline.
 * No model calls, databases, canonical writes or automatic approval.
 */
export async function captureEngineeringSources(
 inventoryPath:string,outputPath:string,transport:CaptureTransport,
):Promise<SourceCaptureManifest>{
 const raw=await readFile(inventoryPath,'utf8');
 const inventory=JSON.parse(raw) as Inventory;
 if(inventory.schemaVersion!=='engineering-brand-source-inventory-v1'||!Array.isArray(inventory.brands))
   throw new Error('ENGINEERING_INVALID_INVENTORY');
 const captures:CapturedSource[]=[];
 const failures:SourceCaptureManifest['failures']=[];
 const blobs:{path:string;body:string}[]=[];
 for(const brand of inventory.brands){
   if(!['Kia','Volkswagen'].includes(brand.brand)||brand.market!=='BR'||!Array.isArray(brand.urls))
     throw new Error('ENGINEERING_INVALID_BRAND');
   const domains=brand.brand==='Kia'?['kia.com.br']:['vw.com.br'];
   for(const source of brand.urls){
     const canonical=safeConnectorUrl(source.url,domains);
     if(!canonical) throw new Error('ENGINEERING_UNSAFE_SOURCE');
     try{
       const value=await transport.fetchSource(canonical);
       const finalUrl=safeConnectorUrl(value.finalUrl,domains);
       if(!finalUrl||value.status!==200||!/^text\/html|^application\/json/iu.test(value.contentType))
         throw new Error('ENGINEERING_UNSUPPORTED_SOURCE');
       const bytes=Buffer.from(value.body,'utf8');
       if(bytes.length===0||bytes.length>5_000_000) throw new Error('ENGINEERING_SOURCE_SIZE');
       const digest=createHash('sha256').update(bytes).digest('hex');
       captures.push({brand:brand.brand,market:brand.market,sourceUrl:canonical,finalUrl,
         kind:source.kind,status:value.status,contentType:value.contentType,contentSha256:digest,
         byteLength:bytes.length});
       blobs.push({path:resolve(dirname(outputPath),'snapshots',digest+'.html'),body:value.body});
     }catch{
       failures.push({brand:brand.brand,sourceUrl:canonical,reason:'CAPTURE_FAILED'});
     }
   }
 }
 // Emit only after capture collection completes; failures are explicit, never silent success.
 for(const blob of blobs){await mkdir(dirname(blob.path),{recursive:true});await writeFile(blob.path,blob.body,{flag:'wx'}).catch(async error=>{
   if((error as NodeJS.ErrnoException).code!=='EEXIST') throw error;
   const existing=await readFile(blob.path,'utf8');
   if(existing!==blob.body) throw new Error('ENGINEERING_HASH_COLLISION');
 });}
 const manifest:SourceCaptureManifest={schemaVersion:'engineering-source-capture-v1',
   independentlyReviewed:false,sourceInventorySha256:createHash('sha256').update(raw).digest('hex'),
   captures,failures};
 await mkdir(dirname(outputPath),{recursive:true});
 await writeFile(outputPath,JSON.stringify(manifest,null,2)+'\n',{flag:'w'});
 return manifest;
}
