import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { captureEngineeringSources } from '../engineering-source-capture';

const inventory={schemaVersion:'engineering-brand-source-inventory-v1',brands:[
 {brand:'Kia',market:'BR',urls:[{url:'https://www.kia.com.br/',kind:'MODEL_INDEX'}]},
 {brand:'Volkswagen',market:'BR',urls:[{url:'https://www.vw.com.br/pt/carros.html',kind:'MODEL_INDEX'}]},
]};
describe('offline source capture with injected transport',()=>{
 it('stores replayable content-addressed bytes without review authority',async()=>{
  const root=await mkdtemp(join(tmpdir(),'capture-'));
  try{
   const input=join(root,'inventory.json'), output=join(root,'out','capture.json');
   await writeFile(input,JSON.stringify(inventory));
   const transport={fetchSource:vi.fn(async (url:string)=>({status:200,finalUrl:url,contentType:'text/html',
     body:'<html><body>Fixture content</body></html>'}))};
   const result=await captureEngineeringSources(input,output,transport);
   expect(result.captures).toHaveLength(2);
   expect(result.independentlyReviewed).toBe(false);
   expect(result.failures).toHaveLength(0);
   expect(transport.fetchSource).toHaveBeenCalledTimes(2);
   const hash=createHash('sha256').update('<html><body>Fixture content</body></html>').digest('hex');
   expect(result.captures[0]?.contentSha256).toBe(hash);
   expect(await readFile(join(root,'out','snapshots',hash+'.html'),'utf8')).toBe('<html><body>Fixture content</body></html>');
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('rejects redirect to an outside host, without marking a valid capture',async()=>{
  const root=await mkdtemp(join(tmpdir(),'capture-'));
  try{
   const input=join(root,'inventory.json'),output=join(root,'out','capture.json');
   await writeFile(input,JSON.stringify(inventory));
   const result=await captureEngineeringSources(input,output,{fetchSource:async(url:string)=>({
     status:200,finalUrl:url.includes('kia.com.br')?'https://other.example.com/':url,
     contentType:'text/html',body:'hello',
   })});
   expect(result.captures).toHaveLength(1);
   expect(result.failures).toHaveLength(1);
   expect(result.failures[0]?.reason).toBe('ENGINEERING_UNSUPPORTED_SOURCE');
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
