import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {describe,it,expect} from 'vitest';
import {verifyEngineeringCapture} from '../engineering-capture-verify';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
describe('capture offline integrity verification',()=>{
 it('verifies real archived bytes without granting golden review',async()=>{
  const root=await mkdtemp(join(tmpdir(),'capture-verify-'));
  try{
   await mkdir(join(root,'snapshots'));
   const body='<html>kia</html>',hash=sha(body);
   await writeFile(join(root,'snapshots',hash+'.html'),body);
   const path=join(root,'capture.json');
   await writeFile(path,JSON.stringify({schemaVersion:'engineering-source-capture-v1',
     independentlyReviewed:false,failures:[],captures:[{sourceUrl:'https://www.kia.com.br/',
     contentSha256:hash,byteLength:Buffer.byteLength(body)}]}));
   expect(await verifyEngineeringCapture(path)).toMatchObject({verified:1,allVerified:true,independentlyReviewed:false});
   await writeFile(join(root,'snapshots',hash+'.html'),'tampered');
   await expect(verifyEngineeringCapture(path)).rejects.toThrow('ENGINEERING_CAPTURE_INTEGRITY_FAILED');
  }finally{await rm(root,{recursive:true,force:true});}
 });
});
